import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { repoRoot } from './lib/bundles.ts';

if (!existsSync(join(repoRoot, 'dist'))) {
  console.log('No dist/ yet — building provider bundles…');
  const result = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const { buildApp } = await import('./lib/app.ts');
const app = buildApp();

function toWebRequest(req: IncomingMessage): Request {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers(req.headers as Record<string, string>);
  const method = req.method ?? 'GET';
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }
  return new Request(url, {
    method,
    headers,
    body: Readable.toWeb(req) as any,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

async function sendResponse(res: ServerResponse, webResponse: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  
  // Safely extract multiple Set-Cookie headers, as forEach would overwrite them
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      headers[key] = webResponse.headers.getSetCookie();
    } else {
      headers[key] = value;
    }
  });

  res.writeHead(webResponse.status, headers);
  
  if (webResponse.body) {
    // Use stream pipe for automatic backpressure and disconnect cleanup
    Readable.fromWeb(webResponse.body as any).pipe(res);
  } else {
    res.end();
  }
}

const server = createServer(async (req, res) => {
  try {
    const webResponse = await app.fetch(toWebRequest(req));
    await sendResponse(res, webResponse);
  } catch (err) {
    console.error('request failed:', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'internal error', code: 'ERROR' }));
  }
});

server.listen(8787, () => {
  console.log('API listening on http://localhost:8787');
});

function shutdown() {
  console.log('shutting down');
  server.close(() => process.exit(0));
  
  // Fallback if connections hang
  setTimeout(() => {
    console.error('Force closing connections after timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
