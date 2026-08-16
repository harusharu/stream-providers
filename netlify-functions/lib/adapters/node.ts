// Plain Node server adapter (zero extra dependencies).
//
//   npm run start        # serves on PORT (default 8787)
//
// Converts each `node:http` request into a standard `Request`, forwards it to
// the Hono app, and streams the `Response` back. Works for GET/HEAD/POST.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { app } from '../../api.ts';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

function toWebRequest(req: IncomingMessage): Request {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers(req.headers as Record<string, string>);
  const method = req.method ?? 'GET';
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers });
  }
  // Stream the body through for non-GET requests.
  return new Request(url, {
    method,
    headers,
    body: req as unknown as BodyInit,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

async function sendResponse(res: ServerResponse, webResponse: Response): Promise<void> {
  const headers: Record<string, string> = {};
  webResponse.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webResponse.status, headers);
  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
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

server.listen(PORT, HOST, () => {
  console.log(`stream-api listening on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('shutting down');
  server.close(() => process.exit(0));
});
