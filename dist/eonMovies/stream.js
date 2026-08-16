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

// providers/eonMovies/stream.ts
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

// providers/eonMovies/stream.ts
var dotflixProxyAction = "4020c531ae02b8be9927fed961160ff20b3f81aafa";
function getStreamQuality(label) {
  var _a;
  const resolution = Number((_a = label.match(/\b(\d{3,4})p\b/i)) == null ? void 0 : _a[1]);
  if (!resolution) return void 0;
  if (resolution >= 2160) return "2160";
  if (resolution >= 1080) return "1080";
  if (resolution >= 720) return "720";
  if (resolution >= 480) return "480";
  if (resolution >= 360) return "360";
  return void 0;
}
__name(getStreamQuality, "getStreamQuality");
function addQuality(streams, quality) {
  const resolvedQuality = quality || streams.reduce(
    (result, stream) => result || getStreamQuality(decodeURIComponent(stream.link)),
    void 0
  );
  return streams.map((stream) => __spreadProps(__spreadValues({}, stream), {
    server: resolvedQuality ? `${stream.server} ${resolvedQuality}p` : stream.server,
    quality: resolvedQuality
  }));
}
__name(addQuality, "addQuality");
function getDotflixUrl(data) {
  var _a;
  return ((_a = data.match(/https?:\/\/dotflix\.[^\s"'<>]+\/share\/[a-z\d]+/i)) == null ? void 0 : _a[0]) || "";
}
__name(getDotflixUrl, "getDotflixUrl");
function getDotflixSharingCode(value) {
  var _a;
  try {
    const url = new URL(value);
    if (!/^(?:www\.)?dotflix\./i.test(url.hostname)) return "";
    return ((_a = url.pathname.match(/^\/share\/([a-z\d]+)/i)) == null ? void 0 : _a[1]) || "";
  } catch (e) {
    return "";
  }
}
__name(getDotflixSharingCode, "getDotflixSharingCode");
function isHubcloudUrl(value) {
  try {
    return /(?:^|\.)hubcloud\./i.test(new URL(value).hostname);
  } catch (e) {
    return false;
  }
}
__name(isHubcloudUrl, "isHubcloudUrl");
function getDotflixRouterState(sharingCode) {
  return encodeURIComponent(
    JSON.stringify([
      "",
      {
        children: [
          "share",
          {
            children: [
              ["code", sharingCode, "d"],
              { children: ["__PAGE__", {}, null, null] },
              null,
              null
            ]
          },
          null,
          null
        ]
      },
      null,
      null,
      true
    ])
  );
}
__name(getDotflixRouterState, "getDotflixRouterState");
function getServerActionDownloadUrl(data) {
  if (typeof data !== "string") return "";
  for (const line of data.split(/\r?\n/)) {
    const value = line.slice(line.indexOf(":") + 1);
    try {
      const payload = JSON.parse(value);
      if ((payload == null ? void 0 : payload.success) && typeof payload.downloadUrl === "string") {
        return payload.downloadUrl;
      }
    } catch (e) {
      continue;
    }
  }
  return "";
}
__name(getServerActionDownloadUrl, "getServerActionDownloadUrl");
function followDownloadLink(link, signal, headers) {
  return __async(this, null, function* () {
    let currentUrl = link;
    for (let index = 0; index < 5; index += 1) {
      const response = yield fetch(currentUrl, {
        headers,
        signal,
        redirect: "manual"
      });
      const location = response.headers.get("location");
      if (location) {
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }
      if (!response.ok) {
        throw new Error(`EonMovies download redirect failed: ${response.status}`);
      }
      const data = yield response.text();
      const responseUrl = response.url || currentUrl;
      return {
        data,
        url: getDotflixSharingCode(responseUrl) ? responseUrl : getDotflixUrl(data) || responseUrl
      };
    }
    throw new Error("EonMovies download redirect chain exceeded the limit");
  });
}
__name(followDownloadLink, "followDownloadLink");
function extractDotflixStream(link, signal, headers, providerContext) {
  return __async(this, null, function* () {
    const sharingCode = getDotflixSharingCode(link);
    if (!sharingCode) return [];
    const origin = new URL(link).origin;
    const requestHeaders = __spreadProps(__spreadValues({}, headers), { Origin: origin, Referer: link });
    const [directResult, proxyResult] = yield Promise.allSettled([
      providerContext.axios.post(
        `${origin}/api/extract-download`,
        { sharingCode },
        {
          signal,
          headers: __spreadProps(__spreadValues({}, requestHeaders), {
            "Content-Type": "application/json"
          })
        }
      ),
      providerContext.axios.post(link, JSON.stringify([sharingCode]), {
        signal,
        headers: __spreadProps(__spreadValues({}, requestHeaders), {
          Accept: "text/x-component",
          "Content-Type": "text/plain;charset=UTF-8",
          "Next-Action": dotflixProxyAction,
          "Next-Router-State-Tree": getDotflixRouterState(sharingCode)
        })
      })
    ]);
    const streams = [];
    if (directResult.status === "fulfilled") {
      const data = directResult.value.data;
      if ((data == null ? void 0 : data.success) && typeof data.downloadUrl === "string") {
        streams.push({ server: "Dotflix", link: data.downloadUrl, type: "mkv" });
      }
    }
    if (proxyResult.status === "fulfilled") {
      const proxyUrl = getServerActionDownloadUrl(proxyResult.value.data);
      if (proxyUrl && !streams.some((stream) => stream.link === proxyUrl)) {
        streams.push({ server: "Dotflix Proxy", link: proxyUrl, type: "mkv" });
      }
    }
    if (!streams.length) {
      throw new Error("Dotflix did not return a direct or proxy download URL");
    }
    return streams;
  });
}
__name(extractDotflixStream, "extractDotflixStream");
function extractDownloadStreams(link, signal, headers, providerContext) {
  return __async(this, null, function* () {
    if (getDotflixSharingCode(link)) {
      return extractDotflixStream(link, signal, headers, providerContext);
    }
    if (isHubcloudUrl(link)) {
      return hubcloudExtractor(link, signal, providerContext.axios, providerContext.cheerio, __spreadValues({}, headers));
    }
    return [];
  });
}
__name(extractDownloadStreams, "extractDownloadStreams");
function getStream(_0) {
  return __async(this, arguments, function* ({
    link,
    signal,
    providerContext
  }) {
    const headers = __spreadValues({}, providerContext.commonHeaders);
    const page = yield followDownloadLink(link, signal, headers);
    if (getDotflixSharingCode(page.url) || isHubcloudUrl(page.url)) {
      const streams2 = yield extractDownloadStreams(page.url, signal, headers, providerContext);
      return addQuality(streams2);
    }
    const $ = providerContext.cheerio.load(page.data);
    const downloadLinks = $(".dl-row a[href*='/dl/']").map((_, element) => {
      const anchor = $(element);
      const row = anchor.closest(".dl-row");
      const label = row.attr("data-dlname") || row.find(".dl-row-name").text().replace(/\s+/g, " ").trim();
      return {
        link: new URL(anchor.attr("href") || "", page.url).href,
        quality: getStreamQuality(label)
      };
    }).get();
    if (!downloadLinks.length) {
      throw new Error(`EonMovies did not redirect to Dotflix or HubCloud: ${page.url}`);
    }
    const streams = [];
    const seen = /* @__PURE__ */ new Set();
    for (const downloadLink of downloadLinks) {
      const downloadPage = yield followDownloadLink(downloadLink.link, signal, headers);
      if (!getDotflixSharingCode(downloadPage.url) && !isHubcloudUrl(downloadPage.url)) {
        continue;
      }
      const extracted = yield extractDownloadStreams(
        downloadPage.url,
        signal,
        headers,
        providerContext
      );
      addQuality(extracted, downloadLink.quality).forEach((stream) => {
        if (!seen.has(stream.link)) {
          seen.add(stream.link);
          streams.push(stream);
        }
      });
    }
    return streams;
  });
}
__name(getStream, "getStream");
exports.getStream = getStream;
// Annotate the CommonJS export names for ESM import in node:

