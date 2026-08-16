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

// providers/kmMovies/stream.ts
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

// providers/extractors/gofile.ts
var GOFILE_API = "https://api.gofile.io";
var GOFILE_LANGUAGE = "en-US";
var GOFILE_WEBSITE_SECRET = "9844d94d963d30";
var GOFILE_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0";
var SHA256_CONSTANTS = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
var INITIAL_HASH = [
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
];
function rotateRight(value, amount) {
  return value >>> amount | value << 32 - amount;
}
__name(rotateRight, "rotateRight");
function encodeUtf8(value) {
  const bytes = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint < 128) {
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      bytes.push(192 | codePoint >>> 6, 128 | codePoint & 63);
    } else if (codePoint < 65536) {
      bytes.push(
        224 | codePoint >>> 12,
        128 | codePoint >>> 6 & 63,
        128 | codePoint & 63
      );
    } else {
      bytes.push(
        240 | codePoint >>> 18,
        128 | codePoint >>> 12 & 63,
        128 | codePoint >>> 6 & 63,
        128 | codePoint & 63
      );
    }
  }
  return bytes;
}
__name(encodeUtf8, "encodeUtf8");
function sha256(value) {
  const bytes = encodeUtf8(value);
  const bitLength = bytes.length * 8;
  const hash = [...INITIAL_HASH];
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const highBits = Math.floor(bitLength / 4294967296);
  const lowBits = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push(highBits >>> shift);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push(lowBits >>> shift);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array(64);
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] = bytes[position] << 24 | bytes[position + 1] << 16 | bytes[position + 2] << 8 | bytes[position + 3];
    }
    for (let index = 16; index < 64; index += 1) {
      const first = words[index - 15];
      const second = words[index - 2];
      const sigma0 = rotateRight(first, 7) ^ rotateRight(first, 18) ^ first >>> 3;
      const sigma1 = rotateRight(second, 17) ^ rotateRight(second, 19) ^ second >>> 10;
      words[index] = words[index - 16] + sigma0 + words[index - 7] + sigma1 | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = e & f ^ ~e & g;
      const temp1 = h + sum1 + choice + SHA256_CONSTANTS[index] + words[index] | 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = a & b ^ a & c ^ b & c;
      const temp2 = sum0 + majority | 0;
      h = g;
      g = f;
      f = e;
      e = d + temp1 | 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 | 0;
    }
    hash[0] = hash[0] + a | 0;
    hash[1] = hash[1] + b | 0;
    hash[2] = hash[2] + c | 0;
    hash[3] = hash[3] + d | 0;
    hash[4] = hash[4] + e | 0;
    hash[5] = hash[5] + f | 0;
    hash[6] = hash[6] + g | 0;
    hash[7] = hash[7] + h | 0;
  }
  return hash.map((word) => (word >>> 0).toString(16).padStart(8, "0")).join("");
}
__name(sha256, "sha256");
function generateWebsiteToken(accountToken, now = Date.now()) {
  const timeBucket = Math.floor(now / 1e3 / 14400);
  return sha256(
    [GOFILE_USER_AGENT, GOFILE_LANGUAGE, accountToken, timeBucket, GOFILE_WEBSITE_SECRET].join(
      "::"
    )
  );
}
__name(generateWebsiteToken, "generateWebsiteToken");
function findFirstFile(content) {
  var _a;
  if (content.type === "file" && content.link) return content;
  for (const child of Object.values((_a = content.children) != null ? _a : {})) {
    const file = findFirstFile(child);
    if (file) return file;
  }
  return void 0;
}
__name(findFirstFile, "findFirstFile");
function gofileExtractor(id, axios) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e;
    try {
      const accountResponse = yield axios.post(`${GOFILE_API}/accounts`);
      const token = (_b = (_a = accountResponse.data) == null ? void 0 : _a.data) == null ? void 0 : _b.token;
      if (!token) throw new Error("Gofile did not return an account token");
      const response = yield axios.get(`${GOFILE_API}/contents/${id}`, {
        params: {
          contentFilter: "",
          page: 1,
          pageSize: 1e3,
          sortField: "name",
          sortDirection: 1
        },
        headers: {
          Accept: "*/*",
          "Accept-Language": `${GOFILE_LANGUAGE},en;q=0.9`,
          Authorization: `Bearer ${token}`,
          Origin: "https://gofile.io",
          Referer: "https://gofile.io/",
          "User-Agent": GOFILE_USER_AGENT,
          "X-BL": GOFILE_LANGUAGE,
          "X-Website-Token": generateWebsiteToken(token)
        }
      });
      if (((_c = response.data) == null ? void 0 : _c.status) !== "ok") {
        throw new Error(`Gofile API returned ${(_e = (_d = response.data) == null ? void 0 : _d.status) != null ? _e : "invalid data"}`);
      }
      const file = findFirstFile(response.data.data);
      if (!(file == null ? void 0 : file.link)) throw new Error("No downloadable file found");
      return { link: file.link, token };
    } catch (error) {
      throwProviderError("Gofile", `extract ${id}`, error);
    }
  });
}
__name(gofileExtractor, "gofileExtractor");

// providers/extractors/hubcloud.ts
var hubcloudDecode = /* @__PURE__ */ __name(function(value) {
  if (value === void 0) {
    return "";
  }
  return atob(value.toString());
}, "hubcloudDecode");
var extractUrlFromScript = /* @__PURE__ */ __name((html) => {
  var _a, _b, _c;
  const doubleAtobMatch = html.match(
    /(?:var|let|const)\s+\w+\s*=\s*atob\(atob\(['"]([^'"]+)['"]\)\)/
  );
  if (doubleAtobMatch == null ? void 0 : doubleAtobMatch[1]) {
    return atob(atob(doubleAtobMatch[1]));
  }
  const plainMatch = html.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/);
  return hubcloudDecode((_c = (_b = (_a = plainMatch == null ? void 0 : plainMatch[1]) == null ? void 0 : _a.split("r=")) == null ? void 0 : _b[1]) != null ? _c : "") || (plainMatch == null ? void 0 : plainMatch[1]) || "";
}, "extractUrlFromScript");
var getPixelDrainUrl = /* @__PURE__ */ __name((html) => {
  const match = html.match(/var\s+pxl\s*=\s*['"]([^'"]+)['"];?/i);
  return (match == null ? void 0 : match[1]) || "";
}, "getPixelDrainUrl");
var getRedirectedPixelDrainUrl = /* @__PURE__ */ __name((...htmlSources) => {
  for (const html of htmlSources) {
    if (!html) {
      continue;
    }
    const redirectedUrl = getPixelDrainUrl(html);
    if (redirectedUrl) {
      return redirectedUrl;
    }
  }
  return "";
}, "getRedirectedPixelDrainUrl");
function hubcloudExtractor(link, signal, axios, cheerio, headers2, providerContext) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      if (!headers2["Cookie"]) {
        headers2["Cookie"] = "ext_name=ojplmecpdpgccookcobabopnaifgidhf; xla=s4t; cf_clearance=woQrFGXtLfmEMBEiGUsVHrUBMT8s3cmguIzmMjmvpkg-1770053679-1.2.1.1-xBrQdciOJsweUF6F2T_OtH6jmyanN_TduQ0yslc_XqjU6RcHSxI7.YOKv6ry7oYo64868HYoULnVyww536H2eVI3R2e4wKzsky6abjPdfQPxqpUaXjxfJ02o6jl3_Vkwr4uiaU7Wy596Vdst3y78HXvVmKdIohhtPvp.vZ9_L7wvWdce0GRixjh_6JiqWmWMws46hwEt3hboaS1e1e4EoWCvj5b0M_jVwvSxBOAW5emFzvT3QrnRh4nyYmKDERnY";
      }
      console.log("hubcloudExtractor", link);
      const baseUrl = link.split("/").slice(0, 3).join("/");
      const streamLinks = [];
      const openWebView = providerContext == null ? void 0 : providerContext.openWebView;
      let vLinkRes;
      try {
        vLinkRes = yield axios(`${link}`, { headers: headers2, signal });
      } catch (error) {
        if (((_a = error.response) == null ? void 0 : _a.status) === 403) {
          if (openWebView) {
            console.log(`hubcloudExtractor: WAF detected (403) for ${link}, using solver...`);
            const cleanHeaders = __spreadProps(__spreadValues({}, headers2), { Referer: baseUrl });
            delete cleanHeaders["User-Agent"];
            delete cleanHeaders["sec-ch-ua"];
            delete cleanHeaders["sec-ch-ua-mobile"];
            delete cleanHeaders["sec-ch-ua-platform"];
            delete cleanHeaders["Cookie"];
            const wafResult = yield openWebView(baseUrl, {
              title: "Solve the captcha below and click done",
              description: "Required to bypass anti-bot protection.",
              headers: cleanHeaders,
              waitForCookie: "cf_clearance",
              force: true
            });
            if (wafResult.userAgent) headers2["User-Agent"] = wafResult.userAgent;
            headers2["Cookie"] = (headers2["Cookie"] ? headers2["Cookie"] + "; " : "") + wafResult.cookies;
            vLinkRes = yield axios(`${link}`, { headers: headers2, signal });
          } else {
            console.log(
              `hubcloudExtractor: 403 Forbidden for ${link}, but openWebView solver is not available!`
            );
            throw error;
          }
        } else {
          throw error;
        }
      }
      const vLinkText = vLinkRes.data;
      const $vLink = cheerio.load(vLinkText);
      let vcloudLink = extractUrlFromScript(vLinkText) || $vLink(".fa-file-download.fa-lg").parent().attr("href") || link;
      console.log("vcloudLink", vcloudLink);
      if (vcloudLink == null ? void 0 : vcloudLink.startsWith("/")) {
        vcloudLink = `${baseUrl}${vcloudLink}`;
        console.log("New vcloudLink", vcloudLink);
      }
      let vcloudText = "";
      try {
        const vcloudRes = yield axios.get(vcloudLink, { headers: headers2, signal });
        vcloudText = vcloudRes.data;
      } catch (error) {
        if (((_b = error.response) == null ? void 0 : _b.status) === 403 && openWebView) {
          console.log(`hubcloudExtractor: WAF detected (403) for ${vcloudLink}, using solver...`);
          const vcloudBaseUrl = vcloudLink.split("/").slice(0, 3).join("/");
          const cleanHeaders2 = __spreadProps(__spreadValues({}, headers2), { Referer: vcloudBaseUrl });
          delete cleanHeaders2["User-Agent"];
          delete cleanHeaders2["sec-ch-ua"];
          delete cleanHeaders2["sec-ch-ua-mobile"];
          delete cleanHeaders2["sec-ch-ua-platform"];
          delete cleanHeaders2["Cookie"];
          const wafResult = yield openWebView(vcloudBaseUrl, {
            title: "Solve the captcha below and click done",
            description: "Required to bypass anti-bot protection.",
            headers: cleanHeaders2,
            waitForCookie: "cf_clearance",
            force: true
          });
          if (wafResult.userAgent) headers2["User-Agent"] = wafResult.userAgent;
          headers2["Cookie"] = (headers2["Cookie"] ? headers2["Cookie"] + "; " : "") + wafResult.cookies;
          const retryRes = yield axios.get(vcloudLink, { headers: headers2, signal });
          vcloudText = retryRes.data;
        } else {
          if (((_c = error.response) == null ? void 0 : _c.status) === 403 && !openWebView) {
            console.log(
              `hubcloudExtractor: 403 Forbidden for ${vcloudLink}, but openWebView solver is not available!`
            );
          }
          let fetchRes = yield fetch(vcloudLink, {
            headers: headers2,
            signal,
            redirect: "follow"
          });
          if (fetchRes.status === 403 && openWebView) {
            console.log(`hubcloudExtractor: WAF detected (403) for ${vcloudLink}, using solver...`);
            const vcloudBaseUrl = vcloudLink.split("/").slice(0, 3).join("/");
            const cleanHeaders3 = __spreadProps(__spreadValues({}, headers2), { Referer: vcloudBaseUrl });
            delete cleanHeaders3["User-Agent"];
            delete cleanHeaders3["sec-ch-ua"];
            delete cleanHeaders3["sec-ch-ua-mobile"];
            delete cleanHeaders3["sec-ch-ua-platform"];
            delete cleanHeaders3["Cookie"];
            const wafResult = yield openWebView(vcloudBaseUrl, {
              title: "Solve the captcha below and click done",
              description: "Required to bypass anti-bot protection.",
              headers: cleanHeaders3,
              waitForCookie: "cf_clearance",
              force: true
            });
            if (wafResult.userAgent) headers2["User-Agent"] = wafResult.userAgent;
            headers2["Cookie"] = (headers2["Cookie"] ? headers2["Cookie"] + "; " : "") + wafResult.cookies;
            fetchRes = yield fetch(vcloudLink, {
              headers: headers2,
              signal,
              redirect: "follow"
            });
          }
          if (!fetchRes.ok) {
            throw new Error(`HTTP ${fetchRes.status} ${fetchRes.statusText} | URL ${vcloudLink}`);
          }
          vcloudText = yield fetchRes.text();
        }
      }
      const $ = cheerio.load(vcloudText);
      const linkClass = $(".btn-success.btn-lg.h6,.btn-danger,.btn-secondary");
      for (const element of linkClass) {
        const itm = $(element);
        let link2 = itm.attr("href") || "";
        switch (true) {
          case (link2 == null ? void 0 : link2.includes("pixeld")):
            console.log("Pixeldrain link found:", link2);
            if (!(link2 == null ? void 0 : link2.includes("api"))) {
              const redirectedPixelDrainUrl = getRedirectedPixelDrainUrl(vLinkText, vcloudText);
              if (redirectedPixelDrainUrl) {
                console.log("Special case for token negn6f", redirectedPixelDrainUrl);
                link2 = redirectedPixelDrainUrl;
              }
              const token = (_d = link2.split("/").pop()) == null ? void 0 : _d.split("?")[0];
              const baseUrl2 = link2.split("/").slice(0, -2).join("/");
              link2 = `${baseUrl2}/api/file/${token}?download`;
            }
            streamLinks.push({ server: "Pixeldrain", link: link2, type: "mkv" });
            break;
          case ((link2 == null ? void 0 : link2.includes(".dev")) && !(link2 == null ? void 0 : link2.includes("/?id="))):
            streamLinks.push({ server: "CF Worker", link: link2, type: "mkv" });
            break;
          case ((link2 == null ? void 0 : link2.includes("hubcloud")) || (link2 == null ? void 0 : link2.includes("/?id="))):
            try {
              const newLinkRes = yield fetch(link2, {
                method: "HEAD",
                headers: headers2,
                signal,
                redirect: "manual"
              });
              let newLink = link2;
              if (newLinkRes.status >= 300 && newLinkRes.status < 400) {
                newLink = newLinkRes.headers.get("location") || link2;
              } else if (newLinkRes.url && newLinkRes.url !== link2) {
                newLink = newLinkRes.url;
              } else {
                newLink = newLinkRes.headers.get("location") || link2;
              }
              if (newLink.includes("googleusercontent")) {
                newLink = newLink.split("?link=")[1];
              } else {
                const newLinkRes2 = yield fetch(newLink, {
                  method: "HEAD",
                  headers: headers2,
                  signal,
                  redirect: "manual"
                });
                if (newLinkRes2.status >= 300 && newLinkRes2.status < 400) {
                  newLink = ((_e = newLinkRes2.headers.get("location")) == null ? void 0 : _e.split("?link=")[1]) || newLink;
                } else if (newLinkRes2.url && newLinkRes2.url !== newLink) {
                  newLink = newLinkRes2.url.split("?link=")[1] || newLinkRes2.url;
                } else {
                  newLink = ((_f = newLinkRes2.headers.get("location")) == null ? void 0 : _f.split("?link=")[1]) || newLink;
                }
              }
              streamLinks.push({
                server: "GDrive (download only)",
                link: newLink,
                type: "mkv"
              });
            } catch (error) {
              console.log("hubcloudExtractor error in hubcloud link: ", error);
            }
            break;
          case (link2 == null ? void 0 : link2.includes("cloudflarestorage")):
            streamLinks.push({ server: "CF Storage", link: link2, type: "mkv" });
            break;
          case ((link2 == null ? void 0 : link2.includes("fastdl")) || (link2 == null ? void 0 : link2.includes("fsl."))):
            streamLinks.push({ server: "FastDl", link: link2, type: "mkv" });
            break;
          case (link2.includes("hubcdn") && !link2.includes("/?id=")):
            streamLinks.push({
              server: "HubCdn",
              link: link2,
              type: "mkv"
            });
            break;
          default:
            if ((link2 == null ? void 0 : link2.includes(".mkv")) || (link2 == null ? void 0 : link2.includes("?token="))) {
              const serverName = ((_h = (_g = link2.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i)) == null ? void 0 : _g[1]) == null ? void 0 : _h.replace(/\./g, " ")) || "Unknown";
              streamLinks.push({ server: serverName, link: link2, type: "mkv" });
            }
            break;
        }
      }
      console.log("streamLinks", streamLinks);
      return streamLinks;
    } catch (error) {
      throwProviderError("HubCloud", `extract ${link}`, error);
    }
  });
}
__name(hubcloudExtractor, "hubcloudExtractor");

// providers/kmMovies/stream.ts
var headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Pragma: "no-cache",
  "Cache-Control": "no-cache"
};
var browserHeaders = __spreadProps(__spreadValues({}, headers), {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9,en-IN;q=0.8",
  DNT: "1",
  Priority: "u=0, i",
  "Sec-CH-UA": '"Not;A=Brand";v="8", "Chromium";v="150", "Microsoft Edge";v="150"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
});
var SERVER_PATTERNS = {
  "ZIP-ZAP": /* @__PURE__ */ __name((name, href) => name.includes("ZIP-ZAP") || href.includes("kmphotos.cv/download"), "ZIP-ZAP"),
  BUZZHEAVIER: /* @__PURE__ */ __name((name, href) => name.includes("BUZZHEAVIER") || name.includes("BUZZHIEVER") || href.includes("bzzhr.co"), "BUZZHEAVIER"),
  SKYDROP: /* @__PURE__ */ __name((name, href) => name.includes("SKYDROP") || href.includes("skydrop.sbs/"), "SKYDROP"),
  GOFILE: /* @__PURE__ */ __name((name, href) => name.includes("GOFILE") || href.includes("gofile.io/"), "GOFILE"),
  HUBCLOUD: /* @__PURE__ */ __name((name, href) => name.includes("HUBCLOUD") || href.includes("hubcloud."), "HUBCLOUD")
};
function getMagicLinksPage(url, requestHeaders) {
  return __async(this, null, function* () {
    const initialResponse = yield fetch(url, {
      headers: requestHeaders,
      credentials: "include",
      cache: "no-store",
      redirect: "manual"
    });
    const location = initialResponse.headers.get("location");
    const setCookie = initialResponse.headers.get("set-cookie");
    if (!location || !setCookie) {
      if (!initialResponse.ok) {
        throw new Error(`HTTP ${initialResponse.status} ${initialResponse.statusText} | URL ${url}`);
      }
      return { data: yield initialResponse.text() };
    }
    const cookie = setCookie.split(";", 1)[0];
    const destination = new URL(location, url).href;
    const response = yield fetch(destination, {
      headers: __spreadProps(__spreadValues({}, requestHeaders), {
        Cookie: cookie,
        Referer: url
      }),
      credentials: "include",
      cache: "no-store",
      redirect: "follow"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} | URL ${destination}`);
    }
    return { data: yield response.text() };
  });
}
__name(getMagicLinksPage, "getMagicLinksPage");
function getWithWAF(url, axios, openWebView) {
  return __async(this, null, function* () {
    var _a;
    const baseUrl = url.split("/").slice(0, 3).join("/");
    const requestHeaders = __spreadProps(__spreadValues({}, headers), { Referer: baseUrl });
    try {
      if (new URL(url).hostname.includes("magiclinks")) {
        return yield getMagicLinksPage(url, requestHeaders);
      }
      return yield axios.get(url, {
        headers: requestHeaders,
        responseType: "text"
      });
    } catch (error) {
      if (((_a = error.response) == null ? void 0 : _a.status) === 403 && openWebView) {
        console.log(`WAF detected (403) for ${url}, using solver...`);
        const wafResult = yield openWebView(baseUrl, {
          title: "Solve the captcha below and click done",
          description: "Required to bypass anti-bot protection.",
          headers: __spreadProps(__spreadValues({}, headers), { Referer: baseUrl }),
          waitForCookie: "cf_clearance"
        });
        return yield axios.get(url, {
          headers: __spreadProps(__spreadValues({}, headers), { Referer: baseUrl, Cookie: wafResult.cookies }),
          responseType: "text"
        });
      }
      throw error;
    }
  });
}
__name(getWithWAF, "getWithWAF");
function extractDownloadLinks($) {
  const links = [];
  const seen = /* @__PURE__ */ new Set();
  $("a[href]").each((_, element) => {
    var _a;
    const href = (_a = $(element).attr("href")) == null ? void 0 : _a.trim();
    if (!href || seen.has(href)) return;
    const name = $(element).text().replace(/\s+/g, " ").trim().toUpperCase();
    for (const [server, matches] of Object.entries(SERVER_PATTERNS)) {
      if (matches(name, href)) {
        seen.add(href);
        links.push({ server, link: href });
        return;
      }
    }
  });
  return links;
}
__name(extractDownloadLinks, "extractDownloadLinks");
function captureRedirect(url, axios, requestHeaders) {
  return __async(this, null, function* () {
    var _a;
    const response = yield axios.get(url, {
      headers: requestHeaders,
      maxRedirects: 0,
      validateStatus: /* @__PURE__ */ __name((status) => status >= 200 && status < 400, "validateStatus")
    });
    return ((_a = response.headers) == null ? void 0 : _a.location) ? new URL(response.headers.location, url).href : "";
  });
}
__name(captureRedirect, "captureRedirect");
function resolveZipZap(link, axios, cheerio, commonHeaders) {
  return __async(this, null, function* () {
    const downloadUrl = new URL(link);
    const requestHeaders = __spreadProps(__spreadValues(__spreadValues({}, headers), commonHeaders), {
      Referer: downloadUrl.origin
    });
    const pageResponse = yield axios.get(downloadUrl.href, {
      headers: requestHeaders
    });
    const $ = cheerio.load(pageResponse.data);
    const r2Href = $("a[href*='dl=r2']").first().attr("href");
    if (!r2Href) return null;
    const r2Url = new URL(r2Href, downloadUrl);
    const rawUrl = yield captureRedirect(r2Url.href, axios, __spreadProps(__spreadValues({}, requestHeaders), {
      Referer: downloadUrl.href
    }));
    return rawUrl ? { server: "ZIP-ZAP", link: rawUrl, type: "mkv" } : null;
  });
}
__name(resolveZipZap, "resolveZipZap");
function resolveBuzzheavier(link, axios, cheerio, commonHeaders) {
  return __async(this, null, function* () {
    var _a, _b;
    const origin = new URL(link).origin;
    const requestHeaders = __spreadProps(__spreadValues(__spreadValues({}, browserHeaders), commonHeaders), {
      Referer: origin
    });
    const pageResponse = yield axios.get(link, { headers: requestHeaders });
    const $ = cheerio.load(pageResponse.data);
    const downloadPath = $("a.download-btn").attr("hx-get");
    if (!downloadPath) return null;
    const downloadUrl = new URL(downloadPath, origin).href;
    const setCookie = (_a = pageResponse.headers) == null ? void 0 : _a["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean).map((value) => value.split(";", 1)[0]).join("; ");
    const downloadResponse = yield axios.head(downloadUrl, {
      headers: __spreadValues(__spreadProps(__spreadValues({}, requestHeaders), {
        Referer: link,
        "HX-Request": "true",
        "HX-Current-URL": link
      }), cookie ? { Cookie: cookie } : {}),
      validateStatus: /* @__PURE__ */ __name((status) => status >= 200 && status < 300, "validateStatus")
    });
    const redirectUrl = (_b = downloadResponse.headers) == null ? void 0 : _b["hx-redirect"];
    if (!redirectUrl) return null;
    return {
      server: "BUZZHEAVIER",
      link: new URL(redirectUrl, origin).href,
      type: "mkv",
      headers: {
        Referer: link,
        "User-Agent": requestHeaders["User-Agent"]
      }
    };
  });
}
__name(resolveBuzzheavier, "resolveBuzzheavier");
function resolveSkyDrop(link, axios) {
  return __async(this, null, function* () {
    var _a;
    const skyDropUrl = new URL(link);
    const id = skyDropUrl.searchParams.get("id");
    if (!id) return null;
    const response = yield axios.get(`${skyDropUrl.origin}/api.php`, {
      params: { id },
      headers
    });
    if (!((_a = response.data) == null ? void 0 : _a.success) || !response.data.link) return null;
    return { server: "SkyDrop", link: response.data.link, type: "mkv" };
  });
}
__name(resolveSkyDrop, "resolveSkyDrop");
function resolveGofile(link, axios) {
  return __async(this, null, function* () {
    const gofileUrl = new URL(link);
    const id = gofileUrl.pathname.split("/").filter(Boolean).pop();
    if (!id) return null;
    const result = yield gofileExtractor(id, axios);
    if (!result.link || !result.token) return null;
    return {
      server: "Gofile",
      link: result.link,
      type: "mkv",
      headers: {
        Referer: "https://gofile.io/",
        Cookie: `accountToken=${result.token}`
      }
    };
  });
}
__name(resolveGofile, "resolveGofile");
function resolveHubcloud(link, signal, axios, cheerio, commonHeaders) {
  return __async(this, null, function* () {
    const streams = yield hubcloudExtractor(link, signal, axios, cheerio, __spreadValues(__spreadValues({}, headers), commonHeaders));
    return streams.find((stream) => stream == null ? void 0 : stream.link) || null;
  });
}
__name(resolveHubcloud, "resolveHubcloud");
function getStream(_0) {
  return __async(this, arguments, function* ({
    link,
    type,
    signal,
    providerContext
  }) {
    const { axios, cheerio, openWebView, commonHeaders } = providerContext;
    try {
      const res = yield getWithWAF(link, axios, openWebView);
      const $ = cheerio.load(res.data);
      const downloadLinks = extractDownloadLinks($);
      const resolvers = {
        "ZIP-ZAP": /* @__PURE__ */ __name((l) => resolveZipZap(l, axios, cheerio, commonHeaders || {}), "ZIP-ZAP"),
        BUZZHEAVIER: /* @__PURE__ */ __name((l) => resolveBuzzheavier(l, axios, cheerio, commonHeaders || {}), "BUZZHEAVIER"),
        SKYDROP: /* @__PURE__ */ __name((l) => resolveSkyDrop(l, axios), "SKYDROP"),
        GOFILE: /* @__PURE__ */ __name((l) => resolveGofile(l, axios), "GOFILE"),
        HUBCLOUD: /* @__PURE__ */ __name((l) => resolveHubcloud(l, signal, axios, cheerio, commonHeaders || {}), "HUBCLOUD")
      };
      const streams = [];
      const seen = /* @__PURE__ */ new Set();
      const resolverFailures = [];
      for (const server of [
        "ZIP-ZAP",
        "BUZZHEAVIER",
        "SKYDROP",
        "GOFILE",
        "HUBCLOUD"
      ]) {
        for (const { link: link2 } of downloadLinks.filter((d) => d.server === server)) {
          try {
            const stream = yield resolvers[server](link2);
            if (stream && !seen.has(stream.link)) {
              seen.add(stream.link);
              streams.push(stream);
              break;
            }
          } catch (error) {
            console.log(`${server} failed:`, error.message);
            resolverFailures.push(`${server}: ${error.message || String(error)}`);
          }
        }
      }
      if (downloadLinks.length > 0 && streams.length === 0 && resolverFailures.length > 0) {
        throw new Error(`All stream resolvers failed: ${resolverFailures.join("; ")}`);
      }
      return streams;
    } catch (error) {
      throwProviderError("KMMovies", "stream", error);
    }
  });
}
__name(getStream, "getStream");
exports.getStream = getStream;
// Annotate the CommonJS export names for ESM import in node:

