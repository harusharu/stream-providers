# Development / CI workflow for the harustream-provider-api Rust gateway.
#
# Provider bundles must be built once (`npm run build` in the repo root) so the
# Node worker pool can load dist/<provider>/<module>.js.

CARGO ?= cargo
NPM ?= npm

PROVIDERS_ROOT ?= $(abspath .)

# Defaults mirror Config::from_env; override via the environment as needed.
LOG_LEVEL ?= info
PORT ?= 8787
HOST ?= 0.0.0.0

.PHONY: help dev build watch test check fmt lint docs release docker clean

help:
	@echo "harustream-provider-api development targets:"
	@echo "  make dev        run the gateway (debug build) on :$(PORT)"
	@echo "  make watch      run + auto-reload on Rust or provider bundle changes"
	@echo "  make build      debug build"
	@echo "  make test       unit + integration tests (no Node, no network)"
	@echo "  make e2e        real-network provider sweep (requires built dist)"
	@echo "  make check      fmt + clippy + docs + tests (CI gate)"
	@echo "  make fmt        format code in place"
	@echo "  make lint       clippy with -D warnings"
	@echo "  make docs       build crate docs"
	@echo "  make release    optimized release build"
	@echo "  make docker     build the container image"
	@echo "  make clean      remove build artifacts"

dev:
	$(CARGO) run

watch:
	./scripts/dev.sh

build:
	$(CARGO) build

release:
	$(CARGO) build --release

test:
	$(CARGO) test --lib
	$(CARGO) test --test integration

e2e:
	@echo "Building provider bundles..."
	$(NPM) run build
	$(CARGO) test --test e2e -- --ignored --test-threads=1

lint:
	$(CARGO) clippy --all-targets -- -D warnings

fmt:
	$(CARGO) fmt

check:
	$(CARGO) fmt --check
	$(CARGO) clippy --all-targets -- -D warnings
	$(CARGO) doc --no-deps --document-private-items
	$(CARGO) test --lib
	$(CARGO) test --test integration

docs:
	$(CARGO) doc --no-deps --document-private-items

docker:
	docker build -t harustream-provider-api .

clean:
	$(CARGO) clean