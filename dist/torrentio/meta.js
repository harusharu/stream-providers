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

// providers/torrentio/meta.ts
var meta_exports = {};
__export(meta_exports, {
  getMeta: () => getMeta
});


// providers/getCinemetaMeta.ts
var CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io/meta";
function isCinemetaPromise(value) {
  return typeof value.then === "function";
}
__name(isCinemetaPromise, "isCinemetaPromise");
function getCache() {
  const state = typeof providerGlobal !== "undefined" && providerGlobal ? providerGlobal : globalThis;
  if (!state.__vegaCinemetaCache__ || typeof state.__vegaCinemetaCache__ !== "object") {
    state.__vegaCinemetaCache__ = /* @__PURE__ */ Object.create(null);
  }
  return state.__vegaCinemetaCache__;
}
__name(getCache, "getCache");
function getCinemetaMeta(imdbId, type, providerContext) {
  if (!/^tt\d+$/.test(imdbId)) {
    return Promise.reject(new Error(`Invalid IMDb ID: ${imdbId}`));
  }
  const cache = getCache();
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
function applyCinemetaMeta(info, meta) {
  var _a;
  return __spreadProps(__spreadValues({}, info), {
    // Cinemeta sometimes returns a non-title name (e.g. a numeric record id);
    // don't let it clobber a correctly-scraped title.
    title: meta.name && /[a-zA-Z]/.test(meta.name) ? meta.name : info.title,
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
__name(applyCinemetaMeta, "applyCinemetaMeta");
function getEpisodeNumber(title, season) {
  if (/\b(?:e\d+|episodes?\s*:?\s*\d+)\s*(?:[-–,&/]|\band\b)\s*(?:e|episodes?\s*:?\s*)?\d+/i.test(
    title
  )) {
    return void 0;
  }
  const explicitSeasons = [
    ...title.matchAll(/\bseason\s*:?\s*(\d{1,2})\b/gi),
    ...title.matchAll(/\bs(\d{1,2})\s*e\d{1,3}\b/gi)
  ].map((match) => Number(match[1]));
  if (explicitSeasons.some((value) => value !== season)) return void 0;
  const matches = [
    ...title.matchAll(/\bs\d{1,2}\s*e(\d{1,3})\b/gi),
    ...title.matchAll(/\bepisodes?\s*:?\s*(\d{1,3})\b/gi),
    ...title.matchAll(/\bep\s*\.?:?\s*(\d{1,3})\b/gi),
    ...title.matchAll(/\be(\d{1,3})\b/gi)
  ].map((match) => Number(match[1]));
  const episodes = [...new Set(matches.filter((episode) => episode > 0))];
  return episodes.length === 1 ? episodes[0] : void 0;
}
__name(getEpisodeNumber, "getEpisodeNumber");
function enrichCinemetaEpisodes(episodes, videos, season) {
  var _a;
  const videosByEpisode = /* @__PURE__ */ new Map();
  let hasDuplicateVideo = false;
  for (const video of videos) {
    const episode = (_a = video.episode) != null ? _a : video.number;
    if (video.season !== season || !episode) continue;
    if (videosByEpisode.has(episode)) {
      hasDuplicateVideo = true;
      continue;
    }
    videosByEpisode.set(episode, video);
  }
  const matched = episodes.map((episode) => {
    const episodeNumber = getEpisodeNumber(episode.title, season);
    const video = episodeNumber ? videosByEpisode.get(episodeNumber) : void 0;
    const description = (video == null ? void 0 : video.description) || (video == null ? void 0 : video.overview);
    return { episode, episodeNumber, video, description };
  });
  const numbers = matched.map(({ episodeNumber }) => episodeNumber);
  const allMatched = episodes.length > 0 && !hasDuplicateVideo && matched.every(({ video }) => Boolean(video)) && new Set(numbers).size === numbers.length;
  if (!allMatched) return episodes;
  return matched.map(({ episode, video, description }) => __spreadProps(__spreadValues({}, episode), {
    description: description || episode.description,
    image: (video == null ? void 0 : video.thumbnail) || episode.image
  }));
}
__name(enrichCinemetaEpisodes, "enrichCinemetaEpisodes");

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

// providers/torrentio/meta.ts
function getRequest(link) {
  var _a;
  const imdbId = ((_a = link.match(/tt\d+/)) == null ? void 0 : _a[0]) || "";
  const type = /\/series\//i.test(link) ? "series" : "movie";
  if (!imdbId) throw new Error(`Missing IMDb ID in metadata link: ${link}`);
  return { imdbId, type };
}
__name(getRequest, "getRequest");
function createPayload(imdbId, type, meta, video) {
  var _a, _b, _c, _d, _e;
  const videoParts = ((_a = video == null ? void 0 : video.id) == null ? void 0 : _a.split(":")) || [];
  return JSON.stringify({
    title: meta.name || "",
    imdbId,
    season: ((_b = video == null ? void 0 : video.season) == null ? void 0 : _b.toString()) || videoParts[1] || "",
    episode: ((_d = (_c = video == null ? void 0 : video.episode) != null ? _c : video == null ? void 0 : video.number) == null ? void 0 : _d.toString()) || videoParts[2] || "",
    type,
    tmdbId: ((_e = meta.moviedb_id) == null ? void 0 : _e.toString()) || "",
    year: meta.year
  });
}
__name(createPayload, "createPayload");
var getMeta = /* @__PURE__ */ __name(function(_0) {
  return __async(this, arguments, function* ({
    link,
    providerContext
  }) {
    var _a;
    try {
      const { imdbId, type } = getRequest(link);
      const meta = yield getCinemetaMeta(imdbId, type, providerContext);
      const linkList = [];
      if (type === "series") {
        const seasons = /* @__PURE__ */ new Map();
        for (const video of meta.videos || []) {
          const episode = (_a = video.episode) != null ? _a : video.number;
          if (!video.season || video.season <= 0 || !episode) continue;
          const episodes = seasons.get(video.season) || [];
          episodes.push({
            title: `Episode ${episode}`,
            link: createPayload(imdbId, "series", meta, video)
          });
          seasons.set(video.season, episodes);
        }
        for (const season of [...seasons.keys()].sort((a, b) => a - b)) {
          linkList.push({
            title: `Season ${season}`,
            directLinks: enrichCinemetaEpisodes(seasons.get(season) || [], meta.videos || [], season)
          });
        }
      } else {
        linkList.push({
          title: meta.name || "Movie",
          directLinks: [
            {
              title: "Movie",
              type: "movie",
              link: createPayload(imdbId, "movie", meta)
            }
          ]
        });
      }
      return applyCinemetaMeta(
        {
          title: meta.name || "",
          synopsis: meta.description || "",
          image: meta.background || meta.poster || "",
          poster: meta.poster || "",
          imdbId: "",
          type,
          linkList
        },
        meta
      );
    } catch (err) {
      throwProviderError("Torrentio", "metadata", err);
    }
  });
}, "getMeta");
exports.getMeta = getMeta;
// Annotate the CommonJS export names for ESM import in node:

