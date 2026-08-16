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

// providers/torrentio/stream.ts
var stream_exports = {};
__export(stream_exports, {
  getStream: () => getStream
});


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

// providers/torrentio/stream.ts
var languageCodes = [
  ["MULTI", "MULTI"],
  ["DUAL", "DUAL"],
  ["HINDI", "HI"],
  ["TAMIL", "TA"],
  ["TELUGU", "Tz"],
  ["SPANISH", "SP"],
  ["FRENCH", "FR"],
  ["GERMAN", "DE"],
  ["ITALIAN", "IT"],
  ["KOREAN", "KO"],
  ["JAPANESE", "JP"],
  ["ENGLISH", "EN"]
];
function getLanguageCodes(title) {
  const flagCodes = (title.match(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g) || []).map(
    (flag) => [...flag].map((character) => String.fromCharCode(65 + character.codePointAt(0) - 127462)).join("")
  );
  if (flagCodes.length > 0) {
    const unique = [...new Set(flagCodes)];
    if (unique.length > 2) return "MULTI";
    return unique.join(", ");
  }
  const uppercaseTitle = title.toUpperCase();
  const matches = languageCodes.filter(([language]) => uppercaseTitle.includes(language)).map(([, code]) => code);
  return matches.length > 0 ? [...new Set(matches)].join(", ") : "ENG";
}
__name(getLanguageCodes, "getLanguageCodes");
var getStream = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({
  link: id,
  type,
  providerContext
}) {
  var _a, _b, _c, _d, _e, _f;
  try {
    const payload = (() => {
      try {
        return JSON.parse(id);
      } catch (e) {
        return { imdbId: id };
      }
    })();
    let imdbId = (_b = (_a = payload.imdbId) != null ? _a : id) != null ? _b : "";
    const season = (_c = payload.season) != null ? _c : "";
    const episode = (_d = payload.episode) != null ? _d : "";
    const effectiveType = (_f = (_e = payload.type) != null ? _e : type) != null ? _f : "movie";
    if (!imdbId || imdbId === "undefined" || imdbId === "[object Object]") {
      if (id && id.startsWith("tt")) {
        imdbId = id;
      }
    }
    if (!imdbId || !imdbId.startsWith("tt")) {
      console.warn("torrentio: missing or invalid imdbId in link payload");
      return [];
    }
    let url = `https://torrentio.strem.fun/stream/${effectiveType}/${imdbId}`;
    if (effectiveType === "series" && season && episode) {
      url += `:${season}:${episode}`;
    }
    url += `.json`;
    console.log("Torrentio URL:", url);
    const res = yield providerContext.axios.get(url, {
      timeout: 1e4
    });
    const streams = [];
    if (res.data && res.data.streams) {
      res.data.streams.forEach((s) => {
        var _a2, _b2, _c2;
        let quality = void 0;
        const lowerName = (s.name || "").toLowerCase() + " " + (s.title || "").toLowerCase();
        if (lowerName.includes("2160") || lowerName.includes("4k")) quality = "2160";
        else if (lowerName.includes("1080")) quality = "1080";
        else if (lowerName.includes("720")) quality = "720";
        else if (lowerName.includes("480")) quality = "480";
        else if (lowerName.includes("360")) quality = "360";
        let link = s.url;
        if (!link && s.infoHash) {
          link = `magnet:?xt=urn:btih:${s.infoHash}`;
        }
        const title = s.title || "";
        const language = getLanguageCodes(title);
        const size = ((_a2 = title.match(/💾\s*([\d.]+\s*(?:KB|MB|GB|TB))/i)) == null ? void 0 : _a2[1]) || "";
        const uploader = ((_c2 = (_b2 = title.match(/⚙️\s*([^\n]+)/)) == null ? void 0 : _b2[1]) == null ? void 0 : _c2.trim()) || "";
        let seeders = "";
        const seedersMatch = title.match(/👤\s*(\d+)/);
        if (seedersMatch) {
          seeders = `\u{1F464}${seedersMatch[1]}`;
        } else {
          const slMatch = title.match(/S:\s*(\d+)/i);
          if (slMatch) {
            seeders = `\u{1F464}${slMatch[1]}`;
          }
        }
        const formatTags = [];
        const fullTitle = `${s.name || ""} ${title}`;
        if (/[\b\s.]DV[\b\s.]|Dolby\s*Vision/i.test(fullTitle)) formatTags.push("DV");
        if (/[\b\s.]HDR(?:10(?:\+)?)?[\b\s.]/i.test(fullTitle)) formatTags.push("HDR");
        if (/REMUX/i.test(fullTitle)) formatTags.push("Remux");
        const tagStr = formatTags.join("/");
        const serverParts = [];
        if (tagStr) serverParts.push(tagStr);
        if (language && language !== "ENG") serverParts.push(language);
        if (seeders) serverParts.push(seeders);
        if (size) serverParts.push(size);
        serverParts.push(uploader || "Torrentio");
        const serverName = serverParts.join(" \u2022");
        if (link) {
          streams.push({
            server: serverName,
            link,
            type: link.startsWith("magnet:") ? "torrent" : "mp4",
            quality
          });
        }
      });
    }
    console.log("Torrentio streams:", streams);
    return streams;
  } catch (err) {
    throwProviderError("Torrentio", "stream", err);
  }
}), "getStream");
exports.getStream = getStream;
// Annotate the CommonJS export names for ESM import in node:

