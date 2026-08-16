// `GET /api/episodes?provider=&url=` — per-episode links for a series URL.
// Cached for `CACHE_EPISODES_SECS`.

import { CacheBundle } from '../cache.ts';
import { requireNonEmpty } from '../model.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, resolveProvider, state } from './helpers.ts';

export async function episodes(c: HandlerContext): Promise<Response> {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query('provider'));
  const url = requireNonEmpty(c.req.query('url'), 'url', 2000);
  const params = { url, providerValue: provider };
  const key = CacheBundle.key('episodes', provider, params);
  const ttl = caches.episodes.ttlSecs;

  const data = await caches.episodes.getOrSet(key, () =>
    gateway.call({ provider, module: 'episodes', fn: 'getEpisodes', args: params }),
  );
  return cached(c, data, ttl);
}
