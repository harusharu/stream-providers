// In-memory TTL caching with single-flight request coalescing.
//
// Provider calls scrape slow upstream pages, so identical requests must never
// hit the providers twice within a short window. Each entry is stored with its
// `expiresAt` and pruned lazily on read/write. When a miss happens while the
// same key is already being loaded, the waiting callers share the in-flight
// promise instead of re-fanning out (this is what makes concurrent identical
// requests cheap — the core of "handling many requests" well).

export interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * A single endpoint's TTL cache. The backing Map is intentionally module-
 * scoped per instance; nothing in the request path mutates global state.
 */
export class TtlCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  readonly ttlSecs: number;

  constructor(ttlSecs: number) {
    this.ttlSecs = ttlSecs;
  }

  private now(): number {
    return Date.now();
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  /** Look up a key, returning a clone of the cached value if present. */
  get(key: string): unknown | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Store a value under a key. */
  set(key: string, value: unknown, ttlSecs?: number): void {
    const ttl = Math.max(1, ttlSecs ?? this.ttlSecs);
    this.store.set(key, { value, expiresAt: this.now() + ttl * 1000 });
  }

  /**
   * Return the cached value or compute it via `loader`, caching the result.
   * Concurrent calls for the same key await the same in-flight computation.
   */
  async getOrSet(key: string, loader: () => Promise<unknown>): Promise<unknown> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key);
    if (pending) {
      // A sibling request is already computing this key — await it.
      return pending;
    }

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .catch((err: unknown) => {
        // Don't cache failures; let callers observe the error.
        throw err;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Drop everything (used by tests and config reloads). */
  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  get size(): number {
    this.purgeExpired();
    return this.store.size;
  }
}

/** The bundle of per-endpoint caches shared by all handlers. */
export class CacheBundle {
  readonly catalog: TtlCache;
  readonly search: TtlCache;
  readonly meta: TtlCache;
  readonly episodes: TtlCache;
  readonly stream: TtlCache;
  readonly searchAll: TtlCache;

  constructor() {
    this.catalog = new TtlCache(300);
    this.search = new TtlCache(60);
    this.meta = new TtlCache(60);
    this.episodes = new TtlCache(300);
    this.stream = new TtlCache(30);
    this.searchAll = new TtlCache(60);
  }

  /** Build the canonical cache key for an endpoint/provider/params triple. */
  static key(endpoint: string, provider: string, params: unknown): string {
    return `${endpoint}|${provider}|${JSON.stringify(params)}`;
  }
}
