//! Runtime configuration, read from environment variables (optionally via a
//! `.env` file loaded by `dotenvy`). Every knob has a sensible default, so the
//! binary runs with no configuration at all.
//!
//! The canonical list of variables and their defaults is documented in
//! `.env.example`; the table below summarises them.
//!
//! | Variable | Default | Purpose |
//! | --- | --- | --- |
//! | `HOST` | `0.0.0.0` | Bind address |
//! | `PORT` | `8787` | Bind port |
//! | `PROVIDERS_ROOT` | repo root (cwd) | Repo root containing `dist/` + `urls.json` |
//! | `DEFAULT_PROVIDER` | `vega` | Provider id used when `provider` is omitted |
//! | `WORKER_COUNT` | CPU count | Number of Node sidecar processes |
//! | `CALL_TIMEOUT_MS` | `75000` | Rust-side per-call timeout (hard cap) |
//! | `WORKER_TIMEOUT_MS` | `60000` | Provider `AbortSignal` timeout (fires first) |
//! | `SEARCH_ALL_TIMEOUT_MS` | `20000` | Per-provider cap for `/api/search-all` fan-out |
//! | `RATE_LIMIT_PER_MIN` | `600` | Per-IP quota |
//! | `RATE_LIMIT_BURST` | `120` | Per-IP burst allowance |
//! | `CACHE_CATALOG_SECS` | `300` | Catalog TTL |
//! | `CACHE_SEARCH_SECS` | `60` | Search TTL |
//! | `CACHE_META_SECS` | `60` | Meta TTL |
//! | `CACHE_EPISODES_SECS` | `300` | Episodes TTL |
//! | `CACHE_STREAM_SECS` | `30` | Stream TTL |
//! | `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
//! | `TLS_CERT` / `TLS_KEY` | unset | Enable rustls TLS |
//! | `LOG_LEVEL` | `info` | `tracing` filter |
//!
//! See [`Config::from_env`].

use std::path::PathBuf;

/// Process-wide configuration. Constructed once at startup and shared (via
/// [`std::sync::Arc`]) with the worker pool and every request handler.
#[derive(Clone, Debug)]
pub struct Config {
    /// Bind address.
    pub host: String,
    /// Bind port.
    pub port: u16,
    /// Absolute path to the stream-providers repo root.
    pub providers_root: PathBuf,
    /// Absolute path to the Node sidecar entrypoint (`worker/worker.js`).
    pub worker_script: PathBuf,
    /// Provider id used when a request omits `provider`.
    pub default_provider: String,
    /// Number of Node worker processes in the pool.
    pub worker_count: usize,
    /// Per-call timeout seen by the Rust gateway, in milliseconds.
    pub call_timeout_ms: u64,
    /// Timeout wired to the provider's `AbortSignal`, in milliseconds.
    pub worker_timeout_ms: u64,
    /// Per-provider timeout for the `/api/search-all` fan-out, in
    /// milliseconds. Below [`Self::worker_timeout_ms`] so slow providers are
    /// cut from the aggregated response without tying up a worker for the
    /// full call timeout.
    pub search_all_timeout_ms: u64,
    /// Per-IP rate limit: requests per minute.
    pub rate_limit_per_min: u32,
    /// Per-IP rate limit: burst allowance.
    pub rate_limit_burst: u32,
    /// Catalog endpoint TTL, in seconds.
    pub cache_catalog_secs: u64,
    /// Search endpoint TTL, in seconds.
    pub cache_search_secs: u64,
    /// Meta endpoint TTL, in seconds.
    pub cache_meta_secs: u64,
    /// Episodes endpoint TTL, in seconds.
    pub cache_episodes_secs: u64,
    /// Stream endpoint TTL, in seconds.
    pub cache_stream_secs: u64,
    /// Comma-separated CORS allow-list (`*` allows all origins).
    pub cors_origins: Vec<String>,
    /// Path to a PEM certificate chain; enables rustls TLS when set.
    pub tls_cert: Option<PathBuf>,
    /// Path to a PEM private key; enables rustls TLS when set.
    pub tls_key: Option<PathBuf>,
    /// `tracing` log level filter.
    pub log_level: String,
}

fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_usize(key: &str, default: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var(key).ok().map(PathBuf::from)
}

impl Config {
    /// Parse configuration from environment variables (optionally loading a
    /// `.env` file first), then validate the invariants.
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let providers_root = env_path("PROVIDERS_ROOT").unwrap_or_else(|| {
            // Default to the stream-providers repo root (this directory —
            // the Rust project now lives at the repo root).
            std::env::current_dir()
                .ok()
                .or_else(|| Some(PathBuf::from(".")))
                .unwrap()
        });
        let worker_script = providers_root.join("worker").join("worker.js");

        let default_provider = std::env::var("DEFAULT_PROVIDER").unwrap_or_else(|_| "vega".into());

        let config = Config {
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env_u16("PORT", 8787),
            providers_root,
            worker_script,
            default_provider,
            worker_count: env_usize(
                "WORKER_COUNT",
                std::thread::available_parallelism()
                    .map(|n| n.get())
                    .unwrap_or(4),
            ),
            call_timeout_ms: env_u64("CALL_TIMEOUT_MS", 75_000),
            worker_timeout_ms: env_u64("WORKER_TIMEOUT_MS", 60_000),
            search_all_timeout_ms: env_u64("SEARCH_ALL_TIMEOUT_MS", 20_000),
            rate_limit_per_min: env_u32("RATE_LIMIT_PER_MIN", 600),
            rate_limit_burst: env_u32("RATE_LIMIT_BURST", 120),
            cache_catalog_secs: env_u64("CACHE_CATALOG_SECS", 300),
            cache_search_secs: env_u64("CACHE_SEARCH_SECS", 60),
            cache_meta_secs: env_u64("CACHE_META_SECS", 60),
            cache_episodes_secs: env_u64("CACHE_EPISODES_SECS", 300),
            cache_stream_secs: env_u64("CACHE_STREAM_SECS", 30),
            cors_origins: std::env::var("CORS_ORIGINS")
                .map(|s| {
                    s.split(',')
                        .map(|x| x.trim().to_string())
                        .filter(|x| !x.is_empty())
                        .collect()
                })
                .unwrap_or_else(|_| vec!["*".to_string()]),
            tls_cert: env_path("TLS_CERT"),
            tls_key: env_path("TLS_KEY"),
            log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()),
        };

        config.validate()?;
        Ok(config)
    }

    /// Validate cross-field invariants, failing fast at startup instead of
    /// silently misbehaving mid-flight.
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.port == 0 {
            anyhow::bail!("PORT must be in 1..=65535, got 0");
        }
        if self.worker_count < 1 {
            anyhow::bail!("WORKER_COUNT must be >= 1, got {}", self.worker_count);
        }
        if self.call_timeout_ms < 1 {
            anyhow::bail!("CALL_TIMEOUT_MS must be >= 1, got {}", self.call_timeout_ms);
        }
        if self.worker_timeout_ms < 1 {
            anyhow::bail!(
                "WORKER_TIMEOUT_MS must be >= 1, got {}",
                self.worker_timeout_ms
            );
        }
        if self.worker_timeout_ms >= self.call_timeout_ms {
            anyhow::bail!(
                "WORKER_TIMEOUT_MS ({}) must be below CALL_TIMEOUT_MS ({}) so the \
                 provider abort fires before the gateway force-recycles the worker",
                self.worker_timeout_ms,
                self.call_timeout_ms
            );
        }
        if self.search_all_timeout_ms < 1 {
            anyhow::bail!(
                "SEARCH_ALL_TIMEOUT_MS must be >= 1, got {}",
                self.search_all_timeout_ms
            );
        }
        if self.search_all_timeout_ms > self.worker_timeout_ms {
            anyhow::bail!(
                "SEARCH_ALL_TIMEOUT_MS ({}) must not exceed WORKER_TIMEOUT_MS ({}) so \
                 slow providers are cut from /api/search-all before the worker abort fires",
                self.search_all_timeout_ms,
                self.worker_timeout_ms
            );
        }
        if self.rate_limit_per_min < 1 {
            anyhow::bail!(
                "RATE_LIMIT_PER_MIN must be >= 1, got {}",
                self.rate_limit_per_min
            );
        }
        if self.rate_limit_burst < 1 {
            anyhow::bail!(
                "RATE_LIMIT_BURST must be >= 1, got {}",
                self.rate_limit_burst
            );
        }
        if self.default_provider.trim().is_empty() {
            anyhow::bail!("DEFAULT_PROVIDER must not be empty");
        }
        Ok(())
    }
}

fn env_u16(key: &str, default: u16) -> u16 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Serialize env manipulation: tests that set process-global env vars must
    /// not race with each other (cargo runs test threads in parallel).
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvGuard;
    impl EnvGuard {
        fn acquire() -> std::sync::MutexGuard<'static, ()> {
            ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner())
        }
    }

    fn with_env<K: AsRef<str>, V: AsRef<str>>(kvs: &[(K, V)], f: impl FnOnce()) {
        let _guard = EnvGuard::acquire();
        let mut restore = Vec::new();
        for (k, v) in kvs {
            let k = k.as_ref();
            restore.push((k.to_string(), std::env::var(k).ok()));
            std::env::set_var(k, v.as_ref());
        }
        f();
        for (k, old) in restore {
            match old {
                Some(v) => std::env::set_var(k, v),
                None => std::env::remove_var(k),
            }
        }
    }

    #[test]
    fn defaults_applied_when_unset() {
        with_env(&[("CLEAR", "1")], || {
            // Remove every var the defaults depend on, then re-parse.
            for key in [
                "HOST",
                "PORT",
                "DEFAULT_PROVIDER",
                "LOG_LEVEL",
                "CORS_ORIGINS",
            ] {
                std::env::remove_var(key);
            }
            let c = Config::from_env().expect("parses");
            assert_eq!(c.host, "0.0.0.0");
            assert_eq!(c.port, 8787);
            assert_eq!(c.default_provider, "vega");
            assert_eq!(c.log_level, "info");
            assert_eq!(c.cors_origins, vec!["*".to_string()]);
        });
    }

    #[test]
    fn parses_typed_env_values() {
        let tmp = tempfile::tempdir().unwrap();
        with_env(
            &[
                ("PORT", "9090"),
                ("WORKER_COUNT", "3"),
                ("CALL_TIMEOUT_MS", "5000"),
                ("WORKER_TIMEOUT_MS", "4000"),
                ("SEARCH_ALL_TIMEOUT_MS", "3000"),
                ("RATE_LIMIT_PER_MIN", "100"),
                ("RATE_LIMIT_BURST", "20"),
                ("CORS_ORIGINS", "https://a.example, https://b.example"),
                ("DEFAULT_PROVIDER", "showbox"),
                ("LOG_LEVEL", "debug"),
                ("PROVIDERS_ROOT", tmp.path().to_str().unwrap()),
            ],
            || {
                let c = Config::from_env().expect("parses");
                assert_eq!(c.port, 9090);
                assert_eq!(c.worker_count, 3);
                assert_eq!(c.call_timeout_ms, 5000);
                assert_eq!(c.worker_timeout_ms, 4000);
                assert_eq!(c.search_all_timeout_ms, 3000);
                assert_eq!(c.rate_limit_per_min, 100);
                assert_eq!(c.rate_limit_burst, 20);
                assert_eq!(
                    c.cors_origins,
                    vec![
                        "https://a.example".to_string(),
                        "https://b.example".to_string()
                    ]
                );
                assert_eq!(c.default_provider, "showbox");
                assert_eq!(c.log_level, "debug");
                assert_eq!(c.providers_root, tmp.path());
                assert_eq!(c.worker_script, tmp.path().join("worker").join("worker.js"));
            },
        );
    }

    #[test]
    fn invalid_port_fails_fast() {
        with_env(&[("PORT", "0")], || {
            assert!(Config::from_env().is_err());
        });
    }

    #[test]
    fn invalid_worker_count_fails_fast() {
        with_env(&[("WORKER_COUNT", "0")], || {
            assert!(Config::from_env().is_err());
        });
    }

    #[test]
    fn invalid_timeout_fails_fast() {
        with_env(&[("CALL_TIMEOUT_MS", "0")], || {
            assert!(Config::from_env().is_err());
        });
    }

    #[test]
    fn worker_timeout_below_call_timeout_required() {
        with_env(
            &[("CALL_TIMEOUT_MS", "10000"), ("WORKER_TIMEOUT_MS", "10000")],
            || {
                assert!(
                    Config::from_env().is_err(),
                    "equal timeouts must fail validation"
                );
            },
        );
    }

    #[test]
    fn search_all_timeout_cannot_exceed_worker_timeout() {
        with_env(
            &[
                ("WORKER_TIMEOUT_MS", "5000"),
                ("SEARCH_ALL_TIMEOUT_MS", "6000"),
            ],
            || {
                assert!(
                    Config::from_env().is_err(),
                    "aggregation timeout above the worker abort must fail"
                );
            },
        );
    }
}
