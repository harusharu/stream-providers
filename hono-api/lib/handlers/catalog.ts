// `GET /api/catalog?provider=` — the provider's home/genre categories.

import { CacheBundle } from '../cache.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, resolveProvider, state } from './helpers.ts';

export async function catalog(c: HandlerContext): Promise<Response> {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query('provider'));
  const key = CacheBundle.key('catalog', provider, {});
  const ttl = caches.catalog.ttlSecs;

  const data = await caches.catalog.getOrSet(key, () =>
    gateway.call({ provider, module: 'catalog', fn: 'catalog', args: {} }),
  );
  return cached(c, data, ttl);
}
