// Vercel adapter. Vercel Functions (and Next.js App Router route handlers)
// call the exported default with a standard `Request` and expect a `Response`.

import { app } from '../../api.ts';

/** Vercel function handler. */
export default async function vercelHandler(req: Request): Promise<Response> {
  return app.fetch(req);
}
