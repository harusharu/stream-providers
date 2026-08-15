# Testing

## Unit Tests

```bash
cargo test --lib
```

## Integration Tests

```bash
cargo test --test integration
```

## E2E Provider Sweep (run explicitly)

```bash
cargo test --test e2e -- --ignored
```
