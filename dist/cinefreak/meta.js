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

// providers/cinefreak/meta.ts
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

// providers/getCinemetaMeta.ts
var CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io/meta";
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

// providers/cinefreak/meta.ts
var providerValue = "cinefreak";
var defaultBaseUrl = "https://cinefreak.net";
function cleanQuality(text) {
  const match = text.match(/\b(480p|720p|1080p|2160p|4k)\b/i);
  if (match) return match[1].toLowerCase();
  return "";
}
__name(cleanQuality, "cleanQuality");
function decodeCinefreakLink(link, baseUrl) {
  try {
    if (link.includes("generate.php") && link.includes("id=")) {
      const urlObj = new URL(link, baseUrl);
      const rawId = urlObj.searchParams.get("id") || "";
      if (rawId) {
        let decoded = "";
        try {
          decoded = atob(rawId);
        } catch (e) {
          decoded = Buffer.from(rawId, "base64").toString("utf8");
        }
        if (decoded.startsWith("http")) {
          return decoded.replace(/newgo\d*$/i, "");
        }
      }
    }
  } catch (e) {
  }
  try {
    return new URL(link, baseUrl).href;
  } catch (e) {
    return link;
  }
}
__name(decodeCinefreakLink, "decodeCinefreakLink");
var getMeta = /* @__PURE__ */ __name(function(_0) {
  return __async(this, arguments, function* ({
    link,
    providerContext
  }) {
    var _a;
    const { axios, cheerio, commonHeaders } = providerContext;
    try {
      const baseUrl = (yield getBaseUrl(providerValue)) || defaultBaseUrl;
      const url = new URL(link, baseUrl).href;
      const response = yield axios.get(url, {
        headers: __spreadProps(__spreadValues({}, commonHeaders), {
          Referer: `${baseUrl}/`
        })
      });
      const $ = cheerio.load(response.data || "");
      const rawTitle = $("h1.page-title, .page-title").first().text().replace(/\s+/g, " ").trim() || $("title").text().split("|")[0].trim();
      const title = rawTitle.replace(/Download\s*|Watch Online\s*/gi, "").replace(/\s*–\s*CineFreak.*$/i, "").replace(/\s*\|\s*CineFreak.*$/i, "").replace(/–\s*GDrive.*$/i, "").replace(/\|\s*GDrive.*$/i, "").replace(/\s*\[.*?\]/g, "").replace(/\s+/g, " ").trim();
      const image = $(".poster-image img, .content-sidebar img, .poster-container img").first().attr("src") || $('meta[property="og:image"]').attr("content") || "";
      let synopsis = "";
      $(".entry-content p").each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes("IMDb Rating") && !text.includes("Movie Details") && !text.includes("Series Info") && !text.includes("Screenshots") && !text.includes("Download") && !synopsis) {
          synopsis = text;
        }
      });
      let imdbId = "";
      const imdbLink = $('a[href*="imdb.com/title/"]').attr("href") || "";
      const imdbMatch = imdbLink.match(/tt\d+/i) || response.data.match(/tt\d+/i);
      if (imdbMatch) {
        imdbId = imdbMatch[0];
      } else {
        const tmdbLink = $('a[href*="themoviedb.org/"]').attr("href") || "";
        const tmdbMatch = tmdbLink.match(/themoviedb\.org\/(tv|movie)\/(\d+)/i);
        if (tmdbMatch) {
          const tmdbType = tmdbMatch[1] === "tv" ? "tv" : "movie";
          const tmdbNum = tmdbMatch[2];
          try {
            const tmdbRes = yield axios.get(
              `https://api.themoviedb.org/3/${tmdbType}/${tmdbNum}/external_ids?api_key=cfe422613b250f702980a3bbf9e90716`,
              { timeout: 5e3 }
            );
            if ((_a = tmdbRes.data) == null ? void 0 : _a.imdb_id) {
              imdbId = tmdbRes.data.imdb_id;
            }
          } catch (e) {
            console.warn(`CineFreak: Failed to resolve TMDb to IMDb via API: ${e.message}`);
          }
        }
      }
      const hasEpisodeCards = $(".ep-card").length > 0;
      const isSeries = hasEpisodeCards || /season|series|episode|k-drama/i.test(rawTitle) || $('a[href*="/web-series/"]').length > 0;
      const linkList = [];
      if (hasEpisodeCards) {
        const seasonMap = {};
        $(".ep-card").each((_, epElement) => {
          var _a2, _b;
          const card = $(epElement);
          const seasonText = card.find(".season-number").text().trim();
          const seasonNum = ((_a2 = seasonText.match(/\d+/)) == null ? void 0 : _a2[0]) || "1";
          const seasonName = `Season ${parseInt(seasonNum, 10)}`;
          const epBadgeText = card.find(".episode-badge").text().trim();
          const epNumMatch = (_b = epBadgeText.match(/\d+/)) == null ? void 0 : _b[0];
          const episodeTitle = epNumMatch ? `EPISODE ${parseInt(epNumMatch, 10)}` : epBadgeText || "EPISODE 1";
          if (!seasonMap[seasonName]) {
            seasonMap[seasonName] = {};
          }
          card.find(".download-links .quality-grid a, .quality-box.download-links a").each((_2, qEl) => {
            const qAnchor = $(qEl);
            const qText = qAnchor.text().trim();
            const quality = cleanQuality(qText) || "720p";
            const qHref = qAnchor.attr("href") || "";
            if (!qHref) return;
            const fullLink = decodeCinefreakLink(qHref, baseUrl);
            if (!seasonMap[seasonName][quality]) {
              seasonMap[seasonName][quality] = [];
            }
            const exists = seasonMap[seasonName][quality].some((ep) => ep.title === episodeTitle);
            if (!exists) {
              seasonMap[seasonName][quality].push({
                title: episodeTitle,
                link: fullLink,
                type: "series"
              });
            }
          });
        });
        for (const [seasonName, qualityObj] of Object.entries(seasonMap)) {
          const qualityKeys = Object.keys(qualityObj);
          for (const quality of qualityKeys) {
            const directLinks = qualityObj[quality];
            directLinks.sort((a, b) => {
              const numA = parseInt(a.title.replace(/\D+/g, "") || "0", 10);
              const numB = parseInt(b.title.replace(/\D+/g, "") || "0", 10);
              return numA - numB;
            });
            linkList.push({
              title: qualityKeys.length > 1 ? `${seasonName} - ${quality}` : seasonName,
              quality,
              directLinks
            });
          }
        }
      }
      if (linkList.length === 0) {
        $(".download-links-div h4.movie-title, .download-links-div h3.movie-title").each(
          (_, headingEl) => {
            const heading = $(headingEl);
            const headingText = heading.text().replace(/\s+/g, " ").trim();
            const quality = cleanQuality(headingText);
            const container = heading.nextAll(".dlbtn-container").first();
            const directLinks = [];
            container.find("a[href]").each((_2, aEl) => {
              const btn = $(aEl);
              const href = btn.attr("href");
              if (!href) return;
              const fullLink = decodeCinefreakLink(href, baseUrl);
              const btnText = btn.text().replace(/\s+/g, " ").trim() || "Download";
              directLinks.push({
                title: btnText.includes("Watch") ? "Watch Online" : "Download",
                link: fullLink,
                type: isSeries ? "series" : "movie"
              });
            });
            if (directLinks.length > 0) {
              linkList.push({
                title: headingText || `${quality || "Default"} Links`,
                quality: quality || void 0,
                directLinks
              });
            }
          }
        );
      }
      if (linkList.length === 0) {
        const fallbackLinks = [];
        $('a[href*="generate.php"]').each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            fallbackLinks.push({
              title: $(el).text().replace(/\s+/g, " ").trim() || "Download",
              link: decodeCinefreakLink(href, baseUrl),
              type: isSeries ? "series" : "movie"
            });
          }
        });
        if (fallbackLinks.length > 0) {
          linkList.push({
            title: isSeries ? "Episodes" : "Movie Links",
            directLinks: fallbackLinks
          });
        }
      }
      let info = {
        title,
        image,
        synopsis,
        imdbId: imdbId || "",
        type: isSeries ? "series" : "movie",
        linkList
      };
      if (imdbId && /^tt\d+$/.test(imdbId)) {
        try {
          const cinemeta = yield getCinemetaMeta(imdbId, info.type, providerContext);
          if (cinemeta) {
            info = applyCinemetaMeta(info, cinemeta);
            if (cinemeta.videos && info.linkList) {
              info.linkList = info.linkList.map((linkGroup) => {
                var _a2;
                if (linkGroup.directLinks) {
                  const seasonNum = parseInt(
                    ((_a2 = linkGroup.title.match(/season\s*(\d+)/i)) == null ? void 0 : _a2[1]) || "1",
                    10
                  );
                  return __spreadProps(__spreadValues({}, linkGroup), {
                    directLinks: enrichCinemetaEpisodes(
                      linkGroup.directLinks,
                      cinemeta.videos || [],
                      seasonNum
                    )
                  });
                }
                return linkGroup;
              });
            }
          }
        } catch (e) {
        }
      }
      return info;
    } catch (error) {
      throwProviderError("CineFreak", "meta", error);
    }
  });
}, "getMeta");
exports.getMeta = getMeta;
// Annotate the CommonJS export names for ESM import in node:

