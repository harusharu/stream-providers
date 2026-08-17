# Command runner for the stream-providers API (Rust + Node gateways).
# Requires `just` (brew install just).

# --- configuration ----------------------------------------------------------
cargo := env_var_or_default('CARGO', 'cargo')
npm := env_var_or_default('NPM', 'npm')
port := env_var_or_default('PORT', '8787')
api_base := env_var_or_default('API_BASE', 'http://localhost:8787')

# --- help -------------------------------------------------------------------
default: help

help:
    @just --list --unsorted

# --- dependencies -----------------------------------------------------------
setup:
    {{npm}} ci
    {{npm}} --prefix hono-api ci

# --- provider bundles -------------------------------------------------------
bundles:
    {{npm}} run build

bundles-dev:
    {{npm}} run build:dev

# --- typecheck & format (both code trees) -----------------------------------
typecheck:
    {{npm}} run typecheck
    {{npm}} --prefix hono-api run typecheck

format:
    {{npm}} run format
    {{npm}} --prefix hono-api run format

format-check:
    {{npm}} run format:check
    {{npm}} --prefix hono-api run format:check

# --- Rust gateway ------------------------------------------------------------
build-rust:
    cd rust-api && {{cargo}} build

release:
    ./rust-api/scripts/build.sh

dev:
    cd rust-api && {{cargo}} run

watch:
    ./rust-api/scripts/dev.sh

fmt:
    cd rust-api && {{cargo}} fmt

lint:
    cd rust-api && {{cargo}} clippy --all-targets -- -D warnings

test:
    cd rust-api && {{cargo}} test --lib
    cd rust-api && {{cargo}} test --test integration

e2e:
    {{npm}} run build
    cd rust-api && {{cargo}} test --test e2e -- --ignored --test-threads=1

docs:
    cd rust-api && {{cargo}} doc --no-deps --document-private-items

docker:
    docker build -t harustream-provider-api .

# --- Node gateway (same port as Rust — swap the backend without touching config) ---
dev-node:
    PORT={{port}} node hono-api/lib/adapters/node.ts

# --- functional API suite (run against a running gateway) --------------------
test-api quick='':
    node scripts/api-suite.js {{quick}} {{api_base}}

# --- provider URL manifest ----------------------------------------------------
url-check:
    node .github/scripts/url-checker.js

# --- CI gate -----------------------------------------------------------------
check:
    cd rust-api && {{cargo}} fmt --check
    cd rust-api && {{cargo}} clippy --all-targets -- -D warnings
    cd rust-api && {{cargo}} test --lib
    cd rust-api && {{cargo}} test --test integration
    {{npm}} run typecheck
    {{npm}} --prefix hono-api run typecheck

# --- cleanup ------------------------------------------------------------------
clean:
    cd rust-api && {{cargo}} clean