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

// providers/4khdhub/stream.ts
var stream_exports = {};
__export(stream_exports, {
  decodeString: () => decodeString,
  getRedirectLinks: () => getRedirectLinks,
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
function hubcloudExtractor(link, signal, axios, cheerio, headers, providerContext) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      if (!headers["Cookie"]) {
        headers["Cookie"] = "ext_name=ojplmecpdpgccookcobabopnaifgidhf; xla=s4t; cf_clearance=woQrFGXtLfmEMBEiGUsVHrUBMT8s3cmguIzmMjmvpkg-1770053679-1.2.1.1-xBrQdciOJsweUF6F2T_OtH6jmyanN_TduQ0yslc_XqjU6RcHSxI7.YOKv6ry7oYo64868HYoULnVyww536H2eVI3R2e4wKzsky6abjPdfQPxqpUaXjxfJ02o6jl3_Vkwr4uiaU7Wy596Vdst3y78HXvVmKdIohhtPvp.vZ9_L7wvWdce0GRixjh_6JiqWmWMws46hwEt3hboaS1e1e4EoWCvj5b0M_jVwvSxBOAW5emFzvT3QrnRh4nyYmKDERnY";
      }
      console.log("hubcloudExtractor", link);
      const baseUrl = link.split("/").slice(0, 3).join("/");
      const streamLinks = [];
      const openWebView = providerContext == null ? void 0 : providerContext.openWebView;
      let vLinkRes;
      try {
        vLinkRes = yield axios(`${link}`, { headers, signal });
      } catch (error) {
        if (((_a = error.response) == null ? void 0 : _a.status) === 403) {
          if (openWebView) {
            console.log(`hubcloudExtractor: WAF detected (403) for ${link}, using solver...`);
            const cleanHeaders = __spreadProps(__spreadValues({}, headers), { Referer: baseUrl });
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
            if (wafResult.userAgent) headers["User-Agent"] = wafResult.userAgent;
            headers["Cookie"] = (headers["Cookie"] ? headers["Cookie"] + "; " : "") + wafResult.cookies;
            vLinkRes = yield axios(`${link}`, { headers, signal });
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
        const vcloudRes = yield axios.get(vcloudLink, { headers, signal });
        vcloudText = vcloudRes.data;
      } catch (error) {
        if (((_b = error.response) == null ? void 0 : _b.status) === 403 && openWebView) {
          console.log(`hubcloudExtractor: WAF detected (403) for ${vcloudLink}, using solver...`);
          const vcloudBaseUrl = vcloudLink.split("/").slice(0, 3).join("/");
          const cleanHeaders2 = __spreadProps(__spreadValues({}, headers), { Referer: vcloudBaseUrl });
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
          if (wafResult.userAgent) headers["User-Agent"] = wafResult.userAgent;
          headers["Cookie"] = (headers["Cookie"] ? headers["Cookie"] + "; " : "") + wafResult.cookies;
          const retryRes = yield axios.get(vcloudLink, { headers, signal });
          vcloudText = retryRes.data;
        } else {
          if (((_c = error.response) == null ? void 0 : _c.status) === 403 && !openWebView) {
            console.log(
              `hubcloudExtractor: 403 Forbidden for ${vcloudLink}, but openWebView solver is not available!`
            );
          }
          let fetchRes = yield fetch(vcloudLink, {
            headers,
            signal,
            redirect: "follow"
          });
          if (fetchRes.status === 403 && openWebView) {
            console.log(`hubcloudExtractor: WAF detected (403) for ${vcloudLink}, using solver...`);
            const vcloudBaseUrl = vcloudLink.split("/").slice(0, 3).join("/");
            const cleanHeaders3 = __spreadProps(__spreadValues({}, headers), { Referer: vcloudBaseUrl });
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
            if (wafResult.userAgent) headers["User-Agent"] = wafResult.userAgent;
            headers["Cookie"] = (headers["Cookie"] ? headers["Cookie"] + "; " : "") + wafResult.cookies;
            fetchRes = yield fetch(vcloudLink, {
              headers,
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
                headers,
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
                  headers,
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

// providers/4khdhub/stream.ts
function getStream(_0) {
  return __async(this, arguments, function* ({
    link,
    signal,
    providerContext
  }) {
    var _a, _b, _c, _d;
    const { axios, cheerio, commonHeaders: headers } = providerContext;
    let hubdriveLink = "";
    if (link.includes("hubdrive")) {
      const hubdriveRes = yield axios.get(link, { headers, signal });
      const hubdriveText = hubdriveRes.data;
      const $ = cheerio.load(hubdriveText);
      hubdriveLink = $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href") || link;
    } else {
      const res = yield axios.get(link, { headers, signal });
      const text = res.data;
      const encryptedString = (_c = (_b = (_a = text.split("s('o','")) == null ? void 0 : _a[1]) == null ? void 0 : _b.split("',180")) == null ? void 0 : _c[0];
      const decodedString = decodeString(encryptedString) || link;
      console.log("decodedString", decodedString);
      link = safeAtob(decodedString == null ? void 0 : decodedString.o) || link;
      console.log("Decoded link", link);
      const redirectLink = yield getRedirectLinks(link, signal, headers);
      console.log("redirectLink", redirectLink);
      if (redirectLink.includes("hubcloud") || redirectLink.includes("/drive/")) {
        return yield hubcloudExtractor(redirectLink, signal, axios, cheerio, headers);
      }
      const redirectLinkRes = yield axios.get(redirectLink, { headers, signal });
      const redirectLinkText = redirectLinkRes.data;
      const $ = cheerio.load(redirectLinkText);
      hubdriveLink = $('h3:contains("1080p")').find("a").attr("href") || redirectLinkText.match(/href="(https:\/\/hubcloud\.[^\/]+\/drive\/[^"]+)"/)[1];
      if (hubdriveLink.includes("hubdrive")) {
        const hubdriveRes = yield axios.get(hubdriveLink, { headers, signal });
        const hubdriveText = hubdriveRes.data;
        const $$ = cheerio.load(hubdriveText);
        hubdriveLink = $$(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href") || hubdriveLink;
      }
    }
    const hubdriveLinkRes = yield axios.get(hubdriveLink, { headers, signal });
    const hubcloudText = hubdriveLinkRes.data;
    const hubcloudLink = ((_d = hubcloudText.match(/<META HTTP-EQUIV="refresh" content="0; url=([^"]+)">/i)) == null ? void 0 : _d[1]) || hubdriveLink;
    try {
      return yield hubcloudExtractor(hubcloudLink, signal, axios, cheerio, headers);
    } catch (error) {
      throwProviderError("4KHDHub", "stream", error);
    }
  });
}
__name(getStream, "getStream");
var encode = /* @__PURE__ */ __name(function(value) {
  return btoa(value.toString());
}, "encode");
var decode = /* @__PURE__ */ __name(function(value) {
  if (value === void 0) {
    return "";
  }
  return atob(value.toString());
}, "decode");
var pen = /* @__PURE__ */ __name(function(value) {
  return value.replace(/[a-zA-Z]/g, function(_0x1a470e) {
    return String.fromCharCode(
      (_0x1a470e <= "Z" ? 90 : 122) >= (_0x1a470e = _0x1a470e.charCodeAt(0) + 13) ? _0x1a470e : _0x1a470e - 26
    );
  });
}, "pen");
var abortableTimeout = /* @__PURE__ */ __name((ms, { signal } = {}) => {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      return reject(new Error("Aborted"));
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      });
    }
  });
}, "abortableTimeout");
function getRedirectLinks(link, signal, headers) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(link, { headers, signal });
      const resText = yield res.text();
      var regex = /ck\('_wp_http_\d+','([^']+)'/g;
      var combinedString = "";
      var match;
      while ((match = regex.exec(resText)) !== null) {
        combinedString += match[1];
      }
      const decodedString = decode(pen(decode(decode(combinedString))));
      const data = JSON.parse(decodedString);
      console.log(data);
      const token = encode(data == null ? void 0 : data.data);
      const blogLink = (data == null ? void 0 : data.wp_http1) + "?re=" + token;
      let wait = abortableTimeout((Number(data == null ? void 0 : data.total_time) + 3) * 1e3, {
        signal
      });
      yield wait;
      console.log("blogLink", blogLink);
      let vcloudLink = "Invalid Request";
      while (vcloudLink.includes("Invalid Request")) {
        const blogRes = yield fetch(blogLink, { headers, signal });
        const blogResText = yield blogRes.text();
        if (blogResText.includes("Invalid Request")) {
          console.log(blogResText);
        } else {
          vcloudLink = blogResText.match(/var reurl = "([^"]+)"/) || "";
          break;
        }
      }
      return blogLink || link;
    } catch (err) {
      console.log("Error in getRedirectLinks", err);
      return link;
    }
  });
}
__name(getRedirectLinks, "getRedirectLinks");
function rot13(str) {
  return str.replace(/[a-zA-Z]/g, function(char) {
    const charCode = char.charCodeAt(0);
    const isUpperCase = char <= "Z";
    const baseCharCode = isUpperCase ? 65 : 97;
    return String.fromCharCode((charCode - baseCharCode + 13) % 26 + baseCharCode);
  });
}
__name(rot13, "rot13");
var safeAtob = /* @__PURE__ */ __name((str) => {
  try {
    return atob(str);
  } catch (e) {
    return null;
  }
}, "safeAtob");
function decodeString(encryptedString) {
  try {
    let decoded = atob(encryptedString);
    decoded = atob(decoded);
    decoded = rot13(decoded);
    decoded = atob(decoded);
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error decoding string:", error);
    return null;
  }
}
__name(decodeString, "decodeString");
exports.decodeString = decodeString;
exports.getRedirectLinks = getRedirectLinks;
exports.getStream = getStream;
// Annotate the CommonJS export names for ESM import in node:

