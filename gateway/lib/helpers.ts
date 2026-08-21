import type { Context } from 'hono';
import { isKnownProvider } from '../../providers/_shared/sites.ts';
import type { AppEnv, AppState } from './app.ts';
import { ApiError } from './errors.ts';
import { requireNonEmpty } from './model.ts';

export type HandlerContext = Context<AppEnv>;

export function state(c: HandlerContext): AppState {
  return c.get('state');
}

export function resolveProvider(c: HandlerContext, raw: string | undefined): string {
  const provider = requireNonEmpty(raw, 'provider', 64);
  if (!isKnownProvider(provider)) {
    throw ApiError.providerNotFound(provider);
  }
  return provider;
}

export function cached(c: HandlerContext, data: unknown, ttlSecs: number): Response {
  c.header('Cache-Control', `public, max-age=${ttlSecs}`);
  return c.json({ success: true, data });
}
