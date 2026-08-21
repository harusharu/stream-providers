# stream-providers

HTTP API for a web streaming app.

```
Web app  →  this API  →  provider site  →  stream URLs
```

The app lists **channels**, then calls catalog / search / meta / stream with a channel `id`. Site URLs live in `providers/_shared/sites.ts`. There is no `.env` to fill in.

## Run

```
npm ci
npm start
```

Listens on `http://localhost:8787`. Builds `dist/` on first start if needed.

Optional: `PORT` (default `8787`). That is the only environment variable.

## API

| Path | Purpose |
| --- | --- |
| `GET /providers` | `{ channels: [{ id, name }] }` |
| `GET /api/catalog?provider=` | Home/genre filters |
| `GET /api/search?provider=&query=` | Search one channel |
| `GET /api/search-all?query=` | Search every channel |
| `GET /api/meta?provider=&link=` | Title metadata |
| `GET /api/episodes?provider=&url=` | Episode list |
| `GET /api/stream?provider=&link=&type=` | Playable sources |
| `GET /health` | Liveness |

Pass `provider` as the channel `id` from `/providers`. The web app does not need hostnames or other internals.

## Add a channel

1. Add `providers/<id>/{catalog,posts,meta,stream,episodes}.ts` as needed.
2. Add `{ name, url }` under that id in `providers/_shared/sites.ts`.
3. `npm run build` then restart.

Requires Node **22.18+**.
