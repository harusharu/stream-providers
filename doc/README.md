# harustream-provider-api

A high-performance, security-hardened **Rust / Actix** gateway that turns the [`stream-providers`](https://github.com/harusharu/stream-providers) JavaScript provider bundles into a clean REST API consumed by the [`harustream`](https://github.com/harusharu/harustream) web app.

## Overview

Rust owns the entire public HTTP surface — validation, rate limiting, caching, TLS, request tracing — while the fragile, evolving scraping logic stays inside **isolated Node sidecar worker processes**.

## Key Features

- **REST API** (`/api/*` endpoints) for catalog, search, meta, episodes, stream
- **Node worker pool** executing provider bundles via IPC (newline-delimited JSON)
- **TTL caching** per endpoint to avoid repeated upstream scraping
- **Per-IP rate limiting** with configurable quota/burst
- **Security headers** on every response (CSP, X-Frame-Options, etc.)
- **CORS allow-listing** (defaults to `*`)
- **Optional TLS** via rustls when `TLS_CERT` / `TLS_KEY` are set
- **mdBook-compatible documentation** structure

## Architecture

```text
harustream (Next.js)
   │  GET /api/catalog|search|meta|episodes|stream?provider=...
   ▼
Rust API gateway (Actix)   ← validation, rate limit, cache, TLS, request-id
   │  newline-delimited JSON over stdin/stdout
   ▼
Node worker pool (curl-cffi-node)   ← loads dist/<provider>/<module>.js, executes
   │
   ▼
Upstream streaming sites
```

## Quick Start

```bash
cd stream-providers
cp .env.example .env          # optional; defaults work
cargo build --release
./target/release/harustream-provider-api
```

Then point harustream at it:

```bash
NEXT_PUBLIC_PROVIDER_API_URL=http://localhost:8787
```
