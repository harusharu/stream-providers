// Vercel entry bundler.
//
// @vercel/node's legacy builder transpiles TS per-file but does not rewrite
// explicit `.ts` import specifiers (this repo's native-Node-TS style), so the
// compiled lambda can't resolve `./lib/app.ts`. It also only ships statically
// traced deps, dropping axios/cheerio/curl-cffi-node (resolved via
// `createRequire` at runtime).
//
// This script bundles the Vercel adapter into one self-contained ESM file
// (all lib code + hono inlined). The dynamically-required runtime deps are
// shipped into the lambda via `includeFiles` in vercel.json
// (`netlify-functions/node_modules/**`).

const esbuild = require('esbuild');
const path = require('path');

const root = path.join(__dirname, '..');

esbuild
  .build({
    entryPoints: [path.join(root, 'netlify-functions', 'lib', 'adapters', 'vercel.ts')],
    outfile: path.join(root, 'netlify-functions', 'api.vercel.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'info',
  })
  .catch(() => process.exit(1));