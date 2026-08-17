// Local dist-bundle loader + runner.
//
// Loads `dist/<provider>/<module>.js` bundles (built by `npm run build` in the
// repo root) and executes them in-process, mirroring `worker/worker.js`:
//
//   - catalog.js exports plain arrays (`catalog`, `genres`) → concatenated.
//   - posts/meta/episodes/stream export functions taking
//     `{ ...args, signal, providerContext }`.
//
// Bundles are cached per `provider/module` so repeated calls don't re-parse
// megabytes of esbuild output.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { ProviderContext } from './context.ts';
import { ApiError } from './errors.ts';

export type ModuleName = 'catalog' | 'posts' | 'meta' | 'episodes' | 'stream';

export interface CallRequest {
  provider: string;
  module: ModuleName;
  fn: string;
  args: Record<string, unknown>;
  signal: AbortSignal;
  providerContext: ProviderContext;
  workerTimeoutMs: number;
}

/** Whether a bundle file exists on disk for this provider/module. */
export function bundleExists(providersRoot: string, provider: string, module: ModuleName): boolean {
  return existsSync(join(providersRoot, 'dist', provider, `${module}.js`));
}

/** Resolve the absolute bundle path for a provider/module. */
function bundlePath(providersRoot: string, provider: string, module: ModuleName): string {
  return join(providersRoot, 'dist', provider, `${module}.js`);
}

const bundleCache = new Map<string, Record<string, unknown>>();

/** Load (and cache) a provider bundle's exports. */
export function loadBundle(
  providersRoot: string,
  provider: string,
  module: ModuleName,
): Record<string, unknown> {
  const key = `${provider}/${module}`;
  const cached = bundleCache.get(key);
  if (cached) return cached;

  const path = bundlePath(providersRoot, provider, module);
  if (!existsSync(path)) {
    throw ApiError.worker(`bundle not found: ${key} (expected ${path})`);
  }
  const requireFromRoot = createRequire(join(providersRoot, 'package.json'));
  const mod = requireFromRoot(path) as Record<string, unknown>;
  bundleCache.set(key, mod);
  return mod;
}

/** Build the argument object each provider function expects (worker.js logic). */
export function buildArgs(
  module: ModuleName,
  fn: string,
  args: Record<string, unknown>,
  workerTimeoutMs: number,
): Record<string, unknown> {
  const signal = abortSignalWithTimeout(workerTimeoutMs);
  switch (fn) {
    case 'getPosts':
      return {
        filter: args.filter ?? '',
        page: Number(args.page ?? 1),
        providerValue: args.providerValue ?? '',
        signal,
      };
    case 'getSearchPosts':
      return {
        searchQuery: args.searchQuery ?? '',
        page: Number(args.page ?? 1),
        providerValue: args.providerValue ?? '',
        signal,
      };
    case 'getMeta':
      return { link: args.link ?? '', providerValue: args.providerValue ?? '' };
    case 'getEpisodes':
      return { url: args.url ?? '', providerValue: args.providerValue ?? '' };
    case 'getStream':
      return { link: args.link ?? '', type: args.type ?? 'movie', signal };
    default:
      throw ApiError.worker(`unsupported function: ${fn} in ${module}`);
  }
}

/** Execute one local provider call, returning the provider's raw result. */
export async function executeBundle(providersRoot: string, req: CallRequest): Promise<unknown> {
  const { provider, module, fn, args, signal, providerContext } = req;

  if (module === 'catalog') {
    // catalog.js exports plain arrays, not functions.
    const mod = loadBundle(providersRoot, provider, module);
    const catalog = Array.isArray(mod['catalog']) ? (mod['catalog'] as unknown[]) : [];
    const genres = Array.isArray(mod['genres']) ? (mod['genres'] as unknown[]) : [];
    return [...catalog, ...genres];
  }

  const mod = loadBundle(providersRoot, provider, module);
  const impl = mod[fn];
  if (typeof impl !== 'function') {
    throw ApiError.worker(`no export ${fn}() in ${provider}/${module}.js`);
  }
  const callArgs = buildArgs(module, fn, args, req.workerTimeoutMs);
  callArgs.providerContext = providerContext;
  return (impl as (a: Record<string, unknown>) => Promise<unknown>)(callArgs);
}

/** An AbortSignal that fires after `ms`, kept from holding the event loop. */
export function abortSignalWithTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (typeof timer.unref === 'function') timer.unref();
  return controller.signal;
}

/**
 * Race a promise against an AbortSignal. Rejects with the abort reason once
 * the signal fires. Used to enforce hard timeouts around bundle execution.
 */
export function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(apiErrorFromAbort(signal.reason));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(apiErrorFromAbort(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

function apiErrorFromAbort(reason: unknown): ApiError {
  return reason instanceof ApiError ? reason : ApiError.timeout();
}
