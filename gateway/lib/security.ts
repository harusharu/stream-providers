// Security middleware: request-id, rate limiting, security headers, logging.
//
// Mirrors the security middleware pattern: applied globally, in order:
// CORS, request ID, rate limiting, and security headers.
//
//   1. Generate/echo an `x-request-id` (12-char hex, or the client's value).
//   2. Enforce a per-IP rate limit (exempting `/`, `/health`, `/providers`, `/info`).
//   3. Log the request with `request_id`, method, path, status, duration.
//   4. Stamp security headers on the response.
//
import { randomBytes } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { RateLimiter } from './rate-limit.ts';

export const REQUEST_ID_HEADER = 'x-request-id';

const SECURITY_HEADERS: Array<[string, string]> = [
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'no-referrer'],
  ['content-security-policy', "default-src 'none'; frame-ancestors 'none'"],
];

/** Paths exempt from rate limiting (exempt list for in-process gateway). */
const EXEMPT_PATHS = new Set(['/health', '/', '/providers', '/info']);

/** Best-effort client IP from forwarding headers. */
export function getClientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = c.req.header('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/** Generate a 12-char hex request id. */
export function newRequestId(): string {
  return randomBytes(6).toString('hex');
}

/**
 * Build the global security middleware: request-id, rate limit, security
 * headers, and structured request logging. Runs for both successful and
 * failing responses (the `finally` block fires before Hono renders the
 * onError response, so headers/logging are always present).
 */
export function securityMiddleware(limiter: RateLimiter): MiddlewareHandler {
  return async (c, next) => {
    const started = Date.now();
    const path = new URL(c.req.url).pathname;
    const requestId = c.req.header(REQUEST_ID_HEADER) ?? newRequestId();
    c.header(REQUEST_ID_HEADER, requestId);

    if (!EXEMPT_PATHS.has(path)) {
      const ip = getClientIp(c);
      const allowed = limiter.allow(ip);
      if (allowed !== true) {
        c.header('Retry-After', String(allowed));
        return c.json({ success: false, error: 'rate limit exceeded', code: 'RATE_LIMITED' }, 429);
      }
    }

    let status = 200;
    try {
      await next();
      status = c.res.status;
    } catch (err) {
      const maybe = err as { status?: unknown };
      status = typeof maybe.status === 'number' ? maybe.status : 500;
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
          duration_ms: Date.now() - started,
        }),
      );
    }
  };
}
