# Building & Running

## Requirements

- Rust 1.85+ toolchain
- Node 20+ (for `curl-cffi-node`)
- The `stream-providers` repo (its `node_modules` must include `axios`, `cheerio`,
  `curl-cffi-node`)

```bash
cd stream-providers
cp .env.example .env        # optional; defaults work
cargo build --release
./target/release/harustream-provider-api
```

Then point harustream at it:

```bash
NEXT_PUBLIC_PROVIDER_API_URL=http://localhost:8787
```
