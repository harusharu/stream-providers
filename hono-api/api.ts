// Runtime entry: the built Hono app plus the Netlify handler.
//
// Netlify Functions v2 calls the exported `handler` with a standard
// `Request` and expects a `Response` — which is exactly the Hono adapter's
// signature, so no `@netlify/functions` dependency is required.
//
// For other hosts see `./adapters/vercel.ts` (Vercel) and
// `./adapters/node.ts` (plain Node server).

import { handle } from 'hono/netlify';
import { buildApp } from './lib/app.ts';

/** The fully-wired Hono app (built once per process, shared by all requests). */
export const app = buildApp();

/** Netlify Functions v2 handler. */
export const handler = handle(app);

/** Route every path (`/api/*`, `/health`, `/providers`, `/`) to this function. */
export const config = {
  path: '/*',
  preferStatic: true,
};

/** Netlify v2 default export: `(req, context) => Response`. */
export default handler;
