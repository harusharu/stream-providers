"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// providers/vega/posts.ts
var posts_exports = {};
__export(posts_exports, {
  getPosts: () => getPosts,
  getSearchPosts: () => getSearchPosts
});


// providers/getBaseUrl.ts
var import_fs = require("fs");
var import_path = require("path");
var cacheTtl = 60 * 60 * 1e3;
function getCache() {
  var _a;
  const state = typeof providerGlobal !== "undefined" && providerGlobal ? providerGlobal : globalThis;
  (_a = state.__vegaProviderBaseUrlCache__) != null ? _a : state.__vegaProviderBaseUrlCache__ = { expiresAt: 0 };
  return state.__vegaProviderBaseUrlCache__;
}
__name(getCache, "getCache");
function urlsEndpoint() {
  const fromEnv = typeof process !== "undefined" && process.env ? process.env.URLS_MANIFEST_URL : void 0;
  return fromEnv && fromEnv.trim() !== "" ? fromEnv.trim() : "";
}
__name(urlsEndpoint, "urlsEndpoint");
function readLocalUrls() {
  var _a;
  const root = typeof process !== "undefined" && ((_a = process.env) == null ? void 0 : _a.PROVIDERS_ROOT) ? process.env.PROVIDERS_ROOT : process.cwd();
  try {
    return JSON.parse((0, import_fs.readFileSync)((0, import_path.join)(root, "urls.json"), "utf8"));
  } catch (e) {
    return {};
  }
}
__name(readLocalUrls, "readLocalUrls");
function fetchProviderUrls() {
  return __async(this, null, function* () {
    const cache = getCache();
    if (cache.data && Date.now() < cache.expiresAt) {
      return cache.data;
    }
    if (cache.request) {
      return cache.request;
    }
    let request;
    const endpoint = urlsEndpoint();
    if (endpoint === "") {
      request = Promise.resolve().then(() => {
        cache.data = readLocalUrls();
        cache.expiresAt = Date.now() + cacheTtl;
        return cache.data;
      });
    } else {
      request = fetch(endpoint).then((response) => __async(null, null, function* () {
        if (!response.ok) {
          throw new Error(`URL configuration request failed: ${response.status}`);
        }
        const data = yield response.json();
        console.log("Fetched provider URL configuration");
        cache.data = data;
        cache.expiresAt = Date.now() + cacheTtl;
        return data;
      })).catch((error) => {
        if (cache.data) {
          console.warn("Using stale provider URL configuration", error);
          return cache.data;
        }
        throw error;
      });
    }
    request.finally(() => {
      cache.request = void 0;
    });
    Object.defineProperty(cache, "request", {
      configurable: true,
      enumerable: false,
      value: request,
      writable: true
    });
    return request;
  });
}
__name(fetchProviderUrls, "fetchProviderUrls");
var getBaseUrl = /* @__PURE__ */ __name((providerValue) => __async(null, null, function* () {
  var _a, _b;
  try {
    const providerUrls = yield fetchProviderUrls();
    return (_b = (_a = providerUrls[providerValue]) == null ? void 0 : _a.url) != null ? _b : "";
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue}`, error);
    throw error;
  }
}), "getBaseUrl");

// providers/providerErrors.ts
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch (e) {
    return String(error);
  }
}
__name(getErrorMessage, "getErrorMessage");
function throwProviderError(provider, operation, error) {
  var _a, _b;
  const response = error == null ? void 0 : error.response;
  const status = response == null ? void 0 : response.status;
  const statusText = response == null ? void 0 : response.statusText;
  const url = ((_a = response == null ? void 0 : response.config) == null ? void 0 : _a.url) || ((_b = error == null ? void 0 : error.config) == null ? void 0 : _b.url);
  const details = [
    status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}` : "",
    url ? `URL ${url}` : "",
    getErrorMessage(error)
  ].filter(Boolean);
  throw new Error(`${provider} ${operation} failed: ${details.join(" | ")}`);
}
__name(throwProviderError, "throwProviderError");

// providers/vega/posts.ts
var headers = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Cache-Control": "no-store",
  "Accept-Language": "en-US,en;q=0.9",
  DNT: "1",
  "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  Cookie: "xla=s4t; _ga=GA1.1.1081149560.1756378968; _ga_BLZGKYN5PF=GS2.1.s1756378968$o1$g1$t1756378984$j44$l0$h0",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
};
var getPosts = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({
  filter,
  page,
  providerValue,
  signal,
  providerContext
}) {
  const { axios, cheerio } = providerContext;
  const baseUrl = yield getBaseUrl("Vega");
  console.log("vegaGetPosts baseUrl:", providerValue, baseUrl);
  const url = filter ? `${baseUrl}/${filter}/page/${page}/` : `${baseUrl}/page/${page}/`;
  console.log("vegaGetPosts url:", url);
  return posts(baseUrl, url, signal, headers, axios, cheerio);
}), "getPosts");
var getSearchPosts = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext
}) {
  const { axios, cheerio } = providerContext;
  const baseUrl = yield getBaseUrl("Vega");
  console.log("vegaGetPosts baseUrl:", providerValue, baseUrl);
  const url = `${baseUrl}/search.php?q=${searchQuery}&page=${page}`;
  console.log("vegaGetPosts url:", url);
  try {
    const response = yield axios.get(url, {
      headers: __spreadProps(__spreadValues({}, headers), {
        Referer: baseUrl
      }),
      signal
    });
    const data = response.data;
    const posts2 = [];
    if (data == null ? void 0 : data.hits) {
      data.hits.forEach((hit) => {
        const doc = hit.document;
        const postUrl = new URL(doc.permalink, `${baseUrl}/`);
        const post = {
          title: doc.post_title.replace("Download", "").trim(),
          link: `${postUrl.pathname}${postUrl.search}${postUrl.hash}`,
          image: doc.post_thumbnail
        };
        posts2.push(post);
      });
    }
    return posts2;
  } catch (error) {
    throwProviderError("Vega", "search posts", error);
  }
}), "getSearchPosts");
function posts(_0, _1, _2) {
  return __async(this, arguments, function* (baseUrl, url, signal, headers2 = {}, axios, cheerio) {
    var _a, _b;
    try {
      const urlRes = yield fetch(url, {
        headers: __spreadProps(__spreadValues({}, headers2), {
          Referer: baseUrl
        }),
        signal
      });
      if (!urlRes.ok) {
        throw new Error(`HTTP ${urlRes.status} ${urlRes.statusText} | URL ${url}`);
      }
      const $ = cheerio.load(yield urlRes.text());
      const posts2 = [];
      (_b = (_a = $(".blog-items,.post-list,#archive-container,.movies-grid")) == null ? void 0 : _a.children("article,.entry-list-item,a")) == null ? void 0 : _b.each((index, element) => {
        var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
        const href = ((_b2 = (_a2 = $(element)) == null ? void 0 : _a2.find("a")) == null ? void 0 : _b2.attr("href")) || ((_c = $(element)) == null ? void 0 : _c.attr("href")) || "";
        const postUrl = new URL(href, `${baseUrl}/`);
        const post = {
          title: (((_h = (_g = (_f = (_e = (_d = $(element)) == null ? void 0 : _d.find(".entry-title,.poster-title")) == null ? void 0 : _e.text()) == null ? void 0 : _f.replace("Download", "")) == null ? void 0 : _g.match(/^(.*?)\s*\((\d{4})\)|^(.*?)\s*\((Season \d+)\)/)) == null ? void 0 : _h[0]) || ((_k = (_j = (_i = $(element)) == null ? void 0 : _i.find("a")) == null ? void 0 : _j.attr("title")) == null ? void 0 : _k.replace("Download", "")) || ((_m = (_l = $(element)) == null ? void 0 : _l.find(".post-title,.poster-title").text()) == null ? void 0 : _m.replace("Download", "")) || "").trim(),
          link: `${postUrl.pathname}${postUrl.search}${postUrl.hash}`,
          image: $(element).find("a").find("img").attr("data-lazy-src") || $(element).find("a").find("img").attr("data-src") || $(element).find("a").find("img").attr("src") || $(element).find("img").attr("data-src") || $(element).find("img").attr("src") || ""
        };
        if (post.image.startsWith("//")) {
          post.image = "https:" + post.image;
        }
        console.log("vegaGetPosts post:", post);
        posts2.push(post);
      });
      return posts2;
    } catch (error) {
      throwProviderError("Vega", "posts", error);
    }
  });
}
__name(posts, "posts");
exports.getPosts = getPosts;
exports.getSearchPosts = getSearchPosts;
// Annotate the CommonJS export names for ESM import in node:

