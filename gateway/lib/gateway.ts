import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { channelList } from '../../providers/_shared/sites.ts';
import {
  abortSignalWithTimeout,
  bundleExists,
  executeBundle,
  repoRoot,
  type ModuleName,
} from './bundles.ts';
import { buildProviderContext, type ProviderContext } from './context.ts';
import { ApiError } from './errors.ts';
import type { PostItem } from './model.ts';
import { applyTypeHints, inferType } from './model.ts';

const CALL_TIMEOUT_MS = 75_000;
const WORKER_TIMEOUT_MS = 60_000;
const SEARCH_ALL_TIMEOUT_MS = 20_000;
const LOCAL_CONCURRENCY = 8;

export interface GatewayCall {
  provider: string;
  module: ModuleName;
  fn: string;
  args: Record<string, unknown>;
  timeoutMs?: number;
}

export interface SearchAllResult {
  data: PostItem[];
  total: number;
  providers: number;
  failed: number;
}

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

export class Gateway {
  private readonly semaphore = new Semaphore(LOCAL_CONCURRENCY);
  private contextPromise: Promise<ProviderContext> | null = null;

  private getProviderContext(): Promise<ProviderContext> {
    if (!this.contextPromise) {
      this.contextPromise = Promise.resolve().then(() => buildProviderContext());
    }
    return this.contextPromise;
  }

  async call(req: GatewayCall): Promise<unknown> {
    if (!bundleExists(req.provider, req.module)) {
      throw ApiError.worker(
        `bundle not found: ${req.provider}/${req.module}.js (run npm run build)`,
      );
    }
    const providerContext = await this.getProviderContext();
    const release = await this.semaphore.acquire();
    const timeoutMs = req.timeoutMs ?? CALL_TIMEOUT_MS;
    try {
      const signal = abortSignalWithTimeout(WORKER_TIMEOUT_MS);
      return await withTimeout(
        executeBundle({
          provider: req.provider,
          module: req.module,
          fn: req.fn,
          args: req.args,
          signal,
          providerContext,
          workerTimeoutMs: WORKER_TIMEOUT_MS,
        }),
        timeoutMs,
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.upstream(502, err instanceof Error ? err.message : String(err));
    } finally {
      release();
    }
  }

  async searchAll(query: string, page: number, providers: string[]): Promise<SearchAllResult> {
    const selected = this.selectChannels(providers);
    if (selected.length === 0) throw ApiError.providerNotFound(providers.join(','));

    const seen = new Set<string>();
    const data: PostItem[] = [];
    let failed = 0;

    const results = await Promise.allSettled(
      selected.map((channel) =>
        this.call({
          provider: channel.id,
          module: 'posts',
          fn: 'getSearchPosts',
          args: { searchQuery: query, page, providerValue: channel.id },
          timeoutMs: SEARCH_ALL_TIMEOUT_MS,
        }),
      ),
    );

    results.forEach((outcome, idx) => {
      const channel = selected[idx];
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
        const key = `${channel.id}|${title}|${link}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const type =
          typeof rawItem['type'] === 'string'
            ? (rawItem['type'] as string)
            : inferType(link, title);
        data.push({
          ...rawItem,
          type,
          provider: channel.id,
          providerName: channel.name,
        });
      }
    });

    return { data, total: data.length, providers: selected.length, failed };
  }

  private selectChannels(requested: string[]): Array<{ id: string; name: string }> {
    const all = channelList();
    if (requested.length === 0) return all;
    const wanted = new Set(requested);
    return all.filter((channel) => wanted.has(channel.id));
  }

  async healthy(): Promise<boolean> {
    return existsSync(join(repoRoot, 'dist'));
  }
}
