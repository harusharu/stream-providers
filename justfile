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
    {{npm}} --prefix netlify-functions ci

# --- provider bundles -------------------------------------------------------
bundles:
    {{npm}} run build

bundles-dev:
    {{npm}} run build:dev

# --- typecheck & format (both code trees) -----------------------------------
typecheck:
    {{npm}} run typecheck
    {{npm}} --prefix netlify-functions run typecheck

format:
    {{npm}} run format
    {{npm}} --prefix netlify-functions run format

format-check:
    {{npm}} run format:check
    {{npm}} --prefix netlify-functions run format:check

# --- Rust gateway ------------------------------------------------------------
build-rust:
    {{cargo}} build

release:
    ./scripts/build.sh

dev:
    {{cargo}} run

watch:
    ./scripts/dev.sh

fmt:
    {{cargo}} fmt

lint:
    {{cargo}} clippy --all-targets -- -D warnings

test:
    {{cargo}} test --lib
    {{cargo}} test --test integration

e2e:
    {{npm}} run build
    {{cargo}} test --test e2e -- --ignored --test-threads=1

docs:
    {{cargo}} doc --no-deps --document-private-items

docker:
    docker build -t harustream-provider-api .

# --- Node gateway (same port as Rust — swap the backend without touching config) ---
dev-node:
    PORT={{port}} node netlify-functions/lib/adapters/node.ts

# --- functional API suite (run against a running gateway) --------------------
test-api quick='':
    node scripts/api-suite.js {{quick}} {{api_base}}

# --- provider URL manifest ----------------------------------------------------
url-check:
    node .github/scripts/url-checker.js

# --- CI gate -----------------------------------------------------------------
check:
    {{cargo}} fmt --check
    {{cargo}} clippy --all-targets -- -D warnings
    {{cargo}} test --lib
    {{cargo}} test --test integration
    {{npm}} run typecheck
    {{npm}} --prefix netlify-functions run typecheck

# --- cleanup ------------------------------------------------------------------
clean:
    {{cargo}} clean
