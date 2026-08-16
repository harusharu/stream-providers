'use strict';

// Provider execution context for the sidecar worker.
//
// Mirrors providers/providerContext.ts but as plain CJS and WITHOUT the
// fragile esbuild post-processing that breaks in plain Node. The critical
// piece is the axios adapter + fetch shim backed by `curl-cffi-node`, which
// performs Chrome TLS fingerprint impersonation — that is what lets the
// provider bundles get past Cloudflare/WAF on the upstream hosters.
//
// `curl-cffi-node` is OPTIONAL: when the native binary is unavailable the
// worker degrades gracefully to axios/fetch's native transports — the API
// still works, it just won't impersonate Chrome.
//
// `getBaseUrl()` reads the manifest endpoint from `URLS_MANIFEST_URL` (see
// .env.example). When that variable is set we intercept the exact URL and
// fall back to the locally-deployed `urls.json` (identical data) on failure;
// when unset, the fetch goes straight to the network.

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = process.env.PROVIDERS_ROOT || path.join(__dirname, '..');
const URLS_JSON = path.join(ROOT, 'urls.json');
const URLS_MANIFEST_URL = (process.env.URLS_MANIFEST_URL || '').trim();

let localUrls = null;

function getLocalUrls() {
  if (localUrls !== null) return localUrls;
  try {
    localUrls = fs.existsSync(URLS_JSON) ? JSON.parse(fs.readFileSync(URLS_JSON, 'utf8')) : {};
  } catch (e) {
    localUrls = {};
  }
  return localUrls;
}

let cffi = null;
try {
  cffi = require('curl-cffi-node');
} catch (e) {
  console.warn(
    `[context] curl-cffi-node unavailable; falling back to native fetch/axios: ${e.message}`,
  );
}

function decompressBuffer(rawBuffer, headers) {
  let contentEncoding = '';
  if (headers && typeof headers === 'object') {
    if (typeof headers.get === 'function') {
      contentEncoding = headers.get('content-encoding') || '';
    } else {
      contentEncoding = headers['content-encoding'] || headers['Content-Encoding'] || '';
    }
  }

  let decodedBuffer = rawBuffer;
  if (contentEncoding) {
    const enc = contentEncoding.toLowerCase();
    try {
      if (enc.includes('br')) decodedBuffer = zlib.brotliDecompressSync(rawBuffer);
      else if (enc.includes('gzip')) decodedBuffer = zlib.gunzipSync(rawBuffer);
      else if (enc.includes('deflate')) decodedBuffer = zlib.inflateSync(rawBuffer);
    } catch (e) {
      // Leave the buffer as-is; the caller usually tolerates raw bytes.
    }
  }
  return decodedBuffer;
}

function pickHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  return headers[name] || headers[name.toLowerCase()] || '';
}

async function cffiRequest(method, url, { headers, data, allowRedirects }) {
  const func = cffi[method] || cffi.get;
  const res = await func(url, {
    headers,
    data,
    impersonate: 'chrome120',
    verify: false,
    allowRedirects: allowRedirects === false ? false : true,
  });
  return res;
}

function cffiHeaders(res) {
  return {
    get: (name) => (res.headers || {})[name.toLowerCase()],
    has: (name) => !!(res.headers || {})[name.toLowerCase()],
  };
}

// 1. Hijack axios globally so every provider axios call uses curl-cffi.
//    Skipped entirely when curl-cffi-node is unavailable (native axios used).
if (cffi) {
  axios.defaults.adapter = async (config) => {
    const method = (config.method || 'get').toLowerCase();
    let url = config.url || '';
    if (config.baseURL && !url.startsWith('http')) url = config.baseURL + url;

    const reqHeaders = {};
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        if (key.toLowerCase() === 'accept-encoding') continue;
        if (value !== undefined && value !== null) reqHeaders[key] = String(value);
      }
    }

    const res = await cffiRequest(method, url, {
      headers: reqHeaders,
      data: config.data,
      allowRedirects: config.maxRedirects !== 0,
    });

    const decodedBuffer = decompressBuffer(res.buffer(), res.headers);
    let data;
    const contentType = pickHeader(res.headers, 'content-type');
    if (config.responseType === 'arraybuffer' || config.responseType === 'stream') {
      data = decodedBuffer;
    } else {
      data = decodedBuffer.toString('utf8');
      if (config.responseType === 'json' || contentType.includes('application/json')) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          /* leave as string */
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
}

// 2. Hijack global.fetch the same way.
const nativeFetch = global.fetch;
global.fetch = async (input, options = {}) => {
  // urls.json manifest (when URLS_MANIFEST_URL is set): REAL fetch first;
  // locally-deployed copy only on failure.
  const rawUrl = typeof input === 'string' ? input : input && input.url;
  if (URLS_MANIFEST_URL && rawUrl === URLS_MANIFEST_URL) {
    try {
      const res = await nativeFetch(URLS_MANIFEST_URL, options);
      if (res.ok) return res;
      throw new Error(`urls.json fetch failed: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[context] urls.json fetch failed, using local copy: ${err.message}`);
      return new Response(JSON.stringify(getLocalUrls()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // No curl-cffi: fall through to whatever fetch was installed before.
  if (!cffi) {
    return nativeFetch(input, options);
  }

  const method = (options.method || 'get').toLowerCase();
  const reqHeaders = {};
  if (options.headers) {
    const headersObj =
      options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : options.headers;
    for (const [key, value] of Object.entries(headersObj)) {
      if (key.toLowerCase() === 'accept-encoding') continue;
      if (value !== undefined && value !== null) reqHeaders[key] = String(value);
    }
  }

  const res = await cffiRequest(method, input.toString(), {
    headers: reqHeaders,
    data: options.body,
    allowRedirects: options.redirect === 'manual' ? false : true,
  });

  const decodedBuffer = decompressBuffer(res.buffer(), res.headers);
  const textContent = decodedBuffer.toString('utf8');

  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    url: res.url,
    headers: cffiHeaders(res),
    text: () => Promise.resolve(textContent),
    json: () => Promise.resolve(JSON.parse(textContent)),
    buffer: () => Promise.resolve(decodedBuffer),
    arrayBuffer: () => Promise.resolve(decodedBuffer.buffer),
  };
};

const providerContext = {
  axios,
  cheerio,
  Aes: null,
  commonHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
  },
};

module.exports = { providerContext, nativeFetch };
