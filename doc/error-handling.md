# Error taxonomy

Every error maps to a real HTTP status that harustream's
`ProviderError` can translate (`429 → RATE_LIMITED`, `503 → UNAVAILABLE`,
`5xx → UPSTREAM_ERROR`, …).

| Status | Meaning |
| --- | --- |
| 400 | Unknown provider / missing required param |
| 422 | Invalid param (e.g. too long) |
| 429 | Rate limited |
| 502 | Worker failure or upstream provider error |
| 504 | Worker call timed out |
| 500 | Internal error |
