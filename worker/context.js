"use strict";

// Provider execution context for the sidecar worker.
//
// Mirrors providers/providerContext.ts but as plain CJS and WITHOUT the
// fragile esbuild post-processing that breaks in plain Node. The critical
// piece is the axios adapter + fetch shim backed by `curl-cffi-node`, which
// performs Chrome TLS fingerprint impersonation — that is what lets the
// provider bundles get past Cloudflare/WAF on the upstream hosters.

const axios = require("axios");
const cheerio = require("cheerio");
const zlib = require("zlib");

let cffi = null;
try {
  cffi = require("curl-cffi-node");
} catch (e) {
  throw new Error(
    `curl-cffi-node is required but could not be loaded: ${e.message}. ` +
      "Run `npm install` in the stream-providers root so the sidecar can resolve it.",
  );
}

function decompressBuffer(rawBuffer, headers) {
  let contentEncoding = "";
  if (headers && typeof headers === "object") {
    if (typeof headers.get === "function") {
      contentEncoding = headers.get("content-encoding") || "";
    } else {
      contentEncoding =
        headers["content-encoding"] || headers["Content-Encoding"] || "";
    }
  }

  let decodedBuffer = rawBuffer;
  if (contentEncoding) {
    const enc = contentEncoding.toLowerCase();
    try {
      if (enc.includes("br")) decodedBuffer = zlib.brotliDecompressSync(rawBuffer);
      else if (enc.includes("gzip")) decodedBuffer = zlib.gunzipSync(rawBuffer);
      else if (enc.includes("deflate")) decodedBuffer = zlib.inflateSync(rawBuffer);
    } catch (e) {
      // Leave the buffer as-is; the caller usually tolerates raw bytes.
    }
  }
  return decodedBuffer;
}

function pickHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

async function cffiRequest(method, url, { headers, data, allowRedirects }) {
  const func = cffi[method] || cffi.get;
  const res = await func(url, {
    headers,
    data,
    impersonate: "chrome120",
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
axios.defaults.adapter = async (config) => {
  const method = (config.method || "get").toLowerCase();
  let url = config.url || "";
  if (config.baseURL && !url.startsWith("http")) url = config.baseURL + url;

  const reqHeaders = {};
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      if (key.toLowerCase() === "accept-encoding") continue;
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
  const contentType = pickHeader(res.headers, "content-type");
  if (config.responseType === "arraybuffer" || config.responseType === "stream") {
    data = decodedBuffer;
  } else {
    data = decodedBuffer.toString("utf8");
    if (config.responseType === "json" || contentType.includes("application/json")) {
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
    statusText: "OK",
    headers: cffiHeaders(res),
    config,
    request: {},
  };
};

// 2. Hijack global.fetch the same way.
const nativeFetch = global.fetch;
global.fetch = async (input, options = {}) => {
  const method = (options.method || "get").toLowerCase();
  const reqHeaders = {};
  if (options.headers) {
    const headersObj =
      options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : options.headers;
    for (const [key, value] of Object.entries(headersObj)) {
      if (key.toLowerCase() === "accept-encoding") continue;
      if (value !== undefined && value !== null) reqHeaders[key] = String(value);
    }
  }

  const res = await cffiRequest(method, input.toString(), {
    headers: reqHeaders,
    data: options.body,
    allowRedirects: options.redirect === "manual" ? false : true,
  });

  const decodedBuffer = decompressBuffer(res.buffer(), res.headers);
  const textContent = decodedBuffer.toString("utf8");

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
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
  },
};

module.exports = { providerContext, nativeFetch };