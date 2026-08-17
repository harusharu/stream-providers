// Operational endpoints: `/health`, `/info`, `/providers`, `/api/providers`,
// and the `/` dashboard. All are exempt from rate limiting.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { notFoundBody } from '../errors.ts';
import type { HandlerContext } from './helpers.ts';
import { state } from './helpers.ts';

/** `GET /health` — liveness probe based on the gateway. */
export async function health(c: HandlerContext): Promise<Response> {
  const { gateway, registry } = state(c);
  const workersOk = await gateway.healthy();
  return c.json({
    status: workersOk ? 'healthy' : 'degraded',
    providers: registry.size,
    workers_ok: workersOk,
  });
}

/** `GET /info` — name, version, and the registered endpoints. */
export function info(c: HandlerContext): Response {
  const { registry } = state(c);
  return c.json({
    name: 'stream-api',
    version: '1.0.0',
    status: 'running',
    providers: registry.values(),
    endpoints: [
      'GET /api/catalog?provider=',
      'GET /api/search?provider=&query=&page=',
      'GET /api/search-all?query=&page=&providers=',
      'GET /api/meta?provider=&link=',
      'GET /api/episodes?provider=&url=',
      'GET /api/stream?provider=&link=&type=',
      'GET /health',
      'GET /providers',
      'GET /urls.json',
    ],
  });
}

/** `GET /providers` — the full, filtered manifest entries (Rust shape). */
export function providers(c: HandlerContext): Response {
  const { registry } = state(c);
  return c.json({ providers: registry.entries });
}

/** `GET /api/providers` — legacy envelope shape used by older clients. */
export function apiProviders(c: HandlerContext): Response {
  const { registry } = state(c);
  return c.json({ success: true, data: registry.entries });
}

/** `GET /` — a small human-readable dashboard. */
export function dashboard(c: HandlerContext): Response {
  const { registry, config } = state(c);
  const html = tryReadDashboard(config.providersRoot);
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(
    html ??
      `<!doctype html><html><head><meta charset="utf-8"><title>stream-api</title></head>
<body><h1>stream-api</h1><p>Node.js provider gateway (Hono).</p>
<p>Providers: <code>${registry.values().join(', ')}</code></p>
<p><a href="/health">/health</a> · <a href="/providers">/providers</a> · <a href="/info">/info</a></p>
</body></html>`,
  );
}

/** `GET /urls.json` — the provider URL manifest (upstream base URLs). */
export function urlsManifest(c: HandlerContext): Response {
  const { config } = state(c);
  const path = join(config.providersRoot, 'urls.json');
  try {
    if (!existsSync(path)) {
      return c.json(notFoundBody(), 404);
    }
    const data = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(data);
  } catch {
    return c.json(notFoundBody(), 404);
  }
}

function tryReadDashboard(providersRoot: string): string | null {
  const path = join(providersRoot, 'static', 'index.html');
  try {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  } catch {
    // fall through to the inline dashboard
  }
  return null;
}
