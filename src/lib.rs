//! # harustream-provider-api
//!
//! A high-performance, security-hardened **Rust / Actix** gateway that turns
//! the [`stream-providers`](https://github.com/harusharu/stream-providers)
//! JavaScript provider bundles into a clean REST API consumed by the
//! [`harustream`](https://github.com/harusharu/harustream) web app.
//!
//! Rust owns the entire public HTTP surface — validation, rate limiting,
//! caching, TLS, request tracing — while the fragile, evolving scraping logic
//! stays inside **isolated Node sidecar worker processes** that use
//! `curl-cffi-node` for TLS fingerprint impersonation.
//!
//! ```text
//! ┌────────────────────────────────────────────────────────────────┐
//! │ harustream (Next.js)                                          │
//! │  GET /api/catalog|search|search-all|meta|episodes|stream   │
//! └───────────────────────────────┬────────────────────────────────┘
//!                                 ▼
//! ┌────────────────────────────────────────────────────────────────┐
//! │ Rust gateway (this crate)     validation · rate limit · cache  │
//! │                               TLS · request-id · CORS          │
//! └───────────────────────────────┬────────────────────────────────┘
//!                                 │  newline-delimited JSON over stdin/stdout
//!                                 ▼
//! ┌────────────────────────────────────────────────────────────────┐
//! │ Node worker pool (curl-cffi-node, impersonate:"chrome120")      │
//! │  loads dist/<provider>/<module>.js and executes the bundle      │
//! └───────────────────────────────┬────────────────────────────────┘
//!                                 ▼
//! ┌────────────────────────────────────────────────────────────────┐
//! │ Upstream streaming sites (vegamovies, showbox, …)               │
//! └────────────────────────────────────────────────────────────────┘
//! ```
//!
//! # Why this design
//!
//! The `stream-providers` repo ships browser bundles (`dist/*.js`) with **no
//! HTTP API** and its `dist/providerContext.js` is **broken in plain Node**
//! ("Class extends value undefined is not a constructor or null"). Running the
//! bundles directly also fails against upstreams that require a real Chrome
//! TLS fingerprint. This crate solves all three problems:
//!
//! | Problem | Solution |
//! | --- | --- |
//! | Bundles expose no REST API | The Rust gateway adds one (`/api/*`) |
//! | `providerContext.js` broken in Node | `worker/context.js` re-implements the provider runtime (axios adapter + fetch shim + cheerio) in plain JS |
//! | Upstream blocks default TLS | Node workers use `curl-cffi-node` with `impersonate: "chrome120"` |
//! | Slow scraping calls block the server | A bounded worker pool + per-endpoint TTL caching |
//! | Public API abuse | Per-IP rate limiting, CORS allow-listing, request-id tracing |
//!
//! # Request lifecycle
//!
//! 1. A client hits one of the [`handlers`] (or `/health`,
//!    `/providers`, `/info`, `/`).
//! 2. [`security::Security`] middleware assigns an
//!    `x-request-id`, enforces the per-IP rate limit, and stamps security
//!    headers on the response.
//! 3. The handler validates query params ([`model`]) and
//!    checks the in-memory TTL cache ([`cache`]).
//! 4. On a miss, the handler calls the
//!    [`services::provider::ProviderGateway`] — the Node
//!    [`worker::WorkerPool`] in production — sending a JSON-RPC
//!    message over stdin ([`worker`]).
//! 5. The worker loads `dist/<provider>/<module>.js`, calls the bundle's
//!    exported function, and replies over stdout.
//! 6. The handler wraps the result in the `{ success, data }` envelope and
//!    caches it.
//!
//! # Modules
//!
//! - [`config`] — environment configuration + validation
//! - [`state`] — the shared [`state::AppState`] handed to handlers
//! - [`app`] — the Actix `App` factory (routes, CORS, middleware)
//! - [`handlers`] — the REST endpoints, split by domain
//! - [`services`] — the [`services::provider::ProviderGateway`] port
//! - [`model`] — query param validation + media type inference
//! - [`worker`] — the Node worker pool / IPC protocol (the production gateway)
//! - [`cache`] — per-endpoint TTL caching
//! - [`manifest`] — provider registry parsing
//! - [`security`] — request-id, rate limiting, headers
//! - [`error`] — error taxonomy + HTTP mapping
//! - [`telemetry`] — `tracing` setup
//! - [`tls`] — optional rustls termination
//!
//! # Endpoint reference
//!
//! All provider payloads are wrapped as `{"success": true, "data": …}`. The
//! harustream client unwraps `data` when the envelope is present and otherwise
//! treats the raw response as the payload, so both shapes are supported.
//!
//! | Method | Path | Params | Returns |
//! | --- | --- | --- | --- |
//! | GET | `/api/catalog` | `provider` | Home/genre categories `[{title, filter}]` |
//! | GET | `/api/search` | `provider`, `query`, `page` | Search results `[{title, link, image, type}]` |
//! | GET | `/api/search-all` | `query`, `page`, `providers` | Aggregated search across all providers, each item tagged `provider`/`providerName`; plus `total`/`providers`/`failed` counters |
//! | GET | `/api/meta` | `provider`, `link` | Full title metadata |
//! | GET | `/api/episodes` | `provider`, `url` | Episode list `[{title, link}]` |
//! | GET | `/api/stream` | `provider`, `link`, `type` | Playable sources `[{server, link, type}]` |
//! | GET | `/health` | — | Liveness + worker pool health |
//! | GET | `/providers` | — | Full manifest entries |
//! | GET | `/info` | — | Crate name/version/endpoints |
//! | GET | `/` | — | Human dashboard (HTML) |
//!
//! `provider` defaults to [`config::Config::default_provider`]
//! (usually `vega`). `type` accepts `movie`/`series`/`tv`/`show` and
//! normalises to `movie` or `series`.
//!
//! # Worker IPC protocol
//!
//! Workers speak newline-delimited JSON over stdin/stdout. **stdout carries
//! only the protocol** — all provider `console.log` output is redirected to
//! stderr so a scraper's debug output can never corrupt the channel.
//!
//! ```text
//! in:  {"id":1,"method":"call","params":{"provider":"vega","module":"posts","fn":"getSearchPosts","args":{…}}}
//! out: {"id":1,"ok":true,"data":{…}}
//! out: {"id":1,"ok":false,"error":{"message":"…","status":502}}
//! in:  {"id":2,"method":"ping"}
//! out: {"id":2,"ok":true,"data":{"pong":true}}
//! ```
//!
//! See [`worker`] for the pool's concurrency model
//! (round-robin + semaphore), timeout handling (recycle on timeout), and
//! transient-failure retry.
//!
//! # Provider context shim
//!
//! Provider bundles import a `providerContext` object. The original
//! `dist/providerContext.js` does not load under plain Node, so
//! `worker/context.js` builds an equivalent at runtime:
//!
//! - `axios` — the real `axios` from the repo's `node_modules`, patched to use
//!   `curl-cffi-node` so requests impersonate Chrome 120.
//! - `cheerio` — the real `cheerio` for HTML scraping.
//! - `commonHeaders`, `Aes`, `AbortSignal`, `providerValue` — thin shims.
//! - `global.fetch` — passes every request through to the real network.
//!   `getBaseUrl()` reads its manifest endpoint from `URLS_MANIFEST_URL`
//!   (set in `.env`, the single source of truth). When that variable is set,
//!   a failed manifest fetch is served from the locally-deployed `urls.json`
//!   (identical data) instead; when unset, the bundles fetch the `urls.json`
//!   committed to this repo directly from GitHub raw.
//!
//! Workers must run with `cwd = PROVIDERS_ROOT` so `axios`, `cheerio`, and
//! `curl-cffi-node` resolve from the repo's `node_modules`.
//!
//! # Security model
//!
//! - **Per-IP rate limiting** (governor) with configurable quota/burst;
//!   `/`, `/health`, `/providers`, `/info` are exempt.
//! - **`x-request-id`** generated per request and echoed in logs + response.
//! - **Security headers** on every response: `X-Content-Type-Options`,
//!   `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`.
//! - **CORS** allow-listing via [`config::Config::cors_origins`]
//!   (defaults to `*`).
//! - **Optional TLS** via rustls when `TLS_CERT` / `TLS_KEY` are set; otherwise
//!   intended to sit behind a TLS-terminating proxy.
//!
//! # Error taxonomy
//!
//! Every error maps to a real HTTP status that harustream's
//! `ProviderError` can translate (`429 → RATE_LIMITED`, `503 → UNAVAILABLE`,
//! `5xx → UPSTREAM_ERROR`, …). See [`error`].
//!
//! | Status | Meaning |
//! | --- | --- |
//! | 400 | Unknown provider / missing required param |
//! | 422 | Invalid param (e.g. too long) |
//! | 429 | Rate limited |
//! | 502 | Worker failure or upstream provider error |
//! | 504 | Worker call timed out |
//! | 500 | Internal error |
//!
//! # Media type inference
//!
//! The provider bundles return bare `{title, link, image}` posts with no
//! `type` field, but harustream's home feed splits rails by media type. The
//! gateway therefore infers `type` per item ([`model::apply_type_hints`]):
//!
//! - Showbox-style links encode it: `/movie/…` → movie, `/tv/…` → series.
//! - Otherwise title/link markers decide: `season`, `episode`, `web-series`,
//!   `s01e`, … → series; everything else → movie.
//!
//! # Configuration
//!
//! Full reference in [`config`]. Highlights (all via env,
//! optional `.env` file):
//!
//! ```text
//! HOST / PORT                     bind address, default 0.0.0.0:8787
//! PROVIDERS_ROOT                  repo root containing dist/ + urls.json
//! DEFAULT_PROVIDER                provider id when `provider` is omitted
//! WORKER_COUNT                    Node worker pool size (default: CPU count)
//! CALL_TIMEOUT_MS / WORKER_TIMEOUT_MS   per-call and abort-signal timeouts
//! SEARCH_ALL_TIMEOUT_MS           per-provider cap for /api/search-all
//! RATE_LIMIT_PER_MIN / RATE_LIMIT_BURST per-IP quota
//! CACHE_*_SECS                    per-endpoint TTLs
//! CORS_ORIGINS                    comma-separated allow-list ("*" = all)
//! TLS_CERT / TLS_KEY              enable rustls TLS
//! LOG_LEVEL                       tracing level (default: info)
//! ```
//!
//! # Providers
//!
//! The registry is loaded from `manifest.json`. As of writing the repo ships
//! **48 providers**, of which **23 are enabled** (disabled entries are
//! filtered out at startup):
//!
//! | id | display | version | type |
//! | --- | --- | --- | --- |
//! | `vega` | VMovies | 2.27 | global |
//! | `drive` | MoviesDrive | 2.16 | global |
//! | `4khdhub` | 4khdHub | 2.10 | global |
//! | `1cinevood` | Cinewood | 1.22 | global |
//! | `world4u` | World4uFree | 1.7 | global |
//! | `katmovies` | KatMoviesHd | 1.23 | global |
//! | `mod` | MoviesMod | 1.7 | global |
//! | `uhd` | UHDMovies | 1.8 | global |
//! | `movieBoxWeb` | MovieBox Web | 1.4 | global |
//! | `gokuHD` | GokuHD | 1.2 | global |
//! | `eonMovies` | EonMovies | 1.6 | global |
//! | `movies4u` | Movies4U | 1.18 | global |
//! | `kmMovies` | KmMovies | 2.14 | global |
//! | `zeefliz` | Zeefliz | 1.20 | global |
//! | `hdhub4u` | HdHub4u | 2.14 | global |
//! | `a111477` | A.111477 | 1.7 | english |
//! | `moviezwap` | MoviezWap | 1.3 | india |
//! | `showbox` | ShowBox | 1.5 | english |
//! | `luxMovies` | RogMovies | 2.19 | india |
//! | `topmovies` | TopMovies | 1.11 | india |
//! | `Joya9tv` | Joya9tv | 1.12 | india |
//! | `torrentio` | Torrentio | 1.12 | global |
//! | `cinefreak` | CineFreak | 1.1 | global |
//!
//! The full list (including disabled entries) is always available at
//! `GET /providers` and on the `/` dashboard.
//!
//! # Building & running
//!
//! Requirements: Rust 1.85+, Node 20+ (for `curl-cffi-node`), and the
//! `stream-providers` repo with its `node_modules` installed.
//!
//! ```bash
//! cd stream-providers
//! cp .env.example .env        # optional; defaults work
//! cargo build --release
//! ./target/release/harustream-provider-api
//! ```
//!
//! Then point harustream at it:
//!
//! ```bash
//! NEXT_PUBLIC_PROVIDER_API_URL=http://localhost:8787
//! ```
//!
//! # Deployment
//!
//! - **Docker**: `docker build -t harustream-provider-api .` then run with the
//!   `stream-providers` repo mounted at `/opt/providers` (`PROVIDERS_ROOT=/opt/providers`).
//! - **GitHub Pages**: this documentation is built from the crate docs and
//!   deployed by the `rustdoc.yml` workflow (manual `workflow_dispatch`).
//!
//! # Related repositories
//!
//! - [`harustream`](https://github.com/harusharu/harustream) — the Next.js app
//!   that consumes this API.
//! - [`stream-providers`](https://github.com/harusharu/stream-providers) — the
//!   provider bundles this gateway executes.

pub mod app;
pub mod cache;
pub mod config;
pub mod error;
pub mod handlers;
pub mod manifest;
pub mod model;
pub mod security;
pub mod services;
pub mod state;
pub mod telemetry;
pub mod tls;
pub mod worker;
