// In-process provider execution context.
//
// Mirrors `worker/context.js` (the Node sidecar shim) so the dist bundles can
// run inside this process without spawning child workers. Critical piece: an
// axios adapter + `fetch` shim backed by `curl-cffi-node` for Chrome TLS
// fingerprint impersonation (what lets the bundles past Cloudflare/WAF).
//
// Unlike the sidecar, execution here **degrades gracefully**:
//   - If `curl-cffi-node` is unavailable (native module not built for the
//     platform), axios/fetch fall back to their native transports — the API
//     still works, it just won't impersonate Chrome.
//   - The provider URL manifest endpoint comes from `URLS_MANIFEST_URL` (see
//     .env.example). When set, that exact URL is intercepted and the
//     locally-deployed `urls.json` (identical data) is served as a cache
//     fallback on fetch failure; when unset, the fetch goes to the network.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import type { AxiosInstance } from 'axios';

// Manifest endpoint configured via URLS_MANIFEST_URL; empty = not overridden.
let envLoaded = false;

/** Load the repo `.env` (same file the Rust side reads) for local runs. */
function ensureRepoEnvLoaded(providersRoot: string): void {
  if (envLoaded) return;
  envLoaded = true;
  const load = (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof load !== 'function') return;
  for (const candidate of [join(providersRoot, '.env'), join(process.cwd(), '.env')]) {
    try {
      load(candidate);
    } catch {
      // .env optional — fall through to the next candidate
    }
  }
}

function manifestUrl(): string {
  const fromEnv = process.env.URLS_MANIFEST_URL;
  return fromEnv && fromEnv.trim() !== '' ? fromEnv.trim() : '';
}

/** Load a module, first from this package's node_modules, then the repo root. */
function resolveOptional<T>(providersRoot: string, name: string): T | undefined {
  const fromHere = createRequire(import.meta.url);
  const fromRoot = createRequire(join(providersRoot, 'package.json'));
  for (const req of [fromHere, fromRoot]) {
    try {
      return req(name) as T;
    } catch {
      // try the next resolver
    }
  }
  return undefined;
}

export interface ProviderContext {
  axios: AxiosInstance;
  cheerio: typeof import('cheerio');
  Aes: null;
  commonHeaders: Record<string, string>;
}

interface CffiResponse {
  status: number;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  buffer: () => Buffer;
}

interface CffiClient {
  get: (url: string, opts: Record<string, unknown>) => Promise<CffiResponse>;
  post: (url: string, opts: Record<string, unknown>) => Promise<CffiResponse>;
}

let localUrls: Record<string, unknown> | null = null;

/** Read the locally-deployed urls.json once (cached). */
function getLocalUrls(providersRoot: string): Record<string, unknown> {
  if (localUrls !== null) return localUrls;
  const path = join(providersRoot, 'urls.json');
  try {
    localUrls = existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>)
      : {};
  } catch {
    localUrls = {};
  }
  return localUrls;
}

function decompressBuffer(raw: Buffer, headers: unknown): Buffer {
  let encoding = '';
  if (headers && typeof headers === 'object') {
    const h = headers as Record<string, unknown>;
    if (typeof (h as { get?: unknown }).get === 'function') {
      encoding = String(
        (h as { get: (n: string) => string | undefined }).get('content-encoding') ?? '',
      );
    } else {
      encoding = String(h['content-encoding'] ?? h['Content-Encoding'] ?? '');
    }
  }
  if (!encoding) return raw;
  const enc = encoding.toLowerCase();
  try {
    if (enc.includes('br')) return brotliDecompressSync(raw);
    if (enc.includes('gzip')) return gunzipSync(raw);
    if (enc.includes('deflate')) return inflateSync(raw);
  } catch {
    // leave raw; callers usually tolerate it
  }
  return raw;
}

function cffiHeaders(res: CffiResponse) {
  return {
    get: (name: string) => res.headers[name.toLowerCase()],
    has: (name: string) => res.headers[name.toLowerCase()] !== undefined,
  };
}

/** Normalise a `Headers` or plain record into `[key, value]` pairs. */
function headersEntries(h: Headers | Record<string, string>): Array<[string, string]> {
  if (h instanceof Headers) {
    const out: Array<[string, string]> = [];
    h.forEach((value, key) => out.push([key, value]));
    return out;
  }
  return Object.entries(h);
}

/**
 * Build (once) and return the provider context. Installs the global `fetch`
 * shim + axios adapter the dist bundles depend on. Safe to call multiple times.
 */
export function buildProviderContext(providersRoot: string): ProviderContext {
  const axios = resolveOptional<AxiosInstance>(providersRoot, 'axios');
  const cheerio = resolveOptional<typeof import('cheerio')>(providersRoot, 'cheerio');
  const cffi = resolveOptional<CffiClient>(providersRoot, 'curl-cffi-node');

  if (!axios) throw new Error('axios is required for provider execution');
  if (!cheerio) throw new Error('cheerio is required for provider execution');

  const urls = getLocalUrls(providersRoot);
  ensureRepoEnvLoaded(providersRoot);
  const manifest = manifestUrl();

  // --- fetch shim --------------------------------------------------------
  // urls.json manifest (when URLS_MANIFEST_URL is set): REAL fetch first;
  // locally-deployed copy on failure.
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (manifest !== '' && url === manifest) {
      try {
        const res = await nativeFetch(manifest, init);
        if (res.ok) return res;
        throw new Error(`urls.json fetch failed: HTTP ${res.status}`);
      } catch (err) {
        console.warn(`[context] urls.json fetch failed, using local copy: ${String(err)}`);
        return new Response(JSON.stringify(urls), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!cffi) {
      return nativeFetch(input, init);
    }

    const method = (init?.method ?? 'get').toLowerCase();
    const reqHeaders: Record<string, string> = {};
    if (init?.headers) {
      for (const [key, value] of headersEntries(init.headers as Headers | Record<string, string>)) {
        if (key.toLowerCase() === 'accept-encoding') continue;
        if (value !== undefined && value !== null) reqHeaders[key] = String(value);
      }
    }
    const res = await cffi.get(url, {
      headers: reqHeaders,
      data: init?.body,
      impersonate: 'chrome120',
      verify: false,
      allowRedirects: init?.redirect === 'manual' ? false : true,
    });
    const decoded = decompressBuffer(res.buffer(), res.headers);
    const text = decoded.toString('utf8');
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      url: res.url ?? url,
      headers: cffiHeaders(res),
      text: () => Promise.resolve(text),
      json: () => Promise.resolve(JSON.parse(text)),
      buffer: () => Promise.resolve(decoded),
      arrayBuffer: () => Promise.resolve(decoded.buffer as ArrayBuffer),
    } as unknown as Response;
  };

  // --- axios adapter ------------------------------------------------------
  // Only when TLS impersonation is available; otherwise keep axios defaults.
  if (cffi) {
    const adapter = async (config: {
      method?: string;
      url?: string;
      baseURL?: string;
      headers?: Record<string, unknown>;
      data?: unknown;
      maxRedirects?: number;
      responseType?: string;
      signal?: AbortSignal;
    }): Promise<unknown> => {
      const method = (config.method ?? 'get').toLowerCase();
      let url = config.url ?? '';
      if (config.baseURL && !url.startsWith('http')) url = config.baseURL + url;

      const reqHeaders: Record<string, string> = {};
      if (config.headers) {
        for (const [key, value] of Object.entries(config.headers)) {
          if (key.toLowerCase() === 'accept-encoding') continue;
          if (value !== undefined && value !== null) reqHeaders[key] = String(value);
        }
      }
      const fn =
        (
          cffi as unknown as Record<
            string,
            (u: string, o: Record<string, unknown>) => Promise<CffiResponse>
          >
        )[method] ?? cffi.get;
      const res = await fn(url, {
        headers: reqHeaders,
        data: config.data,
        impersonate: 'chrome120',
        verify: false,
        allowRedirects: config.maxRedirects !== 0,
      });

      const decoded = decompressBuffer(res.buffer(), res.headers);
      const contentType = cffiHeaders(res).get('content-type') ?? '';
      let data: unknown;
      if (config.responseType === 'arraybuffer' || config.responseType === 'stream') {
        data = decoded;
      } else {
        data = decoded.toString('utf8');
        if (config.responseType === 'json' || contentType.includes('application/json')) {
          try {
            data = JSON.parse(data as string);
          } catch {
            // leave as string
          }
        }
      }
      return {
        data,
        status: res.status,
        statusText: 'OK',
        headers: cffiHeaders(res),
        config,
        request: {},
      };
    };
    axios.defaults.adapter = adapter as AxiosInstance['defaults']['adapter'];
  }

  const commonHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  return {
    axios,
    cheerio,
    Aes: null,
    commonHeaders,
  };
}
