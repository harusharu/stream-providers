# Harustream Provider API

A high-performance Rust gateway that exposes the `stream-providers` JavaScript
provider bundles as a REST API compatible with the **harustream** Next.js app.

Rust (Actix) owns the public HTTP surface — validation, rate limiting, caching,
TLS, request tracing — and executes the existing TypeScript provider bundles in
isolated Node sidecar worker processes that use `curl-cffi-node` for TLS
fingerprint impersonation (required to bypass Cloudflare/WAF on upstream
hosters).

## Why not just serve the bundles?

- `stream-providers` ships browser bundles (`dist/*.js`) with no HTTP API.
- `dist/providerContext.js` is broken in plain Node ("Class extends value
  undefined is not a constructor or null"), so the sidecar worker
  (`rust-api/worker/context.js`) re-implements the provider context in plain JS.
- Some upstream sites require a real Chrome TLS fingerprint; the Node workers
  satisfy that via `curl-cffi-node` (`impersonate: "chrome120"`).

## Repository layout

The repo hosts three independent code trees plus shared payloads:

```
/
├── rust-api/          # Rust/Actix gateway (src/, Cargo.toml, worker/, tests/)
├── hono-api/          # Node/Hono gateway (own package.json, deployable to Netlify/Vercel/plain Node)
├── providers/         # TypeScript provider sources (single source of truth)
├── dist/              # built provider bundles (npm run build output)
├── static/            # shared dashboard (served by both gateways)
├── scripts/           # scripts shared by 2+ components (api-suite.js)
├── manifest.json      # shared provider registry
├── urls.json          # shared provider URL manifest (auto-updated by CI)
└── justfile           # command runner (just, not make)
```

## Architecture

The crate is split into small, single-purpose modules:

```
rust-api/src/
├── main.rs           binary entrypoint: config → state → bind (HTTP/TLS) → graceful shutdown
├── lib.rs            crate docs + module tree
├── app.rs            build_app(): routes, CORS, security middleware, 404 handler
├── state.rs          AppState (config, manifest, gateway, cache bundle)
├── services/
│   └── provider.rs   ProviderGateway trait (catalog/search/meta/episodes/stream/healthy)
├── worker.rs         WorkerPool: spawns Node sidecars, ProviderGateway impl, IPC parse
├── handlers/         one module per endpoint domain (catalog, search, search_all, meta, episodes, stream, system)
├── cache.rs          per-endpoint moka TTL caches
├── security.rs       request-id, governor rate limiting, security headers
├── config.rs         typed env config + validation
├── manifest.rs       provider manifest loading
├── model.rs          response shaping / type inference
├── error.rs          ApiError taxonomy → HTTP status + envelope code
├── telemetry.rs      tracing init
└── tls.rs            rustls server config from PEM files
```

```
harustream (Next.js)
   │  GET /api/catalog|search|search-all|meta|episodes|stream
   ▼
Rust API gateway (Actix)            ← validation, rate limit, cache, TLS, request-id
   │  newline-delimited JSON over stdin/stdout
   ▼
Node worker pool (curl-cffi-node)   ← loads dist/<provider>/<module>.js, executes
   │
   ▼
Upstream streaming sites
```

- Worker protocol: `{"id":N,"method":"call","params":{...}}` → `{"id":N,"ok":true,"data":...}`.
  Provider `console.log` is redirected to stderr so it can never corrupt the
  stdout IPC channel.
- `getBaseUrl()` reads `urls.json` from the local project directory by
  default — the repo keeps that file fresh via the `check-urls` GitHub Action
  (daily cron, commits working URLs). Setting the optional `URLS_MANIFEST_URL`
  (see `.env.example`) switches to a network fetch of your own hosted copy
  instead, falling back to the local file on failure.

## Endpoints

| Method | Path | Params | Notes |
| --- | --- | --- | --- |
| GET | `/api/catalog` | `provider` | Provider home/genre list |
| GET | `/api/search` | `provider`, `query`, `page` | Search results |
| GET | `/api/search-all` | `query`, `page`, `providers` | Aggregated search across all providers; items tagged `provider`/`providerName`, plus `total`/`providers`/`failed` |
| GET | `/api/meta` | `provider`, `link` | Item metadata |
| GET | `/api/episodes` | `provider`, `url` | Episode list |
| GET | `/api/stream` | `provider`, `link`, `type` | Playable stream links |
| GET | `/health` | — | Liveness + worker health |
| GET | `/providers` | — | Manifest contents |
| GET | `/` | — | API info |

All provider responses are wrapped as `{"success":true,"data":...}` (harustream
also accepts raw arrays). Errors use `{"success":false,"code":...,"error":...}`
with appropriate HTTP statuses (400 validation, 429 rate limit, 502 upstream,
504 timeout).

## Running

Requirements: Rust 1.85+ toolchain, Node 20+ (for `curl-cffi-node`), and the
`stream-providers` repo (its `node_modules` must include `axios`, `cheerio`,
`curl-cffi-node`).

```bash
cd stream-providers
cp .env.example .env            # optional; defaults work
cd rust-api && cargo build --release
./target/release/harustream-provider-api
```

Then point harustream at it:

```
NEXT_PUBLIC_PROVIDER_API_URL=http://localhost:8787
```

## Configuration

See `.env.example`. Highlights:

- `PROVIDERS_ROOT` — repo root containing `dist/` and `urls.json` (defaults to
  the current working directory).
- `WORKER_COUNT` — Node worker pool size (default: CPU count).
- `RATE_LIMIT_PER_MIN` / `RATE_LIMIT_BURST` — per-IP quota; `/`, `/health`,
  `/providers` are exempt.
- `CACHE_*_SECS` — per-endpoint moka TTLs.
- `CORS_ORIGINS` — comma-separated allowed origins (`*` = allow all).
- `TLS_CERT` / `TLS_KEY` — enable built-in rustls TLS; otherwise bind plain HTTP
  and terminate TLS at a proxy.

## Docker

```bash
docker build -t harustream-provider-api .
docker run -p 8787:8787 \
  -e PROVIDERS_ROOT=/opt/providers \
  -v /path/to/stream-providers:/opt/providers \
  harustream-provider-api
```

## Development

Commands run through `just` (see the `justfile` for the full list). Provider
bundles are compiled with `npm run build` (they are the payload both gateways
execute).

Prerequisites: Rust toolchain, Node 20+ (runtime dep for the worker pool), and
the repo's `node_modules` (for `axios`, `cheerio`, `curl-cffi-node`).

### Quick start

```bash
just setup               # once: npm ci at root + in hono-api/
npm run build            # once (and after provider changes): compile bundles

just dev                 # cargo run (debug) with defaults
just dev-node            # Hono gateway on the same port
```

### justfile targets

```bash
just dev         # run the Rust gateway in debug mode on :8787
just dev-node    # run the Hono gateway on the same port (no Rust)
just watch       # auto-reload on Rust + provider bundle changes (cargo-watch)
just test        # unit + integration tests (no Node, no network)
just check       # fmt + clippy + tests + both typechecks — the full CI gate
just lint        # cargo clippy --all-targets -- -D warnings
just fmt         # cargo fmt (in place)
just release     # optimized build
just docker      # container image
```

`just watch` (equivalently `./rust-api/scripts/dev.sh`) watches
`rust-api/src/`, `rust-api/worker/`, and `providers/`; it rebuilds the provider
bundles on TS changes and reloads the gateway, so editing a provider or the
Rust code gives you a live dev loop.

```bash
just watch       # installs cargo-watch on first use, then runs + reloads
# or
./rust-api/scripts/dev.sh
```

### Configuration in dev

Defaults mirror `Config::from_env`; override via environment or a `.env` file
(`cp .env.example .env`):

```bash
just dev PORT=8787 HOST=0.0.0.0 LOG_LEVEL=debug
```

### Tests

Fast, deterministic tests run with no Node runtime and no network:

```bash
cd rust-api && cargo test --lib            # unit tests (config, manifest, cache, worker, security, tls, error)
cd rust-api && cargo test --test integration   # full app through a mock gateway (no Node, no network)
```

The integration tests spin up the real Actix app with a `MockGateway` and cover
the HTTP contract: envelopes, cache headers, caching behaviour, validation
errors, security headers, request-id, rate limiting, CORS, and the operational
endpoints.

### End-to-end provider sweep

A real-network sweep that drives every enabled provider through
catalog → search → meta → episodes/stream via the full Rust stack (real Node
workers). Requires the repo's `node_modules` and a built `dist/`:

```bash
npm ci && npm run build            # from the stream-providers repo root
cd rust-api && cargo test --test e2e -- --ignored --test-threads=1
```

The sweep is `#[ignore]`d and gated to manual CI runs because upstream hosting
sites are flaky (dead links, captchas, 502s) — it verifies the gateway end-to-end
but individual provider results are expected to vary day to day.

### CI

`.github/workflows/rust-api.yml` runs fmt, clippy, unit + integration tests, and
docs on every push/PR touching `rust-api/src/`, `rust-api/worker/`,
`rust-api/tests/`, `rust-api/Cargo.*` or `manifest.json`. The e2e sweep is a
separate `workflow_dispatch`-only job.

Worker changes live in `rust-api/worker/worker.js` (protocol) and
`rust-api/worker/context.js` (provider runtime shim) and can be smoke-tested
independently:

```bash
PROVIDERS_ROOT=$(pwd) node rust-api/worker/worker.js
printf '%s\n' '{"id":1,"method":"call","params":{"provider":"vega","module":"catalog","fn":"catalog","args":{}}}' | PROVIDERS_ROOT=$(pwd) node rust-api/worker/worker.js
```