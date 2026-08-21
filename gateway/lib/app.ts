import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { CacheBundle } from './cache.ts';
import { errorBody, notFoundBody, toApiError } from './errors.ts';
import { Gateway } from './gateway.ts';
import { REQUEST_ID_HEADER, securityMiddleware } from './security.ts';
import { RateLimiter } from './rate-limit.ts';
import * as routes from './routes.ts';

export interface AppState {
  gateway: Gateway;
  caches: CacheBundle;
}

export type AppEnv = { Variables: { state: AppState } };

let singleton: AppState | null = null;

export function loadState(): AppState {
  if (singleton) return singleton;
  singleton = {
    gateway: new Gateway(),
    caches: new CacheBundle(),
  };
  return singleton;
}

export function resetState(): void {
  singleton = null;
}

export function buildApp(state: AppState = loadState()): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('state', state);
    await next();
  });
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Accept', 'Content-Type', REQUEST_ID_HEADER],
      maxAge: 3600,
    }),
  );
  app.use('*', securityMiddleware(new RateLimiter(600, 120)));

  app.get('/health', routes.health);
  app.get('/info', routes.info);
  app.get('/providers', routes.providers);
  app.get('/api/providers', routes.apiProviders);
  app.get('/', routes.dashboard);

  app.get('/api/catalog', routes.catalog);
  app.get('/api/search', routes.search);
  app.get('/api/search-all', routes.searchAll);
  app.get('/api/meta', routes.meta);
  app.get('/api/episodes', routes.episodes);
  app.get('/api/stream', routes.stream);

  app.notFound((c) => c.json(notFoundBody(), 404));
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    const body = errorBody(apiErr);
    c.header('Cache-Control', 'no-store');
    return c.json(body, apiErr.status as ContentfulStatusCode);
  });

  return app;
}
