# Build stage
FROM rust:1.97-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY rust-api/Cargo.toml rust-api/Cargo.lock* ./
COPY rust-api/src ./src
RUN cargo build --release

# Runtime stage
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/api
COPY --from=builder /build/target/release/harustream-provider-api /opt/api/harustream-provider-api
# The stream-providers repo (rust-api/worker/, dist/, urls.json, node_modules
# with axios/cheerio/curl-cffi-node) is mounted here at runtime.
RUN mkdir -p /opt/providers
ENV PROVIDERS_ROOT=/opt/providers \
    PORT=8787 \
    HOST=0.0.0.0
EXPOSE 8787
ENTRYPOINT ["/opt/api/harustream-provider-api"]