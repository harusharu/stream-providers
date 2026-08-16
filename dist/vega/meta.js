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

// providers/vega/meta.ts
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

// providers/getCinemetaMeta.ts
var CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io/meta";
var CONTEXT_KEY = "cinemetaMeta";
function isCinemetaPromise(value) {
  return typeof value.then === "function";
}
__name(isCinemetaPromise, "isCinemetaPromise");
function getCache2() {
  const state = typeof providerGlobal !== "undefined" && providerGlobal ? providerGlobal : globalThis;
  if (!state.__vegaCinemetaCache__ || typeof state.__vegaCinemetaCache__ !== "object") {
    state.__vegaCinemetaCache__ = /* @__PURE__ */ Object.create(null);
  }
  return state.__vegaCinemetaCache__;
}
__name(getCache2, "getCache");
function getCinemetaMeta(imdbId, type, providerContext) {
  if (!/^tt\d+$/.test(imdbId)) {
    return Promise.reject(new Error(`Invalid IMDb ID: ${imdbId}`));
  }
  const cache = getCache2();
  const cached = cache[imdbId];
  if (cached) {
    if (isCinemetaPromise(cached)) {
      return cached;
    }
    if (cached.name && cached.imdb_id === imdbId) {
      return Promise.resolve(cached);
    }
    delete cache[imdbId];
  }
  const mediaType = type === "series" ? "series" : "movie";
  const url = `${CINEMETA_BASE_URL}/${mediaType}/${imdbId}.json`;
  const request = providerContext.axios.get(url).then((response) => {
    var _a;
    const meta = (_a = response.data) == null ? void 0 : _a.meta;
    if (!(meta == null ? void 0 : meta.name) || meta.imdb_id !== imdbId) {
      throw new Error(`Cinemeta returned invalid metadata for ${imdbId}`);
    }
    cache[imdbId] = meta;
    return meta;
  }).catch((error) => {
    delete cache[imdbId];
    throw error;
  });
  cache[imdbId] = request;
  return request;
}
__name(getCinemetaMeta, "getCinemetaMeta");
function getCinemetaSeason(value) {
  if (/\bseason\s*:?\s*\d{1,2}\s*[-–&/]\s*(?:season\s*:?\s*)?\d{1,2}\b/i.test(value)) {
    return void 0;
  }
  const matches = [
    ...value.matchAll(/\bseason\s*:?\s*(\d{1,2})\b/gi),
    ...value.matchAll(/\bs(\d{1,2})(?=\s*e\d|\b)/gi)
  ].map((match) => Number(match[1]));
  const seasons = [...new Set(matches.filter((season) => season > 0))];
  return seasons.length === 1 ? seasons[0] : void 0;
}
__name(getCinemetaSeason, "getCinemetaSeason");
function addCinemetaContext(url, imdbId, season) {
  const parsedUrl = new URL(url);
  parsedUrl.hash = `${CONTEXT_KEY}=${encodeURIComponent(JSON.stringify({ imdbId, season }))}`;
  return parsedUrl.href;
}
__name(addCinemetaContext, "addCinemetaContext");

// providers/vega/meta.ts
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
function cinemetaTitle(name) {
  return name && /[a-zA-Z]/.test(name) ? name : void 0;
}
__name(cinemetaTitle, "cinemetaTitle");
function applyCinemeta(info, meta) {
  var _a;
  return __spreadProps(__spreadValues({}, info), {
    title: cinemetaTitle(meta.name) || info.title,
    image: meta.background || meta.poster || info.image,
    poster: meta.poster || info.poster,
    logo: meta.logo || void 0,
    synopsis: meta.description || info.synopsis,
    imdbId: "",
    tmdbId: ((_a = meta.moviedb_id) == null ? void 0 : _a.toString()) || void 0,
    type: meta.type || info.type,
    tags: meta.genres || meta.genre || void 0,
    cast: meta.cast || void 0,
    rating: meta.imdbRating || void 0
  });
}
__name(applyCinemeta, "applyCinemeta");
var getMeta = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({
  link,
  providerContext
}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
  try {
    const { axios, cheerio } = providerContext;
    const currentBaseUrl = yield getBaseUrl("Vega");
    const url = new URL(link, `${currentBaseUrl}/`).href;
    console.log("url", url);
    const baseUrl = url.split("/").slice(0, 3).join("/");
    const response = yield axios.get(url, {
      headers: __spreadProps(__spreadValues({}, headers), {
        Referer: baseUrl
      })
    });
    const $ = cheerio.load(response.data);
    const infoContainer = $(".entry-content, .post-inner, .post-content, .page-body");
    let title = $("h1.post-title").text().trim();
    if (!title) {
      const heading2 = infoContainer == null ? void 0 : infoContainer.find("h3");
      const titleRegex = /Name: (.+)/;
      title = ((_c = (_b = (_a = heading2 == null ? void 0 : heading2.next("p")) == null ? void 0 : _a.text()) == null ? void 0 : _b.match(titleRegex)) == null ? void 0 : _c[1]) || "";
    }
    let imdbId = ((_e = (_d = $('a[href*="imdb.com"]').attr("href")) == null ? void 0 : _d.match(/tt\d+/)) == null ? void 0 : _e[0]) || "";
    if (!imdbId) {
      const heading2 = infoContainer == null ? void 0 : infoContainer.find("h3");
      imdbId = ((_i = (_h = (_g = (_f = heading2 == null ? void 0 : heading2.next("p")) == null ? void 0 : _f.find("a")) == null ? void 0 : _g.attr("href")) == null ? void 0 : _h.match(/tt\d+/g)) == null ? void 0 : _i[0]) || ((_j = infoContainer.text().match(/tt\d+/g)) == null ? void 0 : _j[0]) || "";
    }
    let type = "movie";
    const heading = infoContainer == null ? void 0 : infoContainer.find("h3");
    const pageText = `${title} ${infoContainer.text()}`;
    if (((_l = (_k = heading == null ? void 0 : heading.next("p")) == null ? void 0 : _k.text()) == null ? void 0 : _l.includes("Series Name")) || /\b(?:web\s+series|season\s*\d{1,2}|s\d{1,2}\s*e\d{1,3})\b/i.test(pageText)) {
      type = "series";
    }
    let synopsis = "";
    const synopsisHeader = $("h3").filter(
      (i, el) => $(el).text().includes("SYNOPSIS/PLOT") || $(el).text().includes("Plot")
    );
    if (synopsisHeader.length > 0) {
      synopsis = synopsisHeader.next("p").text().trim();
    }
    if (!synopsis) {
      const synopsisNode = (
        //@ts-ignore
        (_q = (_p = (_o = (_n = (_m = infoContainer == null ? void 0 : infoContainer.find("p")) == null ? void 0 : _m.next("h3,h4")) == null ? void 0 : _n.next("p")) == null ? void 0 : _o[0]) == null ? void 0 : _p.children) == null ? void 0 : _q[0]
      );
      synopsis = synopsisNode && "data" in synopsisNode ? synopsisNode.data : "";
    }
    let image = ((_r = infoContainer == null ? void 0 : infoContainer.find("img[data-lazy-src]")) == null ? void 0 : _r.attr("data-lazy-src")) || ((_u = (_t = (_s = infoContainer == null ? void 0 : infoContainer.find("img")) == null ? void 0 : _s.filter((i, el) => {
      const src = $(el).attr("src");
      return !!src && !src.includes("logo") && !src.includes("svg") && !src.includes("placeholder") && !src.includes("icon");
    })) == null ? void 0 : _t.first()) == null ? void 0 : _u.attr("src")) || "";
    if (image.startsWith("//")) {
      image = "https:" + image;
    }
    console.log({ title, synopsis, image, imdbId, type });
    let hr = (_v = infoContainer == null ? void 0 : infoContainer.first()) == null ? void 0 : _v.find("hr");
    const firstButton = $(".dwd-button").first();
    if (firstButton.length > 0) {
      const containerP = firstButton.closest("p");
      let prev = containerP.prev();
      while (prev.length && !prev.is("hr")) {
        prev = prev.prev();
      }
      if (prev.is("hr")) {
        hr = prev;
      }
    }
    const list = hr == null ? void 0 : hr.nextAll();
    const links = [];
    list.each((index, element) => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h2, _i2, _j2;
      element = $(element);
      const title2 = (element == null ? void 0 : element.text()) || "";
      const quality = ((_a2 = element == null ? void 0 : element.text().match(/\d+p\b/)) == null ? void 0 : _a2[0]) || "";
      const movieLinks = (element == null ? void 0 : element.next().find(".dwd-button").text().toLowerCase().includes("download")) || element.next().find("a").text().toLowerCase().includes("download") ? ((_c2 = (_b2 = element == null ? void 0 : element.next().find(".dwd-button")) == null ? void 0 : _b2.parent()) == null ? void 0 : _c2.attr("href")) || ((_d2 = element == null ? void 0 : element.next().find("a[href]")) == null ? void 0 : _d2.attr("href")) : "";
      const vcloudLinks = (_f2 = (_e2 = element == null ? void 0 : element.next().find(".btn-outline[style*='#ed0b0b']")) == null ? void 0 : _e2.parent()) == null ? void 0 : _f2.attr("href");
      const episodesLink = (vcloudLinks ? vcloudLinks : (element == null ? void 0 : element.next().find(".dwd-button").text().toLowerCase().includes("episode")) ? (_h2 = (_g2 = element == null ? void 0 : element.next().find(".dwd-button")) == null ? void 0 : _g2.parent()) == null ? void 0 : _h2.attr("href") : "") || ((_j2 = (_i2 = element == null ? void 0 : element.next().find(".btn-outline[style*='#0ebac3']")) == null ? void 0 : _i2.parent()) == null ? void 0 : _j2.attr("href"));
      if (movieLinks || episodesLink) {
        links.push({
          title: title2,
          directLinks: movieLinks ? [{ title: "Movie", link: movieLinks, type: "movie" }] : [],
          episodesLink,
          quality
        });
      }
    });
    const websiteInfo = {
      title,
      synopsis,
      image,
      imdbId: "",
      type,
      linkList: links,
      webUrl: url
    };
    if (!imdbId) return websiteInfo;
    const cinemeta = yield getCinemetaMeta(imdbId, type, providerContext);
    if (type === "series" && cinemeta.type === "series") {
      websiteInfo.linkList = websiteInfo.linkList.map((item) => {
        if (!item.episodesLink) return item;
        const season = getCinemetaSeason(item.title);
        if (!season) return item;
        return __spreadProps(__spreadValues({}, item), {
          episodesLink: addCinemetaContext(new URL(item.episodesLink, url).href, imdbId, season)
        });
      });
    }
    return applyCinemeta(websiteInfo, cinemeta);
  } catch (error) {
    console.log("getInfo error");
    console.error(error);
    throw error;
  }
}), "getMeta");
exports.getMeta = getMeta;
// Annotate the CommonJS export names for ESM import in node:

