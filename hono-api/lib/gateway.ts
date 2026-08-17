// The provider-execution port: local bundles + remote hosts.
//
// Handlers never touch execution internals; they call [`Gateway`] methods. The
// gateway picks the best backend per call:
//
//   1. **Local** — run `dist/<provider>/<module>.js` in-process when the
//      bundle exists and `LOCAL_EXECUTION` permits it.
//   2. **Remote** — proxy to a configured remote gateway host (with failover)
//      when the bundle is missing, execution is disabled, or the local run
//      failed transiently.
//
// This hybrid model is what keeps the API usable on a bare Netlify deploy
// (where only some bundles may be included) while still falling back to the
// full Rust gateway when one is configured.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  abortSignalWithTimeout,
  bundleExists,
  executeBundle,
  type ModuleName,
  withAbort,
} from './bundles.ts';
import type { Config } from './config.ts';
import { buildProviderContext, type ProviderContext } from './context.ts';
import { ApiError, toApiError } from './errors.ts';
import type { PostItem } from './model.ts';
import { applyTypeHints, inferType } from './model.ts';
import type { ProviderRegistry } from './providers.ts';
import { RemoteGateway } from './remote.ts';

export interface GatewayCall {
  provider: string;
  module: ModuleName;
  fn: string;
  args: Record<string, unknown>;
  /** Per-call hard timeout (ms). Defaults to `CALL_TIMEOUT_MS`. */
  timeoutMs?: number;
}

export interface SearchAllResult {
  data: PostItem[];
  total: number;
  providers: number;
  failed: number;
}

/** A tiny concurrency limiter for in-process provider executions. */
class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
      return () => {
        this.active -= 1;
        this.waiters.shift()?.();
      };
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    return this.acquire();
  }
}

/** Race a promise against a hard timeout, rejecting with ApiError.timeout(). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(ApiError.timeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** A timeout signal wired to the provider's `AbortSignal` param. */
function abortSignal(ms: number): AbortSignal {
  return abortSignalWithTimeout(ms);
}

/**
 * Provider gateway combining in-process bundle execution with remote-host
 * failover. Constructed once per process (module-level singleton) and shared
 * by every request.
 */
export class Gateway {
  private readonly remote: RemoteGateway | null;
  private readonly semaphore: Semaphore;
  private contextPromise: Promise<ProviderContext> | null = null;
  private readonly config: Config;
  private readonly registry: ProviderRegistry;

  constructor(config: Config, registry: ProviderRegistry) {
    this.config = config;
    this.registry = registry;
    this.semaphore = new Semaphore(config.localConcurrency);
    this.remote =
      config.remoteGatewayHosts.length > 0
        ? new RemoteGateway(config.remoteGatewayHosts, config.remoteTimeoutMs)
        : null;
  }

  private getProviderContext(): Promise<ProviderContext> {
    if (!this.contextPromise) {
      this.contextPromise = Promise.resolve().then(() =>
        buildProviderContext(this.config.providersRoot),
      );
    }
    return this.contextPromise;
  }

  /** Whether the requested bundle can run in-process. */
  canExecuteLocally(provider: string, module: ModuleName): boolean {
    if (this.config.localExecution === 'never') return false;
    if (this.config.localExecution === 'always') return true;
    return bundleExists(this.config.providersRoot, provider, module);
  }

  /**
   * Execute one provider call. Local-first, remote fallback on transient
   * failure or when the bundle is missing.
   */
  async call(req: GatewayCall): Promise<unknown> {
    const canLocal = this.canExecuteLocally(req.provider, req.module);

    if (canLocal) {
      try {
        return await this.callLocal(req);
      } catch (err) {
        // Provider bundle rejections are upstream scraping failures (the
        // worker raised while fetching a host), mirroring the Rust gateway
        // which maps worker rejections to 502 UPSTREAM_ERROR. Only typed
        // ApiErrors (timeout, 4xx validation) keep their own status.
        const apiErr =
          err instanceof ApiError
            ? err
            : ApiError.upstream(502, err instanceof Error ? err.message : String(err));
        if (!this.remote || !apiErr.isTransient) throw apiErr;
        // Fall through to the remote host(s).
      }
    }

    if (this.remote) {
      return this.remote.call({ ...req, timeoutMs: req.timeoutMs ?? this.config.callTimeoutMs });
    }

    throw ApiError.worker(
      `bundle not found: ${req.provider}/${req.module}.js (build with npm run build or configure REMOTE_GATEWAY_HOSTS)`,
    );
  }

  private async callLocal(req: GatewayCall): Promise<unknown> {
    const providerContext = await this.getProviderContext();
    const release = await this.semaphore.acquire();
    const timeoutMs = req.timeoutMs ?? this.config.callTimeoutMs;
    try {
      const signal = abortSignal(this.config.workerTimeoutMs);
      return await withTimeout(
        executeBundle(this.config.providersRoot, {
          provider: req.provider,
          module: req.module,
          fn: req.fn,
          args: req.args,
          signal,
          providerContext,
          workerTimeoutMs: this.config.workerTimeoutMs,
        }),
        timeoutMs,
      );
    } finally {
      release();
    }
  }

  /**
   * Aggregated search across the requested providers (or every enabled one).
   * Fans out concurrently, tolerates slow/failing providers, dedupes by
   * `provider|title|link`, and tags each item with `provider`/`providerName`.
   * Each provider call is bounded by `SEARCH_ALL_TIMEOUT_MS` so a hung host
   * is cut from the response without stalling the search bar.
   */
  async searchAll(query: string, page: number, providers: string[]): Promise<SearchAllResult> {
    const selected = this.selectEntries(providers);
    if (selected.length === 0) throw ApiError.providerNotFound(providers.join(','));

    const seen = new Set<string>();
    const data: PostItem[] = [];
    let failed = 0;

    const results = await Promise.allSettled(
      selected.map((entry) =>
        this.call({
          provider: entry.value,
          module: 'posts',
          fn: 'getSearchPosts',
          args: { searchQuery: query, page, providerValue: entry.value },
          timeoutMs: this.config.searchAllTimeoutMs,
        }),
      ),
    );

    results.forEach((outcome, idx) => {
      const entry = selected[idx];
      if (outcome.status === 'rejected') {
        failed += 1;
        return;
      }
      const typed = applyTypeHints(outcome.value);
      if (!Array.isArray(typed)) {
        failed += 1;
        return;
      }
      for (const rawItem of typed as PostItem[]) {
        if (rawItem === null || typeof rawItem !== 'object') continue;
        const title = typeof rawItem['title'] === 'string' ? (rawItem['title'] as string) : '';
        const link = typeof rawItem['link'] === 'string' ? (rawItem['link'] as string) : '';
        const key = `${entry.value}|${title}|${link}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const type = typeof rawItem['type'] === 'string' ? rawItem['type'] : inferType(link, title);
        data.push({
          ...rawItem,
          type,
          provider: entry.value,
          providerName: entry.display_name,
        });
      }
    });

    return { data, total: data.length, providers: selected.length, failed };
  }

  private selectEntries(requested: string[]): Array<{ value: string; display_name: string }> {
    const all = this.registry.entries.map((e) => ({
      value: e.value,
      display_name: e.display_name,
    }));
    if (requested.length === 0) return all;
    const wanted = new Set(requested);
    return all.filter((e) => wanted.has(e.value));
  }

  /** True when at least one execution path is usable (for `/health`). */
  async healthy(): Promise<boolean> {
    if (this.config.localExecution === 'never') return this.remote?.healthy() ?? false;
    if (existsSync(join(this.config.providersRoot, 'dist'))) return true;
    return this.remote?.healthy() ?? false;
  }
}
