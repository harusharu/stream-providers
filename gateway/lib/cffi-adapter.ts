// curl-cffi-node TLS impersonation adapter.
//
// Provides Chrome TLS fingerprint impersonation via `curl-cffi-node` for both
// the global `fetch` shim and the axios adapter. This is what lets provider
// bundles bypass Cloudflare/WAF protections.
//
// Degrades gracefully: when `curl-cffi-node` isn't available (native module
// not built for the platform), axios/fetch fall back to their native
// transports — the API still works, it just won't impersonate Chrome.

import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CffiResponse {
  status: number;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  buffer: () => Buffer;
}

export interface CffiClient {
  get: (url: string, opts: Record<string, unknown>) => Promise<CffiResponse>;
  post: (url: string, opts: Record<string, unknown>) => Promise<CffiResponse>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decompress a response buffer based on Content-Encoding header. */
export function decompressBuffer(raw: Buffer, headers: unknown): Buffer {
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

/** Wrap cffi response headers in a get/has accessor. */
export function cffiHeaders(res: CffiResponse) {
  return {
    get: (name: string) => res.headers[name.toLowerCase()],
    has: (name: string) => res.headers[name.toLowerCase()] !== undefined,
  };
}

/** Normalise a `Headers` or plain record into `[key, value]` pairs. */
export function headersEntries(h: Headers | Record<string, string>): Array<[string, string]> {
  if (h instanceof Headers) {
    const out: Array<[string, string]> = [];
    h.forEach((value, key) => out.push([key, value]));
    return out;
  }
  return Object.entries(h);
}

// ---------------------------------------------------------------------------
// Fetch shim
// ---------------------------------------------------------------------------

/**
 * Install the global `fetch` shim backed by curl-cffi-node. When `cffi` is
 * null, this is a no-op and the native fetch is preserved.
 */
export function installFetchShim(cffi: CffiClient | undefined): void {
  if (!cffi) return;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

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
}

// ---------------------------------------------------------------------------
// Axios adapter
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';

/**
 * Wire the curl-cffi-node adapter into axios for TLS impersonation.
 * No-op when `cffi` is undefined.
 */
export function installAxiosAdapter(axios: AxiosInstance, cffi: CffiClient | undefined): void {
  if (!cffi) return;

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
