// `GET /api/stream?provider=&link=&type=` — resolves a hub URL into playable
// m3u8/mp4 sources `[{server, link, type}]`. Cached for `CACHE_STREAM_SECS`.

import { CacheBundle } from '../cache.ts';
import { requireNonEmpty, streamType } from '../model.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, resolveProvider, state } from './helpers.ts';

export async function stream(c: HandlerContext): Promise<Response> {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query('provider'));
  const link = requireNonEmpty(c.req.query('link'), 'link', 2000);
  const type = streamType(c.req.query('type'));
  const params = { link, type, providerValue: provider };
  const key = CacheBundle.key('stream', provider, params);
  const ttl = caches.stream.ttlSecs;

  const data = await caches.stream.getOrSet(key, () =>
    gateway.call({ provider, module: 'stream', fn: 'getStream', args: params }),
  );
  return cached(c, data, ttl);
}
