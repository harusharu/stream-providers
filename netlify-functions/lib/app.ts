// Hono `App` factory.
//
// [`buildApp`] assembles the complete HTTP application — CORS, security
// middleware (request-id, rate limit, security headers), all routes, and the
// 404 fallback — from an [`AppState`]. The runtime entry (`api.ts`) exports
// the built app; adapters wire it to Netlify/Vercel/Node. Tests can build a
// fresh app with an injected state.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { CacheBundle } from './cache.ts';
import type { Config } from './config.ts';
import { fromEnv, validate } from './config.ts';
import { errorBody, notFoundBody, toApiError } from './errors.ts';
import { Gateway } from './gateway.ts';
import { catalog } from './handlers/catalog.ts';
import { episodes } from './handlers/episodes.ts';
import { meta } from './handlers/meta.ts';
import { search } from './handlers/search.ts';
import { searchAll } from './handlers/search-all.ts';
import { stream } from './handlers/stream.ts';
import * as system from './handlers/system.ts';
import { ProviderRegistry } from './providers.ts';
import { RateLimiter } from './rate-limit.ts';
import { REQUEST_ID_HEADER, securityMiddleware } from './security.ts';

/** Process-wide state shared by every request handler. */
export interface AppState {
  config: Config;
  registry: ProviderRegistry;
  gateway: Gateway;
  caches: CacheBundle;
}

/** Hono type variables injected by the state middleware. */
export type AppEnv = { Variables: { state: AppState } };

/** The globally-shared state singleton (lazily built from env on first use). */
let singleton: AppState | null = null;

/** Build the state once per process from the environment. */
export function loadState(config?: Config): AppState {
  if (singleton) return singleton;
  const cfg = config ?? fromEnv();
  const problems = validate(cfg);
  for (const problem of problems) console.warn(`[config] ${problem}`);
  const registry = ProviderRegistry.load(cfg.providersRoot);
  singleton = {
    config: cfg,
    registry,
    gateway: new Gateway(cfg, registry),
    caches: new CacheBundle(cfg),
  };
  return singleton;
}

/** Reset the singleton (used by tests). */
export function resetState(): void {
  singleton = null;
}

/** Build the CORS middleware from the configured origin allow-list. */
function buildCors(origins: string[]) {
  const allowAll = origins.includes('*');
  return cors({
    origin: allowAll
      ? '*'
      : (origin) => (origin !== undefined && origins.includes(origin) ? origin : undefined),
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Accept', 'Content-Type', REQUEST_ID_HEADER],
    maxAge: 3600,
  });
}

/**
 * Build the complete Hono application from an [`AppState`].
 */
export function buildApp(state: AppState = loadState()): Hono<AppEnv> {
  const { config } = state;
  const limiter = new RateLimiter(config.rateLimitPerMin, config.rateLimitBurst);
  const app = new Hono<AppEnv>();

  // Inject shared state + global middleware.
  app.use('*', async (c, next) => {
    c.set('state', state);
    await next();
  });
  app.use('*', corsHandler(state));
  app.use('*', securityMiddleware(config, limiter));

  // Routes.
  app.get('/health', system.health);
  app.get('/info', system.info);
  app.get('/providers', system.providers);
  app.get('/api/providers', system.apiProviders);
  app.get('/urls.json', system.urlsManifest);
  app.get('/', system.dashboard);

  app.get('/api/catalog', catalog);
  app.get('/api/search', search);
  app.get('/api/search-all', searchAll);
  app.get('/api/meta', meta);
  app.get('/api/episodes', episodes);
  app.get('/api/stream', stream);

  // 404 + error handling.
  app.notFound((c) => c.json(notFoundBody(), 404));
  app.onError((err, c) => {
    const apiErr = toApiError(err);
    const body = errorBody(apiErr);
    c.header('Cache-Control', 'no-store');
    return c.json(body, apiErr.status as ContentfulStatusCode);
  });

  return app;
}

function corsHandler(state: AppState) {
  return buildCors(state.config.corsOrigins);
}
