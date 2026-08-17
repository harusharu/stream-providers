//! Node sidecar worker pool and JSON-RPC-over-stdio protocol.
//!
//! Each worker is a `node rust-api/worker/worker.js` process spawned with
//! `cwd = PROVIDERS_ROOT` so `axios`, `cheerio`, and `curl-cffi-node` resolve
//! from the repo's `node_modules`. Calls are newline-delimited JSON on stdin;
//! responses arrive on stdout, **which carries only protocol lines** — provider
//! `console.log` is redirected to stderr.
//!
//! Protocol:
//!
//! ```text
//! in:  {"id":1,"method":"call","params":{"provider","module","fn","args"}}
//! out: {"id":1,"ok":true,"data":…} | {"id":1,"ok":false,"error":{"message","status"}}
//! in:  {"id":2,"method":"ping"}  →  out: {"id":2,"ok":true,"data":{"pong":true}}
//! ```
//!
//! ## Pool behaviour
//!
//! - Fixed worker count ([`Config::worker_count`]),
//!   round-robin selection, and a global semaphore that caps concurrent calls.
//! - A call that exceeds [`Config::call_timeout_ms`]
//!   recycles that worker (kill + respawn) and returns `Timeout`.
//! - Transient failures ([`ApiError::is_transient`])
//!   retry on a different worker.
//! - When a worker's stdout reaches EOF (crash), all pending calls fail and
//!   the pool lazily respawns it on the next call .
//! - A worker generation is replaced wholesale on respawn so a stale reader
//!   task can never mutate the state of a newer process.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex, Semaphore};
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::error::ApiError;

type Pending = HashMap<u64, oneshot::Sender<Result<Value, WorkerFailure>>>;

/// Parse one stdout protocol line into `(id, result)`. Returns `None` when the
/// line is not a valid response envelope (e.g. stray log output).
fn parse_worker_line(line: &str) -> Option<(u64, Result<Value, WorkerFailure>)> {
    let v: Value = serde_json::from_str(line).ok()?;
    let id = v.get("id").and_then(|i| i.as_u64())?;
    if v.get("ok").and_then(|b| b.as_bool()).unwrap_or(false) {
        Some((id, Ok(v.get("data").cloned().unwrap_or(Value::Null))))
    } else {
        let err = v.get("error").cloned().unwrap_or(Value::Null);
        let message = err
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("provider worker error")
            .to_string();
        let status = err.get("status").and_then(|s| s.as_u64()).unwrap_or(502) as u16;
        Some((id, Err(WorkerFailure { message, status })))
    }
}

#[derive(Debug, Clone)]
pub struct WorkerFailure {
    pub message: String,
    pub status: u16,
}

/// One generation of a worker process. Replaced wholesale on respawn so a
/// stale reader task can never mutate the state of a newer process.
struct WorkerGen {
    child: Child,
    stdin: ChildStdin,
    pending: Arc<Mutex<Pending>>,
    next_id: AtomicU64,
}

pub struct Worker {
    id: usize,
    config: Arc<Config>,
    write_lock: Mutex<()>,
    gen: Mutex<Option<WorkerGen>>,
    alive: Arc<AtomicBool>,
}

impl Worker {
    async fn spawn(config: Arc<Config>, id: usize) -> anyhow::Result<Worker> {
        let w = Worker {
            id,
            config,
            write_lock: Mutex::new(()),
            gen: Mutex::new(None),
            alive: Arc::new(AtomicBool::new(false)),
        };
        w.launch().await?;
        Ok(w)
    }

    async fn launch(&self) -> anyhow::Result<()> {
        let mut cmd = Command::new("node");
        cmd.arg(&self.config.worker_script)
            .current_dir(&self.config.providers_root)
            .env("PROVIDERS_ROOT", &self.config.providers_root)
            .env(
                "WORKER_TIMEOUT_MS",
                self.config.worker_timeout_ms.to_string(),
            )
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            anyhow::anyhow!("failed to spawn node worker (is node installed, dist built?): {e}")
        })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow::anyhow!("worker stdin unavailable"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("worker stdout unavailable"))?;
        let mut stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow::anyhow!("worker stderr unavailable"))?;
        let pid = child.id().unwrap_or(0);

        let pending: Arc<Mutex<Pending>> = Arc::new(Mutex::new(HashMap::new()));

        // Drain stderr (providers log a lot) so the child never blocks on a
        // full pipe.
        {
            let stderr_pid = pid;
            tokio::spawn(async move {
                let mut lines = BufReader::new(&mut stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if !line.trim().is_empty() {
                        debug!(pid = stderr_pid, stderr = %line, "worker log");
                    }
                }
            });
        }

        // Route response lines to the matching pending call. On EOF, fail all
        // pending calls and mark the worker dead so the pool recycles it.
        {
            let reader_pid = pid;
            let reader_pending = pending.clone();
            let reader_alive = self.alive.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                loop {
                    let line = match lines.next_line().await {
                        Ok(Some(l)) => l,
                        Ok(None) | Err(_) => break,
                    };
                    if line.trim().is_empty() {
                        continue;
                    }
                    match parse_worker_line(&line) {
                        Some((id, result)) => {
                            if let Some(tx) = reader_pending.lock().await.remove(&id) {
                                let _ = tx.send(result);
                            }
                        }
                        None => warn!(pid = reader_pid, "worker emitted non-JSON output on stdout"),
                    }
                }
                reader_alive.store(false, Ordering::SeqCst);
                let mut p = reader_pending.lock().await;
                for (_, tx) in p.drain() {
                    let _ = tx.send(Err(WorkerFailure {
                        message: "worker exited unexpectedly".into(),
                        status: 502,
                    }));
                }
            });
        }

        let gen = WorkerGen {
            child,
            stdin,
            pending,
            next_id: AtomicU64::new(1),
        };
        *self.gen.lock().await = Some(gen);
        self.alive.store(true, Ordering::SeqCst);
        info!(worker = self.id, pid, "worker spawned");
        Ok(())
    }

    /// Kill the current process (if any) and start a fresh one. Caller must
    /// hold `write_lock`.
    async fn recycle_locked(&self) -> Result<(), ApiError> {
        if let Some(mut gen) = self.gen.lock().await.take() {
            let _ = gen.stdin.shutdown().await;
            let _ = gen.child.kill().await;
            let _ = gen.child.wait().await;
        }
        self.alive.store(false, Ordering::SeqCst);
        self.launch()
            .await
            .map_err(|e| ApiError::Worker(format!("worker respawn failed: {e}")))?;
        Ok(())
    }

    /// Ensure a live process is present. Caller must hold `write_lock`.
    async fn ensure_alive_locked(&self) -> Result<(), ApiError> {
        if self.alive.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.recycle_locked().await
    }

    async fn invoke(
        &self,
        provider: &str,
        module: &str,
        func: &str,
        args: Value,
    ) -> Result<Value, ApiError> {
        let rx = {
            let _lock = self.write_lock.lock().await;
            self.ensure_alive_locked().await?;

            let mut gen_guard = self.gen.lock().await;
            let gen = gen_guard
                .as_mut()
                .ok_or_else(|| ApiError::Worker("worker not running".into()))?;

            let id = gen.next_id.fetch_add(1, Ordering::SeqCst);
            let (tx, rx) = oneshot::channel();
            gen.pending.lock().await.insert(id, tx);

            let msg = serde_json::json!({
                "id": id,
                "method": "call",
                "params": {
                    "provider": provider,
                    "module": module,
                    "fn": func,
                    "args": args,
                },
            });
            let line = serde_json::to_string(&msg)
                .map(|s| format!("{s}\n"))
                .map_err(|e| ApiError::Internal(e.to_string()))?;

            if let Err(e) = gen.stdin.write_all(line.as_bytes()).await {
                // Broken pipe: the worker died mid-call. Mark dead and surface.
                self.alive.store(false, Ordering::SeqCst);
                return Err(ApiError::Worker(format!("worker pipe error: {e}")));
            }
            if let Err(e) = gen.stdin.flush().await {
                self.alive.store(false, Ordering::SeqCst);
                return Err(ApiError::Worker(format!("worker flush error: {e}")));
            }
            rx
        };

        match tokio::time::timeout(
            std::time::Duration::from_millis(self.config.call_timeout_ms),
            rx,
        )
        .await
        {
            Ok(Ok(Ok(value))) => Ok(value),
            Ok(Ok(Err(failure))) => {
                let status = failure.status;
                Err(ApiError::Upstream {
                    status,
                    message: failure.message,
                })
            }
            Ok(Err(_)) => Err(ApiError::Worker("worker channel closed".into())),
            Err(_) => {
                warn!(
                    worker = self.id,
                    provider,
                    module,
                    timeout_ms = self.config.call_timeout_ms,
                    "worker call timed out; recycling worker"
                );
                let _lock = self.write_lock.lock().await;
                let _ = self.recycle_locked().await;
                Err(ApiError::Timeout)
            }
        }
    }
}

pub struct WorkerPool {
    workers: Vec<Arc<Worker>>,
    next: AtomicUsize,
    semaphore: Arc<Semaphore>,
}

impl WorkerPool {
    pub async fn new(config: Arc<Config>) -> anyhow::Result<Self> {
        let n = config.worker_count.max(1);
        let mut workers = Vec::with_capacity(n);
        for id in 0..n {
            match Worker::spawn(config.clone(), id).await {
                Ok(w) => workers.push(Arc::new(w)),
                Err(e) => warn!(id, "worker {id} spawn failed: {e}"),
            }
        }
        if workers.is_empty() {
            return Err(anyhow::anyhow!(
                "all node workers failed to spawn — is `node` on PATH and are dist bundles built? \
                 Run `npm run build` in the stream-providers root."
            ));
        }
        info!(count = workers.len(), "worker pool ready");
        Ok(Self {
            workers,
            next: AtomicUsize::new(0),
            semaphore: Arc::new(Semaphore::new(n)),
        })
    }

    pub async fn call(
        &self,
        provider: &str,
        module: &str,
        func: &str,
        args: Value,
    ) -> Result<Value, ApiError> {
        let _permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| ApiError::Internal("worker pool closed".into()))?;

        let workers = self.workers.len();
        for attempt in 0..workers {
            let idx = self.next.fetch_add(1, Ordering::Relaxed) % workers;
            match self.workers[idx]
                .invoke(provider, module, func, args.clone())
                .await
            {
                Ok(v) => return Ok(v),
                Err(e) => {
                    // Timeout is a hard bound: `invoke` already recycled the
                    // worker, and a fresh process will just re-run the same
                    // slow scrape. Retrying would multiply the wait by the
                    // pool size (e.g. 10 workers x 30s = 300s). Fail fast so
                    // a hung provider is bounded by CALL_TIMEOUT_MS.
                    if e.is_transient() && !matches!(e, ApiError::Timeout) && attempt + 1 < workers
                    {
                        warn!(worker = idx, provider, module, attempt, error = %e, "transient worker failure, trying another worker");
                    } else {
                        return Err(e);
                    }
                }
            }
        }
        unreachable!("worker pool exhausted retries")
    }

    pub async fn healthy(&self) -> bool {
        for w in &self.workers {
            if w.alive.load(Ordering::SeqCst) {
                return true;
            }
        }
        false
    }
}

impl crate::services::provider::ProviderGateway for WorkerPool {
    fn call<'a>(
        &'a self,
        provider: &'a str,
        module: &'a str,
        func: &'a str,
        args: Value,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Value, ApiError>> + Send + 'a>>
    {
        Box::pin(self.call(provider, module, func, args))
    }

    fn healthy(&self) -> std::pin::Pin<Box<dyn std::future::Future<Output = bool> + Send + '_>> {
        Box::pin(self.healthy())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_worker_line_success() {
        let line = r#"{"id":7,"ok":true,"data":{"title":"Inception"}}"#;
        let (id, result) = parse_worker_line(line).expect("parses");
        assert_eq!(id, 7);
        assert_eq!(result.unwrap(), serde_json::json!({"title": "Inception"}));
    }

    #[test]
    fn parse_worker_line_success_without_data() {
        let (_, result) = parse_worker_line(r#"{"id":1,"ok":true}"#).expect("parses");
        assert_eq!(result.unwrap(), Value::Null);
    }

    #[test]
    fn parse_worker_line_failure() {
        let line = r#"{"id":3,"ok":false,"error":{"message":"boom","status":502}}"#;
        let (id, result) = parse_worker_line(line).expect("parses");
        assert_eq!(id, 3);
        let failure = result.expect_err("error");
        assert_eq!(failure.message, "boom");
        assert_eq!(failure.status, 502);
    }

    #[test]
    fn parse_worker_line_failure_defaults() {
        let line = r#"{"id":4,"ok":false}"#;
        let (_, result) = parse_worker_line(line).expect("parses");
        let failure = result.expect_err("error");
        assert_eq!(failure.message, "provider worker error");
        assert_eq!(failure.status, 502);
    }

    #[test]
    fn parse_worker_line_ignores_garbage() {
        assert!(parse_worker_line("not json").is_none());
        assert!(parse_worker_line("").is_none());
        assert!(parse_worker_line(r#"{"foo":"bar"}"#).is_none());
    }
}
