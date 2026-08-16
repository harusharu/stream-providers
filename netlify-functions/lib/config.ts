// Runtime configuration, read from environment variables. Every knob has a
// sensible default so the gateway runs with no configuration at all — same
// contract as the Rust `Config::from_env`.
//
// | Variable                 | Default       | Purpose |
// | ------------------------ | ------------- | ------- |
// | `PROVIDERS_ROOT`         | cwd           | Repo root containing `dist/` + `urls.json` |
// | `URLS_MANIFEST_URL`      | unset         | Manifest endpoint for `getBaseUrl()` (set in `.env`); local copy fallback on failure |
// | `DEFAULT_PROVIDER`       | `vega`        | Provider used when `provider` is omitted |
// | `CALL_TIMEOUT_MS`        | `75000`       | Hard cap on any provider call |
// | `WORKER_TIMEOUT_MS`      | `60000`       | Provider `AbortSignal` timeout (fires first) |
// | `SEARCH_ALL_TIMEOUT_MS`  | `20000`       | Per-provider cap for `/api/search-all` |
// | `LOCAL_CONCURRENCY`      | `8`           | Max in-process provider calls at once |
// | `LOCAL_EXECUTION`        | `auto`        | `auto`\|`always`\|`never` |
// | `REMOTE_GATEWAY_HOSTS`   | ``            | Comma-separated fallback gateway base URLs |
// | `REMOTE_TIMEOUT_MS`      | `75000`       | Per-host HTTP timeout for remote backend |
// | `REMOTE_RETRIES`         | `1`           | Extra host attempts on transient failure |
// | `RATE_LIMIT_PER_MIN`     | `600`         | Per-IP quota (requests/minute) |
// | `RATE_LIMIT_BURST`       | `120`         | Per-IP burst allowance |
// | `CACHE_CATALOG_SECS`     | `300`         | Catalog TTL |
// | `CACHE_SEARCH_SECS`      | `60`          | Search TTL |
// | `CACHE_META_SECS`        | `60`          | Meta TTL |
// | `CACHE_EPISODES_SECS`    | `300`         | Episodes TTL |
// | `CACHE_STREAM_SECS`      | `30`          | Stream TTL |
// | `CORS_ORIGINS`           | `*`           | Comma-separated allowed origins |
// | `LOG_LEVEL`              | `info`        | `debug`\|`info`\|`warn`\|`error` |
// | `TRUST_PROXY`            | `true`        | Trust `x-forwarded-for`/`cf-connecting-ip` for rate limiting |

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LocalExecutionMode = 'auto' | 'always' | 'never';

export interface Config {
  /** Absolute path to the stream-providers repo root. */
  providersRoot: string;
  /** Provider id used when a request omits `provider`. */
  defaultProvider: string;
  /** Hard cap (ms) on any provider call. */
  callTimeoutMs: number;
  /** Provider `AbortSignal` timeout (ms); must be below `callTimeoutMs`. */
  workerTimeoutMs: number;
  /** Per-provider cap (ms) for the `/api/search-all` fan-out. */
  searchAllTimeoutMs: number;
  /** Max concurrent in-process provider calls. */
  localConcurrency: number;
  /** When to use in-process bundle execution. */
  localExecution: LocalExecutionMode;
  /** Remote gateway base URLs to fail over across (multi-host). */
  remoteGatewayHosts: string[];
  /** Per-host HTTP timeout (ms) for the remote backend. */
  remoteTimeoutMs: number;
  /** Extra host attempts on transient failure (0 = no retry). */
  remoteRetries: number;
  /** Per-IP rate limit: requests per minute. */
  rateLimitPerMin: number;
  /** Per-IP rate limit: burst allowance. */
  rateLimitBurst: number;
  /** Catalog endpoint TTL (s). */
  cacheCatalogSecs: number;
  /** Search endpoint TTL (s). */
  cacheSearchSecs: number;
  /** Meta endpoint TTL (s). */
  cacheMetaSecs: number;
  /** Episodes endpoint TTL (s). */
  cacheEpisodesSecs: number;
  /** Stream endpoint TTL (s). */
  cacheStreamSecs: number;
  /** CORS origin allow-list (`*` = all). */
  corsOrigins: string[];
  /** Log level filter. */
  logLevel: LogLevel;
  /** Trust forwarding headers for client IP. */
  trustProxy: boolean;
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value;
}

function list(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseMode(value: string | undefined): LocalExecutionMode {
  const v = str(value, 'auto').toLowerCase();
  return v === 'always' || v === 'never' ? v : 'auto';
}

function parseLevel(value: string | undefined): LogLevel {
  const v = str(value, 'info').toLowerCase();
  return v === 'debug' || v === 'warn' || v === 'error' ? v : 'info';
}

/** Parse configuration from environment variables. */
export function fromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  const providersRoot =
    env.PROVIDERS_ROOT && env.PROVIDERS_ROOT.trim() !== ''
      ? env.PROVIDERS_ROOT.trim()
      : process.cwd();

  const callTimeoutMs = int(env.CALL_TIMEOUT_MS, 75_000);
  const workerTimeoutMs = int(env.WORKER_TIMEOUT_MS, 60_000);
  const searchAllTimeoutMs = int(env.SEARCH_ALL_TIMEOUT_MS, 20_000);

  return {
    providersRoot,
    defaultProvider: str(env.DEFAULT_PROVIDER, 'vega'),
    callTimeoutMs,
    workerTimeoutMs,
    searchAllTimeoutMs,
    localConcurrency: Math.max(1, int(env.LOCAL_CONCURRENCY, 8)),
    localExecution: parseMode(env.LOCAL_EXECUTION),
    remoteGatewayHosts: list(env.REMOTE_GATEWAY_HOSTS),
    remoteTimeoutMs: int(env.REMOTE_TIMEOUT_MS, 75_000),
    remoteRetries: Math.max(0, int(env.REMOTE_RETRIES, 1)),
    rateLimitPerMin: int(env.RATE_LIMIT_PER_MIN, 600),
    rateLimitBurst: int(env.RATE_LIMIT_BURST, 120),
    cacheCatalogSecs: int(env.CACHE_CATALOG_SECS, 300),
    cacheSearchSecs: int(env.CACHE_SEARCH_SECS, 60),
    cacheMetaSecs: int(env.CACHE_META_SECS, 60),
    cacheEpisodesSecs: int(env.CACHE_EPISODES_SECS, 300),
    cacheStreamSecs: int(env.CACHE_STREAM_SECS, 30),
    corsOrigins: list(env.CORS_ORIGINS).length > 0 ? list(env.CORS_ORIGINS) : ['*'],
    logLevel: parseLevel(env.LOG_LEVEL),
    trustProxy: str(env.TRUST_PROXY, 'true').toLowerCase() !== 'false',
  };
}

/** Validate cross-field invariants, failing fast at startup. */
export function validate(config: Config): string[] {
  const problems: string[] = [];
  if (config.callTimeoutMs < 1) problems.push('CALL_TIMEOUT_MS must be >= 1');
  if (config.workerTimeoutMs < 1) problems.push('WORKER_TIMEOUT_MS must be >= 1');
  if (config.workerTimeoutMs >= config.callTimeoutMs)
    problems.push('WORKER_TIMEOUT_MS must be below CALL_TIMEOUT_MS');
  if (config.searchAllTimeoutMs < 1) problems.push('SEARCH_ALL_TIMEOUT_MS must be >= 1');
  if (config.searchAllTimeoutMs > config.workerTimeoutMs)
    problems.push('SEARCH_ALL_TIMEOUT_MS must not exceed WORKER_TIMEOUT_MS');
  if (config.rateLimitPerMin < 1) problems.push('RATE_LIMIT_PER_MIN must be >= 1');
  if (config.rateLimitBurst < 1) problems.push('RATE_LIMIT_BURST must be >= 1');
  if (config.defaultProvider.trim() === '') problems.push('DEFAULT_PROVIDER must not be empty');
  return problems;
}
