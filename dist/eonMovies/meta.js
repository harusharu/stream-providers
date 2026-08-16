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

// providers/eonMovies/meta.ts
var meta_exports = {};
__export(meta_exports, {
  getMeta: () => getMeta
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

// providers/eonMovies/meta.ts
var providerValue = "eonMovies";
function getTitle($) {
  const openGraphTitle = $('meta[property="og:title"]').attr("content") || "";
  return openGraphTitle.replace(/\s+-\s+Download in HD\s*\|\s*EonMovies\s*$/i, "").trim();
}
__name(getTitle, "getTitle");
function getBackdrop($) {
  var _a;
  const style = $("#heroBackdrop").attr("style") || "";
  return ((_a = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i)) == null ? void 0 : _a[1]) || "";
}
__name(getBackdrop, "getBackdrop");
function getTags($) {
  const genres = $("#movieGenresBox .genre-pill").map((_, element) => $(element).text().trim()).get().filter(Boolean);
  const metadata = $(".meta-pill").map((_, element) => $(element).text().replace(/\s+/g, " ").trim()).get().filter((value) => /^(?:Movie|Series|WEB-DL|Hindi|English|Dual Audio)$/i.test(value));
  return [.../* @__PURE__ */ new Set([...genres, ...metadata])].slice(0, 3);
}
__name(getTags, "getTags");
function getDownloadLinks($, baseUrl) {
  const directLinks = [];
  $(".dl-row").each((_, element) => {
    const row = $(element);
    const title = row.attr("data-dlname") || row.find(".dl-row-name").text().replace(/\s+/g, " ").trim();
    const href = row.find("a[href*='/dl/']").attr("href") || "";
    if (!title || !href) return;
    directLinks.push({
      title,
      link: new URL(href, `${baseUrl}/`).href
    });
  });
  return directLinks.length ? [{ title: "Downloads", directLinks }] : [];
}
__name(getDownloadLinks, "getDownloadLinks");
function getMeta(_0) {
  return __async(this, arguments, function* ({
    link,
    providerContext
  }) {
    const baseUrl = yield getBaseUrl(providerValue);
    const url = new URL(link, `${baseUrl}/`).href;
    const response = yield providerContext.axios.get(url);
    const $ = providerContext.cheerio.load(response.data || "");
    const title = getTitle($);
    const image = getBackdrop($);
    const synopsis = $(".overview-text").first().text().replace(/\s+/g, " ").trim();
    const type = $(".meta-pills").text().includes("Series") ? "series" : "movie";
    return {
      title,
      image,
      synopsis,
      imdbId: "",
      type,
      tags: getTags($),
      linkList: getDownloadLinks($, baseUrl),
      webUrl: url
    };
  });
}
__name(getMeta, "getMeta");
exports.getMeta = getMeta;
// Annotate the CommonJS export names for ESM import in node:

