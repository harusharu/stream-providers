// hono-api/node_modules/hono/dist/adapter/netlify/handler.js
var handle = (app2) => {
  return (req, context) => {
    return app2.fetch(req, { context });
  };
};

// hono-api/node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler2;
      if (middleware[i]) {
        handler2 = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler2 = i === middleware.length && next || void 0;
      }
      if (handler2) {
        try {
          res = await handler2(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// hono-api/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// hono-api/node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// hono-api/node_modules/hono/dist/utils/body.js
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// hono-api/node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str2, decoder) => {
  try {
    return decoder(str2);
  } catch {
    return str2.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str2) => tryDecode(str2, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str2) => str2.indexOf("%") !== -1 ? tryDecode(str2, decodeURIComponent_) : str2;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// hono-api/node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// hono-api/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str2, phase, preserveCallbacks, context, buffer) => {
  if (typeof str2 === "object" && !(str2 instanceof String)) {
    if (!(str2 instanceof Promise)) {
      str2 = str2.toString();
    }
    if (str2 instanceof Promise) {
      str2 = await str2;
    }
  }
  const callbacks = str2.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str2);
  }
  if (buffer) {
    buffer[0] += str2;
  } else {
    buffer = [str2];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str22) => resolveCallback(str22, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// hono-api/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// hono-api/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// hono-api/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// hono-api/node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler2) => {
          this.#addRoute(method, this.#path, handler2);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler2) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler2);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler2) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler2);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler2;
      if (app2.errorHandler === errorHandler) {
        handler2 = r.handler;
      } else {
        handler2 = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler2[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler2, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler2) => {
    this.errorHandler = handler2;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler2) => {
    this.#notFoundHandler = handler2;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler2 = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler2);
    return this;
  }
  #addRoute(method, path, handler2, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler: handler2
    };
    this.router.add(method, path, [handler2, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// hono-api/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// hono-api/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// hono-api/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// hono-api/node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler2) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler2, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler2, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler2, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (; paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length; i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length; k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// hono-api/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler2) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler2]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// hono-api/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler2, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler2) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler: handler2, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler2) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler: handler2,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler: handler2, params }) => [handler2, params])];
  }
};

// hono-api/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler2) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler2);
      }
      return;
    }
    this.#node.insert(method, path, handler2);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// hono-api/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// hono-api/node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "QUERY"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    } else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else {
      return () => "";
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (exposeHeadersStr) {
      set("Access-Control-Expose-Headers", exposeHeadersStr);
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) {
        set("Access-Control-Allow-Methods", allowMethods);
      }
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
        }
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// hono-api/lib/cache.ts
var TtlCache = class {
  store = /* @__PURE__ */ new Map();
  inflight = /* @__PURE__ */ new Map();
  ttlSecs;
  constructor(ttlSecs) {
    this.ttlSecs = ttlSecs;
  }
  now() {
    return Date.now();
  }
  purgeExpired() {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
  /** Look up a key, returning a clone of the cached value if present. */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return void 0;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return void 0;
    }
    return entry.value;
  }
  /** Store a value under a key. */
  set(key, value, ttlSecs) {
    const ttl = Math.max(1, ttlSecs ?? this.ttlSecs);
    this.store.set(key, { value, expiresAt: this.now() + ttl * 1e3 });
  }
  /**
   * Return the cached value or compute it via `loader`, caching the result.
   * Concurrent calls for the same key await the same in-flight computation.
   */
  async getOrSet(key, loader) {
    const cached3 = this.get(key);
    if (cached3 !== void 0) return cached3;
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }
    const promise = loader().then((value) => {
      this.set(key, value);
      return value;
    }).catch((err) => {
      throw err;
    }).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }
  /** Drop everything (used by tests and config reloads). */
  clear() {
    this.store.clear();
    this.inflight.clear();
  }
  get size() {
    this.purgeExpired();
    return this.store.size;
  }
};
var CacheBundle = class {
  catalog;
  search;
  meta;
  episodes;
  stream;
  searchAll;
  constructor(cfg) {
    this.catalog = new TtlCache(cfg.cacheCatalogSecs);
    this.search = new TtlCache(cfg.cacheSearchSecs);
    this.meta = new TtlCache(cfg.cacheMetaSecs);
    this.episodes = new TtlCache(cfg.cacheEpisodesSecs);
    this.stream = new TtlCache(cfg.cacheStreamSecs);
    this.searchAll = new TtlCache(cfg.cacheSearchSecs);
  }
  /** Build the canonical cache key for an endpoint/provider/params triple. */
  static key(endpoint, provider, params) {
    return `${endpoint}|${provider}|${JSON.stringify(params)}`;
  }
};

// hono-api/lib/config.ts
function int(value, fallback) {
  if (value === void 0) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
function str(value, fallback) {
  return value === void 0 || value.trim() === "" ? fallback : value;
}
function list(value) {
  if (value === void 0) return [];
  return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function parseMode(value) {
  const v = str(value, "auto").toLowerCase();
  return v === "always" || v === "never" ? v : "auto";
}
function parseLevel(value) {
  const v = str(value, "info").toLowerCase();
  return v === "debug" || v === "warn" || v === "error" ? v : "info";
}
function fromEnv(env = process.env) {
  const providersRoot = env.PROVIDERS_ROOT && env.PROVIDERS_ROOT.trim() !== "" ? env.PROVIDERS_ROOT.trim() : process.cwd();
  const callTimeoutMs = int(env.CALL_TIMEOUT_MS, 75e3);
  const workerTimeoutMs = int(env.WORKER_TIMEOUT_MS, 6e4);
  const searchAllTimeoutMs = int(env.SEARCH_ALL_TIMEOUT_MS, 2e4);
  return {
    providersRoot,
    defaultProvider: str(env.DEFAULT_PROVIDER, "vega"),
    callTimeoutMs,
    workerTimeoutMs,
    searchAllTimeoutMs,
    localConcurrency: Math.max(1, int(env.LOCAL_CONCURRENCY, 8)),
    localExecution: parseMode(env.LOCAL_EXECUTION),
    remoteGatewayHosts: list(env.REMOTE_GATEWAY_HOSTS),
    remoteTimeoutMs: int(env.REMOTE_TIMEOUT_MS, 75e3),
    remoteRetries: Math.max(0, int(env.REMOTE_RETRIES, 1)),
    rateLimitPerMin: int(env.RATE_LIMIT_PER_MIN, 600),
    rateLimitBurst: int(env.RATE_LIMIT_BURST, 120),
    cacheCatalogSecs: int(env.CACHE_CATALOG_SECS, 300),
    cacheSearchSecs: int(env.CACHE_SEARCH_SECS, 60),
    cacheMetaSecs: int(env.CACHE_META_SECS, 60),
    cacheEpisodesSecs: int(env.CACHE_EPISODES_SECS, 300),
    cacheStreamSecs: int(env.CACHE_STREAM_SECS, 30),
    corsOrigins: list(env.CORS_ORIGINS).length > 0 ? list(env.CORS_ORIGINS) : ["*"],
    logLevel: parseLevel(env.LOG_LEVEL),
    trustProxy: str(env.TRUST_PROXY, "true").toLowerCase() !== "false"
  };
}
function validate(config) {
  const problems = [];
  if (config.callTimeoutMs < 1) problems.push("CALL_TIMEOUT_MS must be >= 1");
  if (config.workerTimeoutMs < 1) problems.push("WORKER_TIMEOUT_MS must be >= 1");
  if (config.workerTimeoutMs >= config.callTimeoutMs)
    problems.push("WORKER_TIMEOUT_MS must be below CALL_TIMEOUT_MS");
  if (config.searchAllTimeoutMs < 1) problems.push("SEARCH_ALL_TIMEOUT_MS must be >= 1");
  if (config.searchAllTimeoutMs > config.workerTimeoutMs)
    problems.push("SEARCH_ALL_TIMEOUT_MS must not exceed WORKER_TIMEOUT_MS");
  if (config.rateLimitPerMin < 1) problems.push("RATE_LIMIT_PER_MIN must be >= 1");
  if (config.rateLimitBurst < 1) problems.push("RATE_LIMIT_BURST must be >= 1");
  if (config.defaultProvider.trim() === "") problems.push("DEFAULT_PROVIDER must not be empty");
  return problems;
}

// hono-api/lib/errors.ts
var ApiError = class _ApiError extends Error {
  status;
  code;
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
  /** An unknown/disabled provider id. */
  static providerNotFound(provider) {
    return new _ApiError(`unknown provider: ${provider}`, 400, "BAD_REQUEST");
  }
  /** A required query parameter was missing or empty. */
  static missingParam(name) {
    return new _ApiError(`missing required parameter: ${name}`, 400, "BAD_REQUEST");
  }
  /** A query parameter failed a constraint (e.g. too long). */
  static invalidParam(message) {
    return new _ApiError(message, 422, "INVALID_INPUT");
  }
  /** The provider execution engine itself failed (bundle, backend, or crash). */
  static worker(message) {
    return new _ApiError(`provider worker failed: ${message}`, 502, "UPSTREAM_ERROR");
  }
  /** The provider bundle raised an error while scraping an upstream host. */
  static upstream(status, message) {
    const code = "UPSTREAM_ERROR";
    const safeStatus = status >= 400 && status < 600 ? status : 502;
    return new _ApiError(
      `upstream provider error (HTTP ${safeStatus}): ${message}`,
      safeStatus,
      code
    );
  }
  /** A provider call exceeded the configured timeout. */
  static timeout() {
    return new _ApiError("provider request timed out", 504, "TIMEOUT");
  }
  /** An unexpected internal failure. */
  static internal(message) {
    return new _ApiError(`internal server error: ${message}`, 500, "ERROR");
  }
  /** Build an error with an arbitrary HTTP status and envelope code. */
  static from(message, status, code) {
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return new _ApiError(message, safeStatus, code);
  }
  /** Whether retrying the call on a different backend/host is likely to help. */
  get isTransient() {
    return this.status === 504 || // timeout
    this.status === 502 || // worker
    this.status >= 500;
  }
  /** Whether this error came from the provider itself rather than the gateway. */
  get isUpstream() {
    return this.status >= 400 && this.code === "UPSTREAM_ERROR";
  }
};
function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return ApiError.internal(err.message);
  return ApiError.internal(String(err));
}
function errorBody(err) {
  return { success: false, error: err.message, code: err.code };
}
function notFoundBody() {
  return { success: false, error: "not found", code: "NOT_FOUND" };
}

// hono-api/lib/gateway.ts
import { existsSync as existsSync3 } from "node:fs";
import { join as join3 } from "node:path";

// hono-api/lib/bundles.ts
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
function bundleExists(providersRoot, provider, module) {
  return existsSync(join(providersRoot, "dist", provider, `${module}.js`));
}
function bundlePath(providersRoot, provider, module) {
  return join(providersRoot, "dist", provider, `${module}.js`);
}
var bundleCache = /* @__PURE__ */ new Map();
function loadBundle(providersRoot, provider, module) {
  const key = `${provider}/${module}`;
  const cached3 = bundleCache.get(key);
  if (cached3) return cached3;
  const path = bundlePath(providersRoot, provider, module);
  if (!existsSync(path)) {
    throw ApiError.worker(`bundle not found: ${key} (expected ${path})`);
  }
  const requireFromRoot = createRequire(join(providersRoot, "package.json"));
  const mod = requireFromRoot(path);
  bundleCache.set(key, mod);
  return mod;
}
function buildArgs(module, fn, args, workerTimeoutMs) {
  const signal = abortSignalWithTimeout(workerTimeoutMs);
  switch (fn) {
    case "getPosts":
      return {
        filter: args.filter ?? "",
        page: Number(args.page ?? 1),
        providerValue: args.providerValue ?? "",
        signal
      };
    case "getSearchPosts":
      return {
        searchQuery: args.searchQuery ?? "",
        page: Number(args.page ?? 1),
        providerValue: args.providerValue ?? "",
        signal
      };
    case "getMeta":
      return { link: args.link ?? "", providerValue: args.providerValue ?? "" };
    case "getEpisodes":
      return { url: args.url ?? "", providerValue: args.providerValue ?? "" };
    case "getStream":
      return { link: args.link ?? "", type: args.type ?? "movie", signal };
    default:
      throw ApiError.worker(`unsupported function: ${fn} in ${module}`);
  }
}
async function executeBundle(providersRoot, req) {
  const { provider, module, fn, args, signal, providerContext } = req;
  if (module === "catalog") {
    const mod2 = loadBundle(providersRoot, provider, module);
    const catalog2 = Array.isArray(mod2["catalog"]) ? mod2["catalog"] : [];
    const genres = Array.isArray(mod2["genres"]) ? mod2["genres"] : [];
    return [...catalog2, ...genres];
  }
  const mod = loadBundle(providersRoot, provider, module);
  const impl = mod[fn];
  if (typeof impl !== "function") {
    throw ApiError.worker(`no export ${fn}() in ${provider}/${module}.js`);
  }
  const callArgs = buildArgs(module, fn, args, req.workerTimeoutMs);
  callArgs.providerContext = providerContext;
  return impl(callArgs);
}
function abortSignalWithTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (typeof timer.unref === "function") timer.unref();
  return controller.signal;
}

// hono-api/lib/context.ts
import { existsSync as existsSync2, readFileSync } from "node:fs";
import { createRequire as createRequire2 } from "node:module";
import { join as join2 } from "node:path";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
var envLoaded = false;
function ensureRepoEnvLoaded(providersRoot) {
  if (envLoaded) return;
  envLoaded = true;
  const load = process.loadEnvFile;
  if (typeof load !== "function") return;
  for (const candidate of [join2(providersRoot, ".env"), join2(process.cwd(), ".env")]) {
    try {
      load(candidate);
    } catch {
    }
  }
}
function manifestUrl() {
  const fromEnv2 = process.env.URLS_MANIFEST_URL;
  return fromEnv2 && fromEnv2.trim() !== "" ? fromEnv2.trim() : "";
}
function resolveOptional(providersRoot, name) {
  const fromHere = createRequire2(import.meta.url);
  const fromRoot = createRequire2(join2(providersRoot, "package.json"));
  for (const req of [fromHere, fromRoot]) {
    try {
      return req(name);
    } catch {
    }
  }
  return void 0;
}
var localUrls = null;
function getLocalUrls(providersRoot) {
  if (localUrls !== null) return localUrls;
  const path = join2(providersRoot, "urls.json");
  try {
    localUrls = existsSync2(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  } catch {
    localUrls = {};
  }
  return localUrls;
}
function decompressBuffer(raw2, headers) {
  let encoding = "";
  if (headers && typeof headers === "object") {
    const h = headers;
    if (typeof h.get === "function") {
      encoding = String(
        h.get("content-encoding") ?? ""
      );
    } else {
      encoding = String(h["content-encoding"] ?? h["Content-Encoding"] ?? "");
    }
  }
  if (!encoding) return raw2;
  const enc = encoding.toLowerCase();
  try {
    if (enc.includes("br")) return brotliDecompressSync(raw2);
    if (enc.includes("gzip")) return gunzipSync(raw2);
    if (enc.includes("deflate")) return inflateSync(raw2);
  } catch {
  }
  return raw2;
}
function cffiHeaders(res) {
  return {
    get: (name) => res.headers[name.toLowerCase()],
    has: (name) => res.headers[name.toLowerCase()] !== void 0
  };
}
function headersEntries(h) {
  if (h instanceof Headers) {
    const out = [];
    h.forEach((value, key) => out.push([key, value]));
    return out;
  }
  return Object.entries(h);
}
function buildProviderContext(providersRoot) {
  const axios = resolveOptional(providersRoot, "axios");
  const cheerio = resolveOptional(providersRoot, "cheerio");
  const cffi = resolveOptional(providersRoot, "curl-cffi-node");
  if (!axios) throw new Error("axios is required for provider execution");
  if (!cheerio) throw new Error("cheerio is required for provider execution");
  const urls = getLocalUrls(providersRoot);
  ensureRepoEnvLoaded(providersRoot);
  const manifest = manifestUrl();
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (manifest !== "" && url === manifest) {
      try {
        const res2 = await nativeFetch(manifest, init);
        if (res2.ok) return res2;
        throw new Error(`urls.json fetch failed: HTTP ${res2.status}`);
      } catch (err) {
        console.warn(`[context] urls.json fetch failed, using local copy: ${String(err)}`);
        return new Response(JSON.stringify(urls), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (!cffi) {
      return nativeFetch(input, init);
    }
    const method = (init?.method ?? "get").toLowerCase();
    const reqHeaders = {};
    if (init?.headers) {
      for (const [key, value] of headersEntries(init.headers)) {
        if (key.toLowerCase() === "accept-encoding") continue;
        if (value !== void 0 && value !== null) reqHeaders[key] = String(value);
      }
    }
    const res = await cffi.get(url, {
      headers: reqHeaders,
      data: init?.body,
      impersonate: "chrome120",
      verify: false,
      allowRedirects: init?.redirect === "manual" ? false : true
    });
    const decoded = decompressBuffer(res.buffer(), res.headers);
    const text = decoded.toString("utf8");
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      url: res.url ?? url,
      headers: cffiHeaders(res),
      text: () => Promise.resolve(text),
      json: () => Promise.resolve(JSON.parse(text)),
      buffer: () => Promise.resolve(decoded),
      arrayBuffer: () => Promise.resolve(decoded.buffer)
    };
  };
  if (cffi) {
    const adapter = async (config) => {
      const method = (config.method ?? "get").toLowerCase();
      let url = config.url ?? "";
      if (config.baseURL && !url.startsWith("http")) url = config.baseURL + url;
      const reqHeaders = {};
      if (config.headers) {
        for (const [key, value] of Object.entries(config.headers)) {
          if (key.toLowerCase() === "accept-encoding") continue;
          if (value !== void 0 && value !== null) reqHeaders[key] = String(value);
        }
      }
      const fn = cffi[method] ?? cffi.get;
      const res = await fn(url, {
        headers: reqHeaders,
        data: config.data,
        impersonate: "chrome120",
        verify: false,
        allowRedirects: config.maxRedirects !== 0
      });
      const decoded = decompressBuffer(res.buffer(), res.headers);
      const contentType = cffiHeaders(res).get("content-type") ?? "";
      let data;
      if (config.responseType === "arraybuffer" || config.responseType === "stream") {
        data = decoded;
      } else {
        data = decoded.toString("utf8");
        if (config.responseType === "json" || contentType.includes("application/json")) {
          try {
            data = JSON.parse(data);
          } catch {
          }
        }
      }
      return {
        data,
        status: res.status,
        statusText: "OK",
        headers: cffiHeaders(res),
        config,
        request: {}
      };
    };
    axios.defaults.adapter = adapter;
  }
  const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9"
  };
  return {
    axios,
    cheerio,
    Aes: null,
    commonHeaders
  };
}

// hono-api/lib/model.ts
function normalizeProvider(raw2, fallback) {
  const trimmed = (raw2 ?? "").trim();
  return trimmed === "" ? fallback : trimmed;
}
function requireNonEmpty(value, name, maxLen) {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") throw ApiError.missingParam(name);
  if (trimmed.length > maxLen) {
    throw ApiError.invalidParam(`${name} exceeds ${maxLen} characters`);
  }
  return trimmed;
}
function parsePage(value) {
  const n = value === void 0 || value === null ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
function streamType(raw2) {
  const v = (raw2 ?? "").trim().toLowerCase();
  if (v === "series" || v === "tv" || v === "show") return "series";
  return "movie";
}
function isSeriesMarker(hay) {
  const MARKERS = [
    "season",
    "episode",
    "web-series",
    "web series",
    "netflix series",
    "complete series",
    "tv show",
    "s01e"
  ];
  if (MARKERS.some((m) => hay.includes(m))) return true;
  return /s\d+e\d+/.test(hay);
}
function inferType(link, title) {
  const linkLower = link.toLowerCase();
  if (linkLower.includes("/movie/")) return "movie";
  if (linkLower.includes("/tv/") || linkLower.includes("/series/") || linkLower.includes("/show/")) {
    return "series";
  }
  const hay = `${linkLower} ${title.toLowerCase()}`;
  return isSeriesMarker(hay) ? "series" : "movie";
}
function applyTypeHints(data) {
  if (!Array.isArray(data)) return data;
  return data.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
    const obj = item;
    if (obj["type"] !== void 0) return obj;
    const link = typeof obj["link"] === "string" ? obj["link"] : "";
    const title = typeof obj["title"] === "string" ? obj["title"] : "";
    return { ...obj, type: inferType(link, title) };
  });
}

// hono-api/lib/remote.ts
var COOLDOWN_MS = 3e4;
var MAX_CONSECUTIVE_FAILURES = 2;
function fromRemoteEnvelope(envelope, httpStatus) {
  const code = envelope.code ?? "UPSTREAM_ERROR";
  const message = envelope.error ?? "remote gateway error";
  switch (code) {
    case "BAD_REQUEST":
      return ApiError.from(message, 400, "BAD_REQUEST");
    case "INVALID_INPUT":
      return ApiError.from(message, 422, "INVALID_INPUT");
    case "RATE_LIMITED":
      return ApiError.from(message, 429, "RATE_LIMITED");
    case "TIMEOUT":
      return ApiError.timeout();
    case "NOT_FOUND":
      return ApiError.from(message, 404, "NOT_FOUND");
    case "UPSTREAM_ERROR":
      return ApiError.upstream(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502, message);
    default:
      return ApiError.upstream(httpStatus, message);
  }
}
var RemoteGateway = class {
  hosts;
  timeoutMs;
  cursor = 0;
  constructor(baseUrls, timeoutMs) {
    this.timeoutMs = timeoutMs;
    this.hosts = baseUrls.map((url) => url.replace(/\/+$/, "")).map((baseUrl) => ({ baseUrl, cooldownUntil: 0, consecutiveFailures: 0 }));
  }
  get available() {
    return this.hosts.some((h) => h.cooldownUntil <= Date.now());
  }
  get hostCount() {
    return this.hosts.length;
  }
  /** True when at least one host is currently healthy. */
  healthy() {
    return this.available;
  }
  nextHost() {
    const now = Date.now();
    for (let i = 0; i < this.hosts.length; i++) {
      const idx = (this.cursor + i) % this.hosts.length;
      const host = this.hosts[idx];
      if (host.cooldownUntil <= now) {
        this.cursor = (idx + 1) % this.hosts.length;
        return host;
      }
    }
    return void 0;
  }
  markFailure(host) {
    host.consecutiveFailures += 1;
    if (host.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      host.cooldownUntil = Date.now() + COOLDOWN_MS;
    }
  }
  markSuccess(host) {
    host.consecutiveFailures = 0;
    host.cooldownUntil = 0;
  }
  /**
   * Perform `fn` against each host in turn (skipping quarantined hosts) until
   * one succeeds. `fn` returns the raw data; transient failures move to the
   * next host. Non-transient errors (validation, not-found) fail fast.
   */
  async withFailover(fn) {
    const attempts = /* @__PURE__ */ new Set();
    let lastError = null;
    for (; ; ) {
      const host = this.nextHost();
      if (!host || attempts.has(host)) break;
      attempts.add(host);
      try {
        const value = await fn(host);
        this.markSuccess(host);
        return value;
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : ApiError.worker(String(err));
        lastError = apiErr;
        if (!apiErr.isTransient) throw apiErr;
        this.markFailure(host);
      }
    }
    throw lastError ?? ApiError.worker("no remote gateway host available");
  }
  /** Proxy a single provider call to the matching remote endpoint. */
  async call(req) {
    const { provider, module, fn, args, timeoutMs } = req;
    const spec = ENDPOINT_MAP[`${module}/${fn}`];
    if (!spec) throw ApiError.worker(`unsupported remote call: ${module}/${fn}`);
    const params = { provider };
    for (const [key, value] of Object.entries(spec.params(args))) {
      if (value !== void 0 && value !== null && String(value) !== "")
        params[key] = String(value);
    }
    const query = new URLSearchParams(params).toString();
    const path = query ? `${spec.path}?${query}` : spec.path;
    return this.withFailover((host) => this.httpGet(host, path, timeoutMs).then((data) => data));
  }
  /** Proxy an aggregated search to the remote `/api/search-all`. */
  async searchAll(query, page, providers2, timeoutMs) {
    const params = new URLSearchParams({ query, page: String(page) });
    if (providers2.length > 0) params.set("providers", providers2.join(","));
    const envelope = await this.withFailover(
      (host) => this.httpGetEnvelope(host, `/api/search-all?${params.toString()}`, timeoutMs)
    );
    const data = envelope.data ?? [];
    return {
      data: Array.isArray(data) ? data : [],
      total: typeof envelope.data === "object" && envelope.data !== null && "total" in envelope.data ? Number(envelope.data["total"] ?? 0) : 0,
      providers: typeof envelope.data === "object" && envelope.data !== null && "providers" in envelope.data ? Number(envelope.data["providers"] ?? 0) : 0,
      failed: typeof envelope.data === "object" && envelope.data !== null && "failed" in envelope.data ? Number(envelope.data["failed"] ?? 0) : 0
    };
  }
  async httpGetEnvelope(host, path, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${host.baseUrl}${path}`, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      let body;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok) {
        const env2 = body ?? {};
        throw fromRemoteEnvelope(env2, res.status);
      }
      const env = body ?? {};
      if (!env.success) throw fromRemoteEnvelope(env, res.status || 502);
      return env;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") throw ApiError.timeout();
      throw ApiError.worker(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  async httpGet(host, path, timeoutMs) {
    const envelope = await this.httpGetEnvelope(host, path, timeoutMs);
    return envelope.data;
  }
};
var ENDPOINT_MAP = {
  "catalog/catalog": {
    path: "/api/catalog",
    params: () => ({})
  },
  "posts/getSearchPosts": {
    path: "/api/search",
    params: (args) => ({ query: args.searchQuery, page: args.page })
  },
  "meta/getMeta": {
    path: "/api/meta",
    params: (args) => ({ link: args.link })
  },
  "episodes/getEpisodes": {
    path: "/api/episodes",
    params: (args) => ({ url: args.url })
  },
  "stream/getStream": {
    path: "/api/stream",
    params: (args) => ({ link: args.link, type: args.type })
  }
};

// hono-api/lib/gateway.ts
var Semaphore = class {
  active = 0;
  waiters = [];
  limit;
  constructor(limit) {
    this.limit = limit;
  }
  async acquire() {
    if (this.active < this.limit) {
      this.active += 1;
      return () => {
        this.active -= 1;
        this.waiters.shift()?.();
      };
    }
    await new Promise((resolve) => this.waiters.push(resolve));
    return this.acquire();
  }
};
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(ApiError.timeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
function abortSignal(ms) {
  return abortSignalWithTimeout(ms);
}
var Gateway = class {
  remote;
  semaphore;
  contextPromise = null;
  config;
  registry;
  constructor(config, registry) {
    this.config = config;
    this.registry = registry;
    this.semaphore = new Semaphore(config.localConcurrency);
    this.remote = config.remoteGatewayHosts.length > 0 ? new RemoteGateway(config.remoteGatewayHosts, config.remoteTimeoutMs) : null;
  }
  getProviderContext() {
    if (!this.contextPromise) {
      this.contextPromise = Promise.resolve().then(
        () => buildProviderContext(this.config.providersRoot)
      );
    }
    return this.contextPromise;
  }
  /** Whether the requested bundle can run in-process. */
  canExecuteLocally(provider, module) {
    if (this.config.localExecution === "never") return false;
    if (this.config.localExecution === "always") return true;
    return bundleExists(this.config.providersRoot, provider, module);
  }
  /**
   * Execute one provider call. Local-first, remote fallback on transient
   * failure or when the bundle is missing.
   */
  async call(req) {
    const canLocal = this.canExecuteLocally(req.provider, req.module);
    if (canLocal) {
      try {
        return await this.callLocal(req);
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : ApiError.upstream(502, err instanceof Error ? err.message : String(err));
        if (!this.remote || !apiErr.isTransient) throw apiErr;
      }
    }
    if (this.remote) {
      return this.remote.call({ ...req, timeoutMs: req.timeoutMs ?? this.config.callTimeoutMs });
    }
    throw ApiError.worker(
      `bundle not found: ${req.provider}/${req.module}.js (build with npm run build or configure REMOTE_GATEWAY_HOSTS)`
    );
  }
  async callLocal(req) {
    const providerContext = await this.getProviderContext();
    const release = await this.semaphore.acquire();
    const timeoutMs = req.timeoutMs ?? this.config.callTimeoutMs;
    try {
      const signal = abortSignal(this.config.workerTimeoutMs);
      return await withTimeout(
        executeBundle(this.config.providersRoot, {
          provider: req.provider,
          module: req.module,
          fn: req.fn,
          args: req.args,
          signal,
          providerContext,
          workerTimeoutMs: this.config.workerTimeoutMs
        }),
        timeoutMs
      );
    } finally {
      release();
    }
  }
  /**
   * Aggregated search across the requested providers (or every enabled one).
   * Fans out concurrently, tolerates slow/failing providers, dedupes by
   * `provider|title|link`, and tags each item with `provider`/`providerName`.
   * Each provider call is bounded by `SEARCH_ALL_TIMEOUT_MS` so a hung host
   * is cut from the response without stalling the search bar.
   */
  async searchAll(query, page, providers2) {
    const selected = this.selectEntries(providers2);
    if (selected.length === 0) throw ApiError.providerNotFound(providers2.join(","));
    const seen = /* @__PURE__ */ new Set();
    const data = [];
    let failed = 0;
    const results = await Promise.allSettled(
      selected.map(
        (entry) => this.call({
          provider: entry.value,
          module: "posts",
          fn: "getSearchPosts",
          args: { searchQuery: query, page, providerValue: entry.value },
          timeoutMs: this.config.searchAllTimeoutMs
        })
      )
    );
    results.forEach((outcome, idx) => {
      const entry = selected[idx];
      if (outcome.status === "rejected") {
        failed += 1;
        return;
      }
      const typed = applyTypeHints(outcome.value);
      if (!Array.isArray(typed)) {
        failed += 1;
        return;
      }
      for (const rawItem of typed) {
        if (rawItem === null || typeof rawItem !== "object") continue;
        const title = typeof rawItem["title"] === "string" ? rawItem["title"] : "";
        const link = typeof rawItem["link"] === "string" ? rawItem["link"] : "";
        const key = `${entry.value}|${title}|${link}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const type = typeof rawItem["type"] === "string" ? rawItem["type"] : inferType(link, title);
        data.push({
          ...rawItem,
          type,
          provider: entry.value,
          providerName: entry.display_name
        });
      }
    });
    return { data, total: data.length, providers: selected.length, failed };
  }
  selectEntries(requested) {
    const all = this.registry.entries.map((e) => ({
      value: e.value,
      display_name: e.display_name
    }));
    if (requested.length === 0) return all;
    const wanted = new Set(requested);
    return all.filter((e) => wanted.has(e.value));
  }
  /** True when at least one execution path is usable (for `/health`). */
  async healthy() {
    if (this.config.localExecution === "never") return this.remote?.healthy() ?? false;
    if (existsSync3(join3(this.config.providersRoot, "dist"))) return true;
    return this.remote?.healthy() ?? false;
  }
};

// hono-api/lib/handlers/helpers.ts
function state(c) {
  return c.get("state");
}
function resolveProvider(c, raw2) {
  const { registry, config } = state(c);
  const provider = normalizeProvider(raw2, config.defaultProvider);
  if (!registry.contains(provider)) {
    throw ApiError.providerNotFound(provider);
  }
  return provider;
}
function cached(c, data, ttlSecs) {
  c.header("Cache-Control", `public, max-age=${ttlSecs}`);
  return c.json({ success: true, data });
}

// hono-api/lib/handlers/catalog.ts
async function catalog(c) {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query("provider"));
  const key = CacheBundle.key("catalog", provider, {});
  const ttl = caches.catalog.ttlSecs;
  const data = await caches.catalog.getOrSet(
    key,
    () => gateway.call({ provider, module: "catalog", fn: "catalog", args: {} })
  );
  return cached(c, data, ttl);
}

// hono-api/lib/handlers/episodes.ts
async function episodes(c) {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query("provider"));
  const url = requireNonEmpty(c.req.query("url"), "url", 2e3);
  const params = { url, providerValue: provider };
  const key = CacheBundle.key("episodes", provider, params);
  const ttl = caches.episodes.ttlSecs;
  const data = await caches.episodes.getOrSet(
    key,
    () => gateway.call({ provider, module: "episodes", fn: "getEpisodes", args: params })
  );
  return cached(c, data, ttl);
}

// hono-api/lib/handlers/meta.ts
async function meta(c) {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query("provider"));
  const link = requireNonEmpty(c.req.query("link"), "link", 2e3);
  const params = { link, providerValue: provider };
  const key = CacheBundle.key("meta", provider, params);
  const ttl = caches.meta.ttlSecs;
  const data = await caches.meta.getOrSet(
    key,
    () => gateway.call({ provider, module: "meta", fn: "getMeta", args: params })
  );
  return cached(c, data, ttl);
}

// hono-api/lib/handlers/search.ts
async function search(c) {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query("provider"));
  const query = requireNonEmpty(c.req.query("query"), "query", 200);
  const page = parsePage(c.req.query("page"));
  const params = { searchQuery: query, page, providerValue: provider };
  const key = CacheBundle.key("search", provider, params);
  const ttl = caches.search.ttlSecs;
  const raw2 = await caches.search.getOrSet(
    key,
    () => gateway.call({ provider, module: "posts", fn: "getSearchPosts", args: params })
  );
  return cached(c, applyTypeHints(raw2), ttl);
}

// hono-api/lib/handlers/search-all.ts
function parseProviders(raw2) {
  if (raw2 === void 0) return [];
  return raw2.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
async function searchAll(c) {
  const { gateway, caches, config } = state(c);
  const query = requireNonEmpty(c.req.query("query"), "query", 200);
  const page = parsePage(c.req.query("page"));
  const requested = parseProviders(c.req.query("providers"));
  const key = CacheBundle.key("search-all", requested.length > 0 ? requested.join(",") : "all", {
    query,
    page
  });
  const ttl = caches.searchAll.ttlSecs;
  const result = await caches.searchAll.getOrSet(
    key,
    () => gateway.searchAll(query, page, requested)
  );
  const { data, total, providers: providers2, failed } = result;
  c.header("Cache-Control", `public, max-age=${ttl}`);
  return c.json({ success: true, data: { success: true, data, total, providers: providers2, failed } });
}

// hono-api/lib/handlers/stream.ts
async function stream(c) {
  const { gateway, caches } = state(c);
  const provider = resolveProvider(c, c.req.query("provider"));
  const link = requireNonEmpty(c.req.query("link"), "link", 2e3);
  const type = streamType(c.req.query("type"));
  const params = { link, type, providerValue: provider };
  const key = CacheBundle.key("stream", provider, params);
  const ttl = caches.stream.ttlSecs;
  const data = await caches.stream.getOrSet(
    key,
    () => gateway.call({ provider, module: "stream", fn: "getStream", args: params })
  );
  return cached(c, data, ttl);
}

// hono-api/lib/handlers/system.ts
import { existsSync as existsSync4, readFileSync as readFileSync2 } from "node:fs";
import { join as join4 } from "node:path";
async function health(c) {
  const { gateway, registry } = state(c);
  const workersOk = await gateway.healthy();
  return c.json({
    status: workersOk ? "healthy" : "degraded",
    providers: registry.size,
    workers_ok: workersOk
  });
}
function info(c) {
  const { registry } = state(c);
  return c.json({
    name: "stream-api",
    version: "1.0.0",
    status: "running",
    providers: registry.values(),
    endpoints: [
      "GET /api/catalog?provider=",
      "GET /api/search?provider=&query=&page=",
      "GET /api/search-all?query=&page=&providers=",
      "GET /api/meta?provider=&link=",
      "GET /api/episodes?provider=&url=",
      "GET /api/stream?provider=&link=&type=",
      "GET /health",
      "GET /providers",
      "GET /urls.json"
    ]
  });
}
function providers(c) {
  const { registry } = state(c);
  return c.json({ providers: registry.entries });
}
function apiProviders(c) {
  const { registry } = state(c);
  return c.json({ success: true, data: registry.entries });
}
function dashboard(c) {
  const { registry, config } = state(c);
  const html = tryReadDashboard(config.providersRoot);
  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(
    html ?? `<!doctype html><html><head><meta charset="utf-8"><title>stream-api</title></head>
<body><h1>stream-api</h1><p>Node.js provider gateway (Hono).</p>
<p>Providers: <code>${registry.values().join(", ")}</code></p>
<p><a href="/health">/health</a> \xB7 <a href="/providers">/providers</a> \xB7 <a href="/info">/info</a></p>
</body></html>`
  );
}
function urlsManifest(c) {
  const { config } = state(c);
  const path = join4(config.providersRoot, "urls.json");
  try {
    if (!existsSync4(path)) {
      return c.json(notFoundBody(), 404);
    }
    const data = JSON.parse(readFileSync2(path, "utf8"));
    c.header("Cache-Control", "public, max-age=300");
    return c.json(data);
  } catch {
    return c.json(notFoundBody(), 404);
  }
}
function tryReadDashboard(providersRoot) {
  const path = join4(providersRoot, "static", "index.html");
  try {
    if (existsSync4(path)) return readFileSync2(path, "utf8");
  } catch {
  }
  return null;
}

// hono-api/lib/providers.ts
import { existsSync as existsSync5, readFileSync as readFileSync3 } from "node:fs";
import { join as join5 } from "node:path";
var STATIC_PROVIDERS = [
  {
    value: "torrentio",
    display_name: "Torrentio",
    version: "1.12",
    type: "global",
    disabled: false
  },
  { value: "vega", display_name: "VMovies", version: "2.27", type: "global", disabled: false },
  {
    value: "movieBoxWeb",
    display_name: "MovieBox Web",
    version: "1.4",
    type: "global",
    disabled: false
  },
  {
    value: "cinefreak",
    display_name: "CineFreak",
    version: "1.1",
    type: "global",
    disabled: false
  },
  {
    value: "eonMovies",
    display_name: "EonMovies",
    version: "1.6",
    type: "global",
    disabled: false
  },
  { value: "4khdhub", display_name: "4khdHub", version: "2.10", type: "global", disabled: false },
  { value: "showbox", display_name: "ShowBox", version: "1.5", type: "english", disabled: false },
  { value: "kmMovies", display_name: "KmMovies", version: "2.14", type: "global", disabled: false },
  { value: "movies4u", display_name: "Movies4U", version: "1.18", type: "global", disabled: false }
];
function loadFromManifest(providersRoot) {
  const path = join5(providersRoot, "manifest.json");
  if (!existsSync5(path)) return [];
  let raw2;
  try {
    raw2 = JSON.parse(readFileSync3(path, "utf8"));
  } catch {
    return [];
  }
  if (!Array.isArray(raw2)) return [];
  const entries = [];
  for (const item of raw2) {
    const value = item.value ?? "";
    if (value === "" || item.disabled) continue;
    entries.push({
      value,
      display_name: item.display_name || value,
      version: item.version,
      disabled: false,
      type: item.type
    });
  }
  return entries;
}
var ProviderRegistry = class _ProviderRegistry {
  byValue = /* @__PURE__ */ new Map();
  entries;
  constructor(entries) {
    this.entries = entries;
    for (const e of entries) this.byValue.set(e.value, e);
  }
  static load(providersRoot) {
    const fromManifest = loadFromManifest(providersRoot);
    return new _ProviderRegistry(fromManifest.length > 0 ? fromManifest : STATIC_PROVIDERS);
  }
  contains(value) {
    return this.byValue.has(value);
  }
  get(value) {
    return this.byValue.get(value);
  }
  values() {
    return this.entries.map((e) => e.value);
  }
  get size() {
    return this.entries.length;
  }
};

// hono-api/lib/rate-limit.ts
var RateLimiter = class {
  buckets = /* @__PURE__ */ new Map();
  perMin;
  burst;
  constructor(perMin, burst) {
    this.perMin = perMin;
    this.burst = burst;
  }
  now() {
    return Date.now();
  }
  /**
   * Try to take one token for `key`. Returns `true` when allowed, or a
   * `Retry-After`-compatible seconds value (false-like guard) when denied.
   */
  allow(key) {
    const windowMs = 6e4;
    const capacity = Math.max(this.perMin, this.burst);
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= capacity) {
      const retryAfterSecs = Math.ceil((bucket.windowStart + windowMs - now) / 1e3);
      return Math.max(1, retryAfterSecs);
    }
    bucket.count += 1;
    return true;
  }
  /** Drop expired buckets so the Map can't grow unboundedly. */
  sweep(now = this.now()) {
    const cutoff = now - 6e4;
    for (const [key, bucket] of this.buckets) {
      if (bucket.windowStart < cutoff) this.buckets.delete(key);
    }
  }
  get size() {
    return this.buckets.size;
  }
};

// hono-api/lib/security.ts
import { randomBytes } from "node:crypto";
var REQUEST_ID_HEADER = "x-request-id";
var SECURITY_HEADERS = [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "no-referrer"],
  ["content-security-policy", "default-src 'none'; frame-ancestors 'none'"]
];
var EXEMPT_PATHS = /* @__PURE__ */ new Set(["/health", "/", "/providers", "/info"]);
function getClientIp(c, trustProxy) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const cf = c.req.header("cf-connecting-ip");
  if (cf && trustProxy) return cf.trim();
  const real = c.req.header("x-real-ip");
  if (real && trustProxy) return real.trim();
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
function newRequestId() {
  return randomBytes(6).toString("hex");
}
function securityMiddleware(config, limiter) {
  return async (c, next) => {
    const started = Date.now();
    const path = new URL(c.req.url).pathname;
    const requestId = c.req.header(REQUEST_ID_HEADER) ?? newRequestId();
    c.header(REQUEST_ID_HEADER, requestId);
    if (!EXEMPT_PATHS.has(path)) {
      const ip = getClientIp(c, config.trustProxy);
      const allowed = limiter.allow(ip);
      if (allowed !== true) {
        c.header("Retry-After", String(allowed));
        return c.json({ success: false, error: "rate limit exceeded", code: "RATE_LIMITED" }, 429);
      }
    }
    let status = 200;
    try {
      await next();
      status = c.res.status;
    } catch (err) {
      const maybe = err;
      status = typeof maybe.status === "number" ? maybe.status : 500;
      throw err;
    } finally {
      for (const [name, value] of SECURITY_HEADERS) {
        c.header(name, value);
      }
      const finalRequestId = c.res.headers.get(REQUEST_ID_HEADER) ?? requestId;
      console.info(
        JSON.stringify({
          request_id: finalRequestId,
          method: c.req.method,
          path,
          status,
          duration_ms: Date.now() - started
        })
      );
    }
  };
}

// hono-api/lib/app.ts
var singleton = null;
function loadState(config) {
  if (singleton) return singleton;
  const cfg = config ?? fromEnv();
  const problems = validate(cfg);
  for (const problem of problems) console.warn(`[config] ${problem}`);
  const registry = ProviderRegistry.load(cfg.providersRoot);
  singleton = {
    config: cfg,
    registry,
    gateway: new Gateway(cfg, registry),
    caches: new CacheBundle(cfg)
  };
  return singleton;
}
function buildCors(origins) {
  const allowAll = origins.includes("*");
  return cors({
    origin: allowAll ? "*" : (origin) => origin !== void 0 && origins.includes(origin) ? origin : void 0,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Accept", "Content-Type", REQUEST_ID_HEADER],
    maxAge: 3600
  });
}
function buildApp(state2 = loadState()) {
  const { config } = state2;
  const limiter = new RateLimiter(config.rateLimitPerMin, config.rateLimitBurst);
  const app2 = new Hono2();
  app2.use("*", async (c, next) => {
    c.set("state", state2);
    await next();
  });
  app2.use("*", corsHandler(state2));
  app2.use("*", securityMiddleware(config, limiter));
  app2.get("/health", health);
  app2.get("/info", info);
  app2.get("/providers", providers);
  app2.get("/api/providers", apiProviders);
  app2.get("/urls.json", urlsManifest);
  app2.get("/", dashboard);
  app2.get("/api/catalog", catalog);
  app2.get("/api/search", search);
  app2.get("/api/search-all", searchAll);
  app2.get("/api/meta", meta);
  app2.get("/api/episodes", episodes);
  app2.get("/api/stream", stream);
  app2.notFound((c) => c.json(notFoundBody(), 404));
  app2.onError((err, c) => {
    const apiErr = toApiError(err);
    const body = errorBody(apiErr);
    c.header("Cache-Control", "no-store");
    return c.json(body, apiErr.status);
  });
  return app2;
}
function corsHandler(state2) {
  return buildCors(state2.config.corsOrigins);
}

// hono-api/api.ts
var app = buildApp();
var handler = handle(app);

// hono-api/lib/adapters/vercel.ts
async function vercelHandler(req) {
  return app.fetch(req);
}
export {
  vercelHandler as default
};
