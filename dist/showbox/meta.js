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

// providers/showbox/meta.ts
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

// providers/showbox/meta.ts
var getMeta = /* @__PURE__ */ __name(function(_0) {
  return __async(this, arguments, function* ({
    link,
    providerContext
  }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    try {
      const { axios, cheerio } = providerContext;
      const baseUrlShowbox = yield getBaseUrl("showbox");
      const url = new URL(link, `${baseUrlShowbox}/`).href;
      const res = yield axios.get(url);
      const data = res.data;
      const $ = cheerio.load(data);
      const type = url.includes("tv") ? "series" : "movie";
      const imdbId = "";
      const title = $(".heading-name").text();
      const rating = ((_b = (_a = $(".btn-imdb").text()) == null ? void 0 : _a.match(/\d+(\.\d+)?/g)) == null ? void 0 : _b[0]) || "";
      const image = ((_d = (_c = $(".cover_follow").attr("style")) == null ? void 0 : _c.split("url(")[1]) == null ? void 0 : _d.split(")")[0]) || "";
      const synopsis = (_f = (_e = $(".description").text()) == null ? void 0 : _e.replace(/[\n\t]/g, "")) == null ? void 0 : _f.trim();
      const febID = (_h = (_g = $(".heading-name").find("a").attr("href")) == null ? void 0 : _g.split("/")) == null ? void 0 : _h.pop();
      const baseUrl = url.split("/").slice(0, 3).join("/");
      const indexUrl = `${baseUrl}/index/share_link?id=${febID}&type=${type === "movie" ? "1" : "2"}`;
      const indexRes = yield axios.get(indexUrl);
      const indexData = indexRes.data;
      const febKey = indexData.data.link.split("/").pop();
      const febLink = `https://www.febbox.com/file/file_share_list?share_key=${febKey}&is_html=0`;
      const febRes = yield axios.get(febLink);
      const febData = febRes.data;
      const fileList = (_i = febData == null ? void 0 : febData.data) == null ? void 0 : _i.file_list;
      const links = [];
      if (fileList) {
        fileList.map((file) => {
          const fileName = `${file.file_name} (${file.file_size})`;
          const fileId = file.fid;
          links.push({
            title: fileName,
            episodesLink: file.is_dir ? `${febKey}&${fileId}` : `${febKey}&`
          });
        });
      }
      return {
        title,
        rating,
        synopsis,
        image,
        imdbId,
        type,
        linkList: links,
        webUrl: url
      };
    } catch (err) {
      throwProviderError("ShowBox", "metadata", err);
    }
  });
}, "getMeta");
exports.getMeta = getMeta;
// Annotate the CommonJS export names for ESM import in node:

