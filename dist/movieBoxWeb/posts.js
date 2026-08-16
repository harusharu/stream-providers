"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// providers/movieBoxWeb/posts.ts
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
var getBaseUrl = /* @__PURE__ */ __name((providerValue2) => __async(null, null, function* () {
  var _a, _b;
  try {
    const providerUrls = yield fetchProviderUrls();
    return (_b = (_a = providerUrls[providerValue2]) == null ? void 0 : _a.url) != null ? _b : "";
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue2}`, error);
    throw error;
  }
}), "getBaseUrl");

// providers/movieBoxWeb/utils.ts
var providerValue = "movieBoxWeb";
function parseNuxtData(html, cheerio) {
  const $ = cheerio.load(html);
  const serialized = $("#__NUXT_DATA__").text();
  if (!serialized) return null;
  return decodeNuxtData(JSON.parse(serialized));
}
__name(parseNuxtData, "parseNuxtData");
function decodeNuxtData(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Invalid Nuxt data");
  }
  const entries = values;
  const hydrated = new Array(entries.length);
  function hydrate(index) {
    if (index === -1 || index === -2) return void 0;
    if (index === -3) return NaN;
    if (index === -4) return Infinity;
    if (index === -5) return -Infinity;
    if (index === -6) return -0;
    if (typeof index !== "number" || index < 0 || index >= entries.length) {
      throw new Error("Invalid Nuxt data index");
    }
    if (Object.prototype.hasOwnProperty.call(hydrated, index)) {
      return hydrated[index];
    }
    const value = entries[index];
    if (!value || typeof value !== "object") {
      hydrated[index] = value;
      return value;
    }
    if (Array.isArray(value)) {
      const type = value[0];
      if (type === "Reactive" || type === "ShallowReactive" || type === "Ref" || type === "ShallowRef") {
        const result3 = hydrate(value[1]);
        hydrated[index] = result3;
        return result3;
      }
      if (type === "Set") {
        const result3 = /* @__PURE__ */ new Set();
        hydrated[index] = result3;
        for (let item = 1; item < value.length; item++) {
          result3.add(hydrate(value[item]));
        }
        return result3;
      }
      if (typeof type === "string") {
        throw new Error(`Unsupported Nuxt data type: ${type}`);
      }
      const result2 = [];
      hydrated[index] = result2;
      for (const item of value) {
        result2.push(item === -2 ? void 0 : hydrate(item));
      }
      return result2;
    }
    const result = {};
    hydrated[index] = result;
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__") throw new Error("Invalid Nuxt data key");
      result[key] = hydrate(item);
    }
    return result;
  }
  __name(hydrate, "hydrate");
  return hydrate(0);
}
__name(decodeNuxtData, "decodeNuxtData");
function absoluteUrl(baseUrl, path) {
  return new URL(path, `${baseUrl}/`).toString();
}
__name(absoluteUrl, "absoluteUrl");

// providers/movieBoxWeb/posts.ts
var pageSize = 18;
var requestHeaders = {
  Accept: "application/json",
  "x-client-info": JSON.stringify({ timezone: "Asia/Colombo" }),
  "x-source": ""
};
function collectSubjectPreviews(value) {
  const subjects = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  function visit(current) {
    if (!current || typeof current !== "object" || visited.has(current)) return;
    visited.add(current);
    if ("detailPath" in current && typeof current.detailPath === "string") {
      const cover = "cover" in current ? current.cover : void 0;
      subjects.set(current.detailPath, {
        title: "title" in current && typeof current.title === "string" ? current.title : void 0,
        coverUrl: cover && typeof cover === "object" && "url" in cover && typeof cover.url === "string" ? cover.url : void 0,
        hasResource: "hasResource" in current && typeof current.hasResource === "boolean" ? current.hasResource : void 0
      });
    }
    Object.values(current).forEach(visit);
  }
  __name(visit, "visit");
  visit(value);
  return subjects;
}
__name(collectSubjectPreviews, "collectSubjectPreviews");
function fetchPosts(path, signal, providerContext) {
  return __async(this, null, function* () {
    const baseUrl = yield getBaseUrl(providerValue);
    const response = yield fetch(absoluteUrl(baseUrl, path), { signal });
    if (!response.ok) throw new Error(`MovieBox Web returned ${response.status}`);
    const html = yield response.text();
    const $ = providerContext.cheerio.load(html);
    const subjects = collectSubjectPreviews(parseNuxtData(html, providerContext.cheerio));
    const posts = [];
    const seen = /* @__PURE__ */ new Set();
    $('a[href^="/moviesDetail/"]').each((_, element) => {
      var _a, _b, _c, _d;
      const card = $(element);
      const href = card.attr("href") || "";
      if (!href.startsWith("/moviesDetail/") || seen.has(href)) return;
      const subject = subjects.get(href.replace("/moviesDetail/", ""));
      if (path === "/upcoming" && (subject == null ? void 0 : subject.hasResource) !== true) return;
      const image = card.find("img").first();
      const title = ((_a = subject == null ? void 0 : subject.title) == null ? void 0 : _a.trim()) || ((_b = card.find("h2, h3").first().attr("title")) == null ? void 0 : _b.trim()) || ((_c = image.attr("alt")) == null ? void 0 : _c.trim()) || card.find("h2, h3").first().text().trim() || ((_d = card.attr("title")) == null ? void 0 : _d.replace(/^go to /i, "").replace(/ detail page$/i, "").trim()) || "";
      if (!title) return;
      seen.add(href);
      posts.push({
        title,
        link: href,
        image: image.attr("data-src") || (subject == null ? void 0 : subject.coverUrl) || image.attr("src") || ""
      });
    });
    return posts;
  });
}
__name(fetchPosts, "fetchPosts");
function mapSubjects(subjects) {
  return subjects.filter(
    (subject) => Boolean(subject.detailPath && subject.title) && subject.hasResource !== false
  ).map((subject) => ({
    title: subject.title || "",
    link: `/moviesDetail/${subject.detailPath}`,
    image: subject.coverUrl || ""
  }));
}
__name(mapSubjects, "mapSubjects");
function fetchCatalogPage(filter, page, signal) {
  return __async(this, null, function* () {
    var _a;
    const baseUrl = yield getBaseUrl(providerValue);
    const params = new URLSearchParams({
      page: String(Math.max(1, page)),
      perPage: String(pageSize)
    });
    if (filter === "/newWeb/movie") {
      params.set("tabId", "ONEROOM_MOVIE");
    }
    const response = yield fetch(
      absoluteUrl(baseUrl, `/wefeed-h5api-bff/subject/trending?${params.toString()}`),
      { headers: requestHeaders, signal }
    );
    if (!response.ok) throw new Error(`MovieBox Web returned ${response.status}`);
    const payload = yield response.json();
    if (payload.code !== 0) {
      throw new Error(payload.message || "MovieBox Web catalog request failed");
    }
    return mapSubjects(
      (((_a = payload.data) == null ? void 0 : _a.subjectList) || []).map((subject) => {
        var _a2;
        return {
          detailPath: subject.detailPath,
          title: subject.title,
          coverUrl: (_a2 = subject.cover) == null ? void 0 : _a2.url,
          hasResource: subject.hasResource
        };
      })
    );
  });
}
__name(fetchCatalogPage, "fetchCatalogPage");
var getPosts = /* @__PURE__ */ __name(function(_0) {
  return __async(this, arguments, function* ({
    filter,
    page,
    signal,
    providerContext
  }) {
    const path = filter || "/";
    if (["/", "/newWeb/movie", "/newWeb/tv-series"].includes(path)) {
      return fetchCatalogPage(path, page, signal);
    }
    if (page > 1) return [];
    return fetchPosts(path, signal, providerContext);
  });
}, "getPosts");
var getSearchPosts = /* @__PURE__ */ __name(function(_0) {
  return __async(this, arguments, function* ({
    searchQuery,
    page,
    signal,
    providerContext
  }) {
    if (page > 1 || !searchQuery.trim()) return [];
    return fetchPosts(
      `/newWeb/searchResult?keyword=${encodeURIComponent(searchQuery.trim())}`,
      signal,
      providerContext
    );
  });
}, "getSearchPosts");
exports.getPosts = getPosts;
exports.getSearchPosts = getSearchPosts;
// Annotate the CommonJS export names for ESM import in node:

