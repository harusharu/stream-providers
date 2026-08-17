// Remote gateway client with multi-host failover.
//
// When the in-process bundle isn't available (or execution is disabled), the
// gateway proxies calls to one or more remote gateway hosts — typically the
// Rust/actix deployment. `REMOTE_GATEWAY_HOSTS` is a comma-separated list; the
// client round-robins across hosts and temporarily quarantines any host that
// fails transiently (timeout, 5xx), trying the next one. That is the
// "multi-host support" of this module: a request keeps working as long as at
// least one host is healthy.

import { ApiError } from './errors.ts';

export interface RemoteSearchAll {
  data: unknown[];
  total: number;
  providers: number;
  failed: number;
}

export interface RemoteEnvelope {
  success: boolean;
  data?: unknown;
  error?: string;
  code?: string;
}

interface HostState {
  baseUrl: string;
  /** Until this epoch the host is quarantined and skipped. */
  cooldownUntil: number;
  consecutiveFailures: number;
}

const COOLDOWN_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 2;

/** Translate a remote envelope code back into an ApiError. */
export function fromRemoteEnvelope(envelope: RemoteEnvelope, httpStatus: number): ApiError {
  const code = envelope.code ?? 'UPSTREAM_ERROR';
  const message = envelope.error ?? 'remote gateway error';
  switch (code) {
    case 'BAD_REQUEST':
      return ApiError.from(message, 400, 'BAD_REQUEST');
    case 'INVALID_INPUT':
      return ApiError.from(message, 422, 'INVALID_INPUT');
    case 'RATE_LIMITED':
      return ApiError.from(message, 429, 'RATE_LIMITED');
    case 'TIMEOUT':
      return ApiError.timeout();
    case 'NOT_FOUND':
      return ApiError.from(message, 404, 'NOT_FOUND');
    case 'UPSTREAM_ERROR':
      return ApiError.upstream(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502, message);
    default:
      return ApiError.upstream(httpStatus, message);
  }
}

interface RemoteCallArgs {
  provider: string;
  module: string;
  fn: string;
  args: Record<string, unknown>;
  timeoutMs: number;
}

/**
 * Multi-host remote gateway client. Methods return the `data` field of the
 * remote envelope (mirroring the local execution path), and throw ApiErrors.
 */
export class RemoteGateway {
  private readonly hosts: HostState[];
  private readonly timeoutMs: number;
  private cursor = 0;

  constructor(baseUrls: string[], timeoutMs: number) {
    this.timeoutMs = timeoutMs;
    this.hosts = baseUrls
      .map((url) => url.replace(/\/+$/, ''))
      .map((baseUrl) => ({ baseUrl, cooldownUntil: 0, consecutiveFailures: 0 }));
  }

  get available(): boolean {
    return this.hosts.some((h) => h.cooldownUntil <= Date.now());
  }

  get hostCount(): number {
    return this.hosts.length;
  }

  /** True when at least one host is currently healthy. */
  healthy(): boolean {
    return this.available;
  }

  private nextHost(): HostState | undefined {
    const now = Date.now();
    for (let i = 0; i < this.hosts.length; i++) {
      const idx = (this.cursor + i) % this.hosts.length;
      const host = this.hosts[idx];
      if (host.cooldownUntil <= now) {
        this.cursor = (idx + 1) % this.hosts.length;
        return host;
      }
    }
    return undefined;
  }

  private markFailure(host: HostState): void {
    host.consecutiveFailures += 1;
    if (host.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      host.cooldownUntil = Date.now() + COOLDOWN_MS;
    }
  }

  private markSuccess(host: HostState): void {
    host.consecutiveFailures = 0;
    host.cooldownUntil = 0;
  }

  /**
   * Perform `fn` against each host in turn (skipping quarantined hosts) until
   * one succeeds. `fn` returns the raw data; transient failures move to the
   * next host. Non-transient errors (validation, not-found) fail fast.
   */
  private async withFailover<T>(fn: (host: HostState) => Promise<T>): Promise<T> {
    const attempts = new Set<HostState>();
    let lastError: ApiError | null = null;

    for (;;) {
      const host = this.nextHost();
      if (!host || attempts.has(host)) break;
      attempts.add(host);

      try {
        const value = await fn(host);
        this.markSuccess(host);
        return value;
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : ApiError.worker(String(err));
        lastError = apiErr;
        if (!apiErr.isTransient) throw apiErr;
        this.markFailure(host);
      }
    }

    throw lastError ?? ApiError.worker('no remote gateway host available');
  }

  /** Proxy a single provider call to the matching remote endpoint. */
  async call(req: RemoteCallArgs): Promise<unknown> {
    const { provider, module, fn, args, timeoutMs } = req;
    const spec = ENDPOINT_MAP[`${module}/${fn}`];
    if (!spec) throw ApiError.worker(`unsupported remote call: ${module}/${fn}`);

    const params: Record<string, string> = { provider };
    for (const [key, value] of Object.entries(spec.params(args))) {
      if (value !== undefined && value !== null && String(value) !== '')
        params[key] = String(value);
    }
    const query = new URLSearchParams(params).toString();
    const path = query ? `${spec.path}?${query}` : spec.path;

    return this.withFailover((host) => this.httpGet(host, path, timeoutMs).then((data) => data));
  }

  /** Proxy an aggregated search to the remote `/api/search-all`. */
  async searchAll(
    query: string,
    page: number,
    providers: string[],
    timeoutMs: number,
  ): Promise<RemoteSearchAll> {
    const params = new URLSearchParams({ query, page: String(page) });
    if (providers.length > 0) params.set('providers', providers.join(','));

    const envelope = await this.withFailover((host) =>
      this.httpGetEnvelope(host, `/api/search-all?${params.toString()}`, timeoutMs),
    );
    const data = (envelope.data ?? []) as unknown;
    return {
      data: Array.isArray(data) ? data : [],
      total:
        typeof envelope.data === 'object' && envelope.data !== null && 'total' in envelope.data
          ? Number((envelope.data as Record<string, unknown>)['total'] ?? 0)
          : 0,
      providers:
        typeof envelope.data === 'object' && envelope.data !== null && 'providers' in envelope.data
          ? Number((envelope.data as Record<string, unknown>)['providers'] ?? 0)
          : 0,
      failed:
        typeof envelope.data === 'object' && envelope.data !== null && 'failed' in envelope.data
          ? Number((envelope.data as Record<string, unknown>)['failed'] ?? 0)
          : 0,
    };
  }

  private async httpGetEnvelope(
    host: HostState,
    path: string,
    timeoutMs: number,
  ): Promise<RemoteEnvelope> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${host.baseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      let body: unknown;
      try {
        body = (await res.json()) as unknown;
      } catch {
        body = null;
      }
      if (!res.ok) {
        const env = (body ?? {}) as RemoteEnvelope;
        throw fromRemoteEnvelope(env, res.status);
      }
      const env = (body ?? {}) as RemoteEnvelope;
      if (!env.success) throw fromRemoteEnvelope(env, res.status || 502);
      return env;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw ApiError.timeout();
      throw ApiError.worker(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  private async httpGet(host: HostState, path: string, timeoutMs: number): Promise<unknown> {
    const envelope = await this.httpGetEnvelope(host, path, timeoutMs);
    return envelope.data;
  }
}

interface EndpointSpec {
  path: string;
  params: (args: Record<string, unknown>) => Record<string, unknown>;
}

const ENDPOINT_MAP: Record<string, EndpointSpec> = {
  'catalog/catalog': {
    path: '/api/catalog',
    params: () => ({}),
  },
  'posts/getSearchPosts': {
    path: '/api/search',
    params: (args) => ({ query: args.searchQuery, page: args.page }),
  },
  'meta/getMeta': {
    path: '/api/meta',
    params: (args) => ({ link: args.link }),
  },
  'episodes/getEpisodes': {
    path: '/api/episodes',
    params: (args) => ({ url: args.url }),
  },
  'stream/getStream': {
    path: '/api/stream',
    params: (args) => ({ link: args.link, type: args.type }),
  },
};
