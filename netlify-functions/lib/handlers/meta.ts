// `GET /api/meta?provider=&link=` — full metadata for a title.
// Cached for `CACHE_META_SECS`.

import { CacheBundle } from '../cache.ts';
import { requireNonEmpty } from '../model.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, resolveProvider, state } from './helpers.ts';

export async function meta(c: HandlerContext): Promise<Response> {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query('provider'));
  const link = requireNonEmpty(c.req.query('link'), 'link', 2000);
  const params = { link, providerValue: provider };
  const key = CacheBundle.key('meta', provider, params);
  const ttl = caches.meta.ttlSecs;

  const data = await caches.meta.getOrSet(key, () =>
    gateway.call({ provider, module: 'meta', fn: 'getMeta', args: params }),
  );
  return cached(c, data, ttl);
}
