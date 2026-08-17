# AGENTS.md

Rust/Actix API gateway + Node provider bundles + Hono gateway, all in one repo.

## Three code trees

- `rust-api/` — crate `harustream-provider-api`: the primary product. Actix gateway that executes provider bundles in isolated Node sidecar workers (`rust-api/worker/worker.js`) over newline-delimited JSON on stdin/stdout. Rust work is the default.
- `providers/`, `dist/`, `build-bundled.js` — TypeScript provider bundles. `npm run build` esbuild-bundles each provider's `catalog|posts|meta|stream|episodes.ts` into `dist/<provider>/<module>.js`. `dist/` is committed; rebuild it after any provider change or the Rust gateway runs stale bundles.
- `hono-api/` — separate Hono gateway (own `package.json` + `node_modules`, needs Node ≥22.18, ESM, native `.ts` imports). Deployed to Netlify/Vercel; shares `dist/`, `urls.json`, `manifest.json` from the repo root.

## Commands (use `just`, not `make`)

README's `make` targets are stale — there is no Makefile. The runner is `justfile` (needs `just`):

```bash
just check      # full CI gate: fmt, clippy -D warnings, lib+integration tests, both typechecks
just test       # cargo test --lib + --test integration (no Node, no network)
just e2e        # npm run build + cargo test --test e2e -- --ignored --test-threads=1 (real network)
just watch      # rust-api/scripts/dev.sh: cargo-watch + auto-rebuilds provider bundles on TS change
just test-api [quick] [base]  # functional suite against a running gateway (default :8787)
```

Equivalent bare commands: `cd rust-api && cargo fmt --check`, `cd rust-api && cargo clippy --all-targets -- -D warnings`, `npm run typecheck` + `npm --prefix hono-api run typecheck`, `RUSTDOCFLAGS="-D warnings" cargo doc --lib --no-deps` (docs gate in CI).

## Testing quirks

- Integration tests (`rust-api/tests/integration.rs`) run the full Actix app with a `MockGateway` — never spawn Node or touch the network.
- E2e (`rust-api/tests/e2e.rs`) is `#[ignore]`d and gated to manual `workflow_dispatch`: it hits real upstream hosters via real Node workers and is flaky by design. Requires `npm ci && npm run build` first and `node` on PATH. Always run with `--test-threads=1`.
- JS/TS formatting is Biome (formatter only, linter disabled): single quotes, semicolons, trailing commas, 2-space, 100 cols. `just format` / `just format-check`.
- Rust formatting/clippy: `cargo fmt`, clippy must pass with `-D warnings`.

## Gotchas

- **`dist/providerContext.js` is broken in plain Node** ("Class extends value undefined"). The worker uses `rust-api/worker/context.js` (plain-JS reimplementation) instead. Don't "fix" providerContext.ts to run in Node.
- **stdout of worker processes carries only the IPC protocol.** `rust-api/worker/worker.js` redirects all provider `console.log` to stderr. Any new worker output must preserve this or it corrupts the channel.
- Worker bundles resolve `axios`/`cheerio`/`curl-cffi-node` from the repo `node_modules` because Rust spawns workers with `cwd = PROVIDERS_ROOT` (repo root). Root `npm install` is a runtime dependency, not just dev tooling.
- **`curl-cffi-node@0.1.8` declares nonexistent unscoped platform packages as optionalDependencies** (upstream bug — the real ones are `@curl-cffi-node/<platform>`). Both root and `hono-api` package.json pin `overrides` aliasing the unscoped names to the scoped packages; without those, `npm ci` fails with "Missing … from lock file". Don't remove the overrides when bumping the version.
- **Timeout invariant enforced at startup** (`Config::validate`): `WORKER_TIMEOUT_MS < CALL_TIMEOUT_MS` and `SEARCH_ALL_TIMEOUT_MS <= WORKER_TIMEOUT_MS`. Don't "simplify" these.
- `urls.json` holds live provider base URLs and is auto-updated by the `check-urls` GitHub Action (daily cron + on demand, commits changes, notifies Discord). Don't hand-edit it unless you know a URL is dead. `URLS_MANIFEST_URL` (optional) switches to a network fetch with local fallback.
- `manifest.json` is a JSON array of providers; `value` is the id clients pass as `provider`; `disabled` entries are filtered at load. `hono-api/lib/providers.ts` has a static fallback list that must stay in sync with it.
- **Vercel deploy uses the committed bundle `hono-api/api.vercel.mjs`.** Regenerate with `node hono-api/scripts/vercel-bundle.js` and commit it whenever `hono-api/lib/` changes, or the deploy serves stale code.
- Netlify deploys only `hono-api/api.ts` as a function — all support modules must live in `hono-api/lib/`, and `curl-cffi-node` must stay external (`external_node_modules` in `netlify.toml`); it ships a native binary.
- Docker: the Rust binary runs with the stream-providers repo mounted at `/opt/providers` (`PROVIDERS_ROOT`). The image itself contains no bundles.
- Build bundles before running the gateway or workers die with "bundle not found"; `just watch`/`rust-api/scripts/dev.sh` handles this automatically.
- `.env`, `.env.prod` are local-only (gitignored); `.env.example` is the canonical config reference.