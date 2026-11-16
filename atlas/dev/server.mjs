// Lokaler Testserver: liefert public/ aus und beantwortet /api/feed/* über denselben Proxy wie die Live-Seite.
// Start: node --experimental-strip-types dev/server.mjs [port]
// MOCK=1 ersetzt die echten Quellen durch erfundene Daten (für Tests ohne Internet).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxy } from '../proxy/core.mts';
import { mockFetch } from './mock.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.argv[2]) || 8890;
const mock = process.env.MOCK === '1';
const handle = createProxy({ fetch: mock ? mockFetch : globalThis.fetch.bind(globalThis), now: Date.now });
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.mjs': 'text/javascript; charset=utf-8'
};

/** Header aus public/_headers (Block „/*“) wie auf Cloudflare Pages mitsenden – so fällt lokal auf,
    wenn die Content-Security-Policy etwas blockiert. */
async function siteHeaders() {
  const out = {};
  let on = false;
  for (const line of (await readFile(join(root, '_headers'), 'utf8').catch(() => '')).split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) { on = line.trim() === '/*'; continue; }
    const i = line.indexOf(':');
    if (on && i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}
const HEADERS = await siteHeaders();

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = await handle(new Request(url, { method: req.method }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const file = normalize(join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root) || file === join(root, '_headers')) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { ...HEADERS, 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    const missing = e && e.code === 'ENOENT';
    res.writeHead(missing ? 404 : 500);
    res.end(missing ? 'Nicht gefunden' : String(e));
  }
}).listen(port, () => console.log(`Live Karten lokal${mock ? ' (Testdaten)' : ''}: http://localhost:${port}`));
