import { handle } from 'hono/vercel';
import { buildApp } from '../gateway/lib/app.ts';

const app = buildApp();

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
