"use strict";

// Sidecar worker executed by the Rust API gateway.
//
// Protocol: newline-delimited JSON on stdin/stdout.
//   in:  {"id":1,"method":"call","params":{"provider":"showbox","module":"posts","fn":"getPosts","args":{...}}}
//   out: {"id":1,"ok":true,"data":<result>}
//   out: {"id":1,"ok":false,"error":{"message":"...","status":500}}
//   in:  {"id":2,"method":"ping"}
//   out: {"id":2,"ok":true,"data":{"pong":true}}
//
// stdout carries ONLY the IPC protocol. All provider logs are redirected to
// stderr so a provider's `console.log(html)` can never corrupt the channel.

const readline = require("readline");
const path = require("path");
const fs = require("fs");

const ROOT = process.env.PROVIDERS_ROOT || path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const URLS_JSON = path.join(ROOT, "urls.json");
const URLS_ENDPOINT =
  "https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json";

const WORKER_TIMEOUT_MS = Number(process.env.WORKER_TIMEOUT_MS || 60000);

// --- Redirect provider logging to stderr (never stdout). -----------------
function toStderr(...args) {
  const line = args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
  process.stderr.write(`[provider] ${line}\n`);
}
console.log = toStderr;
console.info = toStderr;
console.warn = toStderr;
console.error = toStderr;

// --- Serve urls.json locally so getBaseUrl() never hits GitHub. ----------
const localUrls = fs.existsSync(URLS_JSON)
  ? JSON.parse(fs.readFileSync(URLS_JSON, "utf8"))
  : {};
const nativeFetch = global.fetch;

global.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url === URLS_ENDPOINT) {
    return new Response(JSON.stringify(localUrls), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return nativeFetch(input, init);
};

// --- Provider bundle cache -------------------------------------------------
const bundleCache = new Map();

function loadBundle(provider, moduleName) {
  const key = `${provider}/${moduleName}`;
  if (!bundleCache.has(key)) {
    const file = path.join(DIST, provider, `${moduleName}.js`);
    if (!fs.existsSync(file)) {
      throw new Error(`bundle not found: ${key} (expected ${file})`);
    }
    bundleCache.set(key, require(file));
  }
  return bundleCache.get(key);
}

function abortSignalWithTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  // Keep node from holding the event loop open just for a pending timer
  // after the call already finished.
  if (timer.unref) timer.unref();
  return controller.signal;
}

// Build the argument object each provider function expects.
function buildArgs(fn, args) {
  switch (fn) {
    case "getPosts":
      return {
        filter: args.filter || "",
        page: Number(args.page || 1),
        providerValue: args.providerValue || "",
        signal: abortSignalWithTimeout(WORKER_TIMEOUT_MS),
      };
    case "getSearchPosts":
      return {
        searchQuery: args.searchQuery || "",
        page: Number(args.page || 1),
        providerValue: args.providerValue || "",
        signal: abortSignalWithTimeout(WORKER_TIMEOUT_MS),
      };
    case "getMeta":
      return {
        link: args.link || "",
        providerValue: args.providerValue || "",
      };
    case "getEpisodes":
      return {
        url: args.url || "",
        providerValue: args.providerValue || "",
      };
    case "getStream":
      return {
        link: args.link || "",
        type: args.type || "movie",
        signal: abortSignalWithTimeout(WORKER_TIMEOUT_MS),
      };
    default:
      throw new Error(`unsupported function: ${fn}`);
  }
}

// Safe serialization: undefined -> null, BigInt -> string, drop circular refs.
function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (typeof val === "bigint") return val.toString();
    if (val === undefined) return null;
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) return undefined;
      seen.add(val);
    }
    return val;
  });
}

async function handleCall(params) {
  const { provider, module: moduleName, fn, args = {} } = params;
  if (!provider || !moduleName || !fn) {
    throw new Error("missing provider/module/fn");
  }

  const mod = loadBundle(provider, moduleName);

  // catalog.js exports plain arrays (catalog, genres), not functions.
  if (moduleName === "catalog") {
    const list = [
      ...(Array.isArray(mod.catalog) ? mod.catalog : []),
      ...(Array.isArray(mod.genres) ? mod.genres : []),
    ];
    return list;
  }

  const impl = mod[fn];
  if (typeof impl !== "function") {
    throw new Error(`no export ${fn}() in ${provider}/${moduleName}.js`);
  }

  const { providerContext } = require("./context.js");
  const callArgs = buildArgs(fn, args);
  callArgs.providerContext = providerContext;

  const result = await impl(callArgs);
  return result;
}

// --- Main loop -------------------------------------------------------------
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // ignore malformed input
  }

  const { id, method } = msg;
  try {
    if (method === "ping") {
      process.stdout.write(JSON.stringify({ id, ok: true, data: { pong: true } }) + "\n");
      return;
    }
    if (method !== "call") {
      throw new Error(`unknown method: ${method}`);
    }
    const data = await handleCall(msg.params);
    process.stdout.write(
      safeStringify({ id, ok: true, data }) + "\n",
    );
  } catch (err) {
    const status =
      err && typeof err === "object" && err.response && err.response.status
        ? err.response.status
        : 502;
    const message =
      err && err.message
        ? err.message
        : err && typeof err === "string"
          ? err
          : "unknown worker error";
    process.stdout.write(
      JSON.stringify({ id, ok: false, error: { message, status } }) + "\n",
    );
  }
});

process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") process.exit(0);
});

process.stdin.on("end", () => process.exit(0));

process.on("uncaughtException", (err) => {
  process.stderr.write(`[worker] uncaught: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  process.stderr.write(`[worker] unhandled rejection: ${err}\n`);
});