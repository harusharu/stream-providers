// `GET /api/search?provider=&query=&page=` — search results with a `type`
// hint inferred per item. Cached for `CACHE_SEARCH_SECS`.

import { CacheBundle } from '../cache.ts';
import { applyTypeHints, parsePage, requireNonEmpty } from '../model.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, resolveProvider, state } from './helpers.ts';

export async function search(c: HandlerContext): Promise<Response> {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query('provider'));
  const query = requireNonEmpty(c.req.query('query'), 'query', 200);
  const page = parsePage(c.req.query('page'));
  const params = { searchQuery: query, page, providerValue: provider };
  const key = CacheBundle.key('search', provider, params);
  const ttl = caches.search.ttlSecs;

  const raw = await caches.search.getOrSet(key, () =>
    gateway.call({ provider, module: 'posts', fn: 'getSearchPosts', args: params }),
  );
  return cached(c, applyTypeHints(raw), ttl);
}
