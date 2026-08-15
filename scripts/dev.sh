#!/usr/bin/env bash
# Rust/Actix development environment for the harustream-provider-api gateway.
#
# Runs the gateway in debug mode and, when cargo-watch is available, reloads it
# on Rust source changes. Provider TypeScript bundles are rebuilt automatically
# on change (npm run build) so the Node workers always load fresh dist code.
#
# Usage:
#   ./scripts/dev.sh                 # run + watch (best experience)
#   ./scripts/dev.sh --no-watch      # plain `cargo run`, no watchers
set -euo pipefail

cd "$(dirname "$0")/.."

WATCH=1
if [[ "${1:-}" == "--no-watch" ]]; then
  WATCH=0
fi

export PROVIDERS_ROOT="${PROVIDERS_ROOT:-$(pwd)}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"
export PORT="${PORT:-8787}"
export HOST="${HOST:-0.0.0.0}"

if [[ "$WATCH" == "1" ]] && ! command -v cargo-watch >/dev/null 2>&1; then
  echo "cargo-watch not found; installing it..." >&2
  cargo install cargo-watch
fi

echo "PROVIDERS_ROOT=$PROVIDERS_ROOT"
echo "Starting gateway on $HOST:$PORT (debug build)"

if [[ "$WATCH" == "1" ]]; then
  # Watch provider sources and rebuild bundles on change, plus watch Rust
  # sources for a gateway reload. cargo-watch restarts on its own targets;
  # the bundle rebuild is a background loop. The marker file records the last
  # successful build so we only rebuild when a provider .ts is newer.
  MARKER="$(pwd)/target/.provider-build-marker"
  mkdir -p "$(dirname "$MARKER")"
  if ! find dist -type f -newer "$MARKER" 2>/dev/null | grep -q .; then
    touch "$MARKER"
  fi

  (
    while true; do
      if find providers -name '*.ts' -newer "$MARKER" 2>/dev/null | grep -q .; then
        echo "Provider source changed; rebuilding bundles..." >&2
        if npm run build; then
          touch "$MARKER"
        else
          echo "provider build failed; retrying on next change" >&2
        fi
      fi
      sleep 2
    done
  ) &
  BUNDLE_PID=$!
  trap 'kill $BUNDLE_PID 2>/dev/null || true' EXIT

  exec cargo watch -x "run" \
    --watch src \
    --watch providers \
    --watch manifest.json \
    --watch worker
else
  exec cargo run
fi