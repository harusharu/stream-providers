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

// providers/movieBoxWeb/meta.ts
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

// providers/movieBoxWeb/utils.ts
var providerValue = "movieBoxWeb";
function parseNuxtDetail(html, cheerio) {
  return findDetail(parseNuxtData(html, cheerio));
}
__name(parseNuxtDetail, "parseNuxtDetail");
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
function findDetail(value) {
  if (!value || typeof value !== "object") return null;
  if ("subject" in value && "resource" in value && typeof value.subject === "object" && typeof value.resource === "object") {
    return value;
  }
  for (const child of Object.values(value)) {
    const result = findDetail(child);
    if (result) return result;
  }
  return null;
}
__name(findDetail, "findDetail");
function encodeLink(value) {
  return JSON.stringify(value);
}
__name(encodeLink, "encodeLink");
function detailPath(link) {
  return link.replace(/^https?:\/\/[^/]+/, "").replace(/^\/moviesDetail\//, "");
}
__name(detailPath, "detailPath");
function absoluteUrl(baseUrl, path) {
  return new URL(path, `${baseUrl}/`).toString();
}
__name(absoluteUrl, "absoluteUrl");

// providers/movieBoxWeb/meta.ts
function buildPlaybackLink(subject, dub, seasons) {
  var _a, _b;
  const movieSeason = (seasons == null ? void 0 : seasons.find((season) => season.se === 0)) || (seasons == null ? void 0 : seasons[0]);
  const movieResolution = (_b = (_a = movieSeason == null ? void 0 : movieSeason.resolutions) == null ? void 0 : _a.filter((item) => (item.epNum || 0) >= 1).sort((a, b) => (b.resolution || 0) - (a.resolution || 0))[0]) == null ? void 0 : _b.resolution;
  return encodeLink({
    subjectId: dub.subjectId || subject.subjectId || "",
    detailPath: dub.detailPath || subject.detailPath || "",
    language: dub.lanName || dub.lanCode || "Original",
    season: subject.subjectType === 2 ? void 0 : (movieSeason == null ? void 0 : movieSeason.se) || 0,
    episode: subject.subjectType === 2 ? void 0 : 1,
    resolution: subject.subjectType === 2 ? void 0 : movieResolution,
    seasons
  });
}
__name(buildPlaybackLink, "buildPlaybackLink");
var getMeta = /* @__PURE__ */ __name(function(_0) {
  return __async(this, arguments, function* ({
    link,
    providerContext
  }) {
    var _a, _b, _c, _d;
    try {
      const baseUrl = yield getBaseUrl(providerValue);
      const pageUrl = absoluteUrl(baseUrl, `/moviesDetail/${detailPath(link)}`);
      const response = yield fetch(pageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} | URL ${pageUrl}`);
      }
      const detail = parseNuxtDetail(yield response.text(), providerContext.cheerio);
      if (!detail) throw new Error("MovieBox Web detail data was not found");
      const { subject, resource } = detail;
      const isSeries = subject.subjectType === 2;
      const dubs = ((_a = subject.dubs) == null ? void 0 : _a.length) ? subject.dubs : [
        {
          subjectId: subject.subjectId,
          detailPath: subject.detailPath,
          lanName: "Original"
        }
      ];
      const linkList = (subject.hasResource === false ? [] : dubs).filter((dub) => dub.subjectId && (dub.detailPath || subject.detailPath)).map((dub) => {
        const playbackLink = buildPlaybackLink(subject, dub, resource.seasons);
        if (isSeries) {
          return {
            title: dub.lanName || dub.lanCode || "Original",
            episodesLink: playbackLink
          };
        }
        return {
          title: dub.lanName || dub.lanCode || "Original",
          directLinks: [
            {
              title: dub.lanName || dub.lanCode || "Original",
              link: playbackLink,
              type: "movie"
            }
          ]
        };
      });
      const tags = [
        subject.countryName,
        (_b = subject.releaseDate) == null ? void 0 : _b.slice(0, 4),
        ...(subject.genre || "").split(",").map((tag) => tag.trim())
      ].filter((tag) => Boolean(tag));
      return {
        title: subject.title || "",
        image: ((_c = subject.cover) == null ? void 0 : _c.url) || "",
        synopsis: subject.description || "",
        imdbId: "",
        type: isSeries ? "series" : "movie",
        tags,
        cast: (_d = subject.stars) == null ? void 0 : _d.map((star) => star.name || "").filter(Boolean),
        rating: subject.imdbRatingValue || "",
        linkList,
        webUrl: pageUrl
      };
    } catch (error) {
      throwProviderError("MovieBox Web", "metadata", error);
    }
  });
}, "getMeta");
exports.getMeta = getMeta;
// Annotate the CommonJS export names for ESM import in node:

