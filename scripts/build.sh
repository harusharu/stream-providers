#!/usr/bin/env bash
# Release build + smoke test for the harustream-provider-api.
set -euo pipefail

cd "$(dirname "$0")/.."

cargo clippy --all-targets -- -D warnings
cargo build --release

echo "Built: target/release/harustream-provider-api"
echo "Run with: PROVIDERS_ROOT=<stream-providers root> ./target/release/harustream-provider-api"