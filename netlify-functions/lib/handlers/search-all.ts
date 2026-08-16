// `GET /api/search-all?query=&page=&providers=` — aggregated search across
// every enabled provider (or the comma-separated `providers` subset).
//
// The gateway fans out concurrently, tags each item with `provider` and
// `providerName`, tolerates slow/failing providers, and returns a summary of
// how many providers were queried and how many failed.

import { CacheBundle } from '../cache.ts';
import { parsePage, requireNonEmpty } from '../model.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, state } from './helpers.ts';

function parseProviders(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function searchAll(c: HandlerContext): Promise<Response> {
  const { gateway, caches, config } = state(c);
  const query = requireNonEmpty(c.req.query('query'), 'query', 200);
  const page = parsePage(c.req.query('page'));
  const requested = parseProviders(c.req.query('providers'));

  const key = CacheBundle.key('search-all', requested.length > 0 ? requested.join(',') : 'all', {
    query,
    page,
  });
  const ttl = caches.searchAll.ttlSecs;

  const result = await caches.searchAll.getOrSet(key, () =>
    gateway.searchAll(query, page, requested),
  );

  const { data, total, providers, failed } = result as {
    data: unknown;
    total: number;
    providers: number;
    failed: number;
  };

  // Envelope mirrors the Rust gateway: the whole summary lives under `data`.
  c.header('Cache-Control', `public, max-age=${ttl}`);
  return c.json({ success: true, data: { success: true, data, total, providers, failed } });
}
