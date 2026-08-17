// Shared handler helpers: provider resolution and the cached envelope.
//
// Every `/api/*` handler follows the same shape (mirroring the Rust
// `handlers/mod.rs`): resolve the provider, validate params, check the TTL
// cache, call the gateway on a miss, then re-cache and wrap in the
// `{ success, data }` envelope with a `Cache-Control` header.

import type { Context } from 'hono';
import type { AppEnv, AppState } from '../app.ts';
import { ApiError } from '../errors.ts';
import { normalizeProvider } from '../model.ts';

export type HandlerContext = Context<AppEnv>;

/** Access the shared application state. */
export function state(c: HandlerContext): AppState {
  return c.get('state');
}

/** Resolve and validate the `provider` query param, defaulting per config. */
export function resolveProvider(c: HandlerContext, raw: string | undefined): string {
  const { registry, config } = state(c);
  const provider = normalizeProvider(raw, config.defaultProvider);
  if (!registry.contains(provider)) {
    throw ApiError.providerNotFound(provider);
  }
  return provider;
}

/** Serve a successful envelope with a `Cache-Control` header. */
export function cached(c: HandlerContext, data: unknown, ttlSecs: number): Response {
  c.header('Cache-Control', `public, max-age=${ttlSecs}`);
  return c.json({ success: true, data });
}

/** Serve a successful envelope without caching. */
export function ok(c: HandlerContext, body: Record<string, unknown>): Response {
  return c.json(body);
}
