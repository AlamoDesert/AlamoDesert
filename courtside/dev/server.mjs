// Lokaler Testserver: liefert public/ aus und beantwortet /api/* mit einem Speicher im Arbeitsspeicher.
// Start: node --experimental-strip-types dev/server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../netlify/functions/api/core.mts';
import { memoryStore } from './memory-store.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.argv[2]) || 8888;
const store = memoryStore();
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'
};

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith('/api/')) {
    const headers = Object.entries(req.headers).filter(([, v]) => typeof v === 'string');
    const payload = req.method === 'GET' || req.method === 'HEAD' ? undefined : await body(req);
    const r = await handle(new Request(url, { method: req.method, headers, body: payload }), store);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const file = normalize(join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Nicht gefunden');
  }
}).listen(port, () => console.log(`Courtside lokal: http://localhost:${port}`));
