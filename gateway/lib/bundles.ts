// Local dist-bundle loader + runner.
//
// Loads `dist/<provider>/<module>.js` bundles (built by `npm run build`) and
// executes them in-process:
//
//   - catalog.js exports plain arrays (`catalog`, `genres`) → concatenated.
//   - posts/meta/episodes/stream export functions taking
//     `{ ...args, signal, providerContext }`.
//
// Bundles are cached per `provider/module` so repeated calls don't re-parse
// megabytes of esbuild output.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProviderContext } from './context.ts';
import { ApiError } from './errors.ts';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

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
export function bundleExists(provider: string, module: ModuleName): boolean {
  return existsSync(join(repoRoot, 'dist', provider, `${module}.js`));
}

function bundlePath(provider: string, module: ModuleName): string {
  return join(repoRoot, 'dist', provider, `${module}.js`);
}

const bundleCache = new Map<string, Record<string, unknown>>();

export function loadBundle(provider: string, module: ModuleName): Record<string, unknown> {
  const key = `${provider}/${module}`;
  const cached = bundleCache.get(key);
  if (cached) return cached;

  const path = bundlePath(provider, module);
  if (!existsSync(path)) {
    throw ApiError.worker(`bundle not found: ${key} (expected ${path})`);
  }
  const requireFromRoot = createRequire(join(repoRoot, 'package.json'));
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
export async function executeBundle(req: CallRequest): Promise<unknown> {
  const { provider, module, fn, args, providerContext } = req;

  if (module === 'catalog') {
    const mod = loadBundle(provider, module);
    const catalog = Array.isArray(mod['catalog']) ? (mod['catalog'] as unknown[]) : [];
    const genres = Array.isArray(mod['genres']) ? (mod['genres'] as unknown[]) : [];
    return [...catalog, ...genres];
  }

  const mod = loadBundle(provider, module);
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
