# API Reference

## Endpoints

| Method | Path | Params | Returns |
| --- | --- | --- | --- |
| GET | `/api/catalog` | `provider` | Home/genre categories `[{title, filter}]` |
| GET | `/api/search` | `provider`, `query`, `page` | Search results `[{title, link, image, type}]` |
| GET | `/api/search-all` | `query`, `page`, `providers` | Aggregated search across all providers |
| GET | `/api/meta` | `provider`, `link` | Full title metadata |
| GET | `/api/episodes` | `provider`, `url` | Episode list `[{title, link}]` |
| GET | `/api/stream` | `provider`, `link`, `type` | Playable sources `[{server, link, type}]` |
| GET | `/health` | — | Liveness + worker health |
| GET | `/providers` | — | Manifest contents |

All provider responses are wrapped as `{"success":true,"data":...}` (harustream
also accepts raw arrays). Errors use `{"success":false,"code":...,"error":...}`
with appropriate HTTP statuses (400 validation, 429 rate limit, 502 upstream,
504 timeout).
