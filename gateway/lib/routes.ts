import { channelList } from '../../providers/_shared/sites.ts';
import { CacheBundle } from './cache.ts';
import { applyTypeHints, parsePage, requireNonEmpty, streamType } from './model.ts';
import type { HandlerContext } from './helpers.ts';
import { cached, resolveProvider, state } from './helpers.ts';

export async function health(c: HandlerContext): Promise<Response> {
  const { gateway } = state(c);
  const channels = channelList();
  const workersOk = await gateway.healthy();
  return c.json({
    status: workersOk ? 'healthy' : 'degraded',
    providers: channels.length,
    workers_ok: workersOk,
  });
}

export function info(c: HandlerContext): Response {
  const channels = channelList();
  return c.json({
    name: 'stream-api',
    version: '1.0.0',
    status: 'running',
    providers: channels.map((channel) => channel.id),
    endpoints: [
      'GET /api/catalog?provider=',
      'GET /api/search?provider=&query=&page=',
      'GET /api/search-all?query=&page=&providers=',
      'GET /api/meta?provider=&link=',
      'GET /api/episodes?provider=&url=',
      'GET /api/stream?provider=&link=&type=',
      'GET /health',
      'GET /providers',
    ],
  });
}

export function providers(c: HandlerContext): Response {
  return c.json({ channels: channelList() });
}

export function apiProviders(c: HandlerContext): Response {
  return c.json({ success: true, data: channelList() });
}

export function dashboard(c: HandlerContext): Response {
  const ids = channelList()
    .map((channel) => channel.id)
    .join(', ');
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(`<!doctype html>
<html><head><meta charset="utf-8"><title>stream-api</title></head>
<body>
<h1>stream-api</h1>
<p>Channels: <code>${ids}</code></p>
<p><a href="/health">/health</a> · <a href="/providers">/providers</a> · <a href="/info">/info</a></p>
</body></html>`);
}

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

function parseProviders(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function searchAll(c: HandlerContext): Promise<Response> {
  const { gateway, caches } = state(c);
  const query = requireNonEmpty(c.req.query('query'), 'query', 200);
  const page = parsePage(c.req.query('page'));
  const requested = parseProviders(c.req.query('providers'));
  const key = CacheBundle.key('search-all', requested.length > 0 ? requested.join(',') : 'all', {
    query,
    page,
  });
  const ttl = caches.searchAll.ttlSecs;
  const result = (await caches.searchAll.getOrSet(key, () =>
    gateway.searchAll(query, page, requested),
  )) as { data: unknown; total: number; providers: number; failed: number };
  c.header('Cache-Control', `public, max-age=${ttl}`);
  return c.json({
    success: true,
    data: result.data,
    total: result.total,
    providers: result.providers,
    failed: result.failed,
  });
}

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
