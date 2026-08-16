# Configuration

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8787` | Bind port |
| `PROVIDERS_ROOT` | repo root (cwd) | Repo root containing `dist/` + `urls.json` |
| `URLS_MANIFEST_URL` | unset (bundles default to GitHub raw `urls.json`) | Single source of truth for the provider URL manifest endpoint (`getBaseUrl()`), set in `.env`. When set, the runtime fetches it over the network and falls back to the local `urls.json` on failure. Point it at your own `/urls.json` to drop the GitHub dependency |
| `DEFAULT_PROVIDER` | `vega` | Provider id used when `provider` is omitted |
| `WORKER_COUNT` | CPU count | Number of Node sidecar worker processes |
| `CALL_TIMEOUT_MS` | `75000` | Rust-side per-call timeout (hard cap) |
| `WORKER_TIMEOUT_MS` | `60000` | Provider `AbortSignal` timeout (fires first) |
| `SEARCH_ALL_TIMEOUT_MS` | `20000` | Per-provider cap for `/api/search-all` fan-out |
| `RATE_LIMIT_PER_MIN` | `600` | Per-IP quota |
| `RATE_LIMIT_BURST` | `120` | Per-IP burst allowance |
| `CACHE_CATALOG_SECS` | `300` | Catalog TTL |
| `CACHE_SEARCH_SECS` | `60` | Search TTL |
| `CACHE_META_SECS` | `60` | Meta TTL |
| `CACHE_EPISODES_SECS` | `300` | Episodes TTL |
| `CACHE_STREAM_SECS` | `30` | Stream TTL |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `TLS_CERT` / `TLS_KEY` | unset | Enable rustls TLS when set |
| `LOG_LEVEL` | `info` | `tracing` filter |

## Key Invariants

- `WORKER_TIMEOUT_MS` must be below `CALL_TIMEOUT_MS` so the provider abort
  fires before the gateway force-recycles the worker
- `SEARCH_ALL_TIMEOUT_MS` must not exceed `WORKER_TIMEOUT_MS` so slow providers
  are cut from `/api/search-all` before the worker abort fires
