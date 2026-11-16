/* Cloudflare Pages Function: bindet den Proxy (proxy/core.mts) unter /api/feed/* an.
   Der Arbeitsspeicher-Cache gilt nur pro Worker-Instanz; damit alle Besucher eines Rechenzentrums
   dieselbe Upstream-Abfrage teilen, legt die Funktion Antworten zusätzlich für die TTL der Quelle
   in den Cloudflare-Cache. */
import { createProxy } from '../../../proxy/core.mts';

const handle = createProxy({ fetch: (input, init) => fetch(input, init), now: Date.now });

interface Ctx { request: Request; waitUntil(p: Promise<unknown>): void }

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const req = ctx.request;
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!cache || req.method !== 'GET') return handle(req);

  const key = new Request(req.url, { method: 'GET' });
  try {
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch { /* Cache nicht verfügbar → direkt abfragen */ }

  let res: Response;
  try {
    res = await handle(req);
  } catch (e) {
    // Unerwarteter Fehler im Proxy: als lesbare Antwort statt der nackten Cloudflare-Fehlerseite
    return new Response(JSON.stringify({ error: `Proxy-Fehler – ${e instanceof Error ? e.message : String(e)}` }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  // Eine 502 der Function ersetzt Cloudflare durch die eigene Fehlerseite („error code: 502“) – die Meldung des
  // Proxys ginge verloren. Als 503 bleibt sie lesbar.
  if (res.status === 502) return new Response(res.body, { status: 503, headers: res.headers });
  // core.mts gibt die TTL nur bei frischen Daten mit (stale → keine), Fehler werden nie zwischengespeichert.
  const ttl = /s-maxage=(\d+)/.exec(res.headers.get('x-feed-ttl') || '')?.[1];
  if (res.status === 200 && ttl) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('cache-control', `public, max-age=0, s-maxage=${ttl}`);
    ctx.waitUntil(cache.put(key, copy).catch(() => undefined));
  }
  return res;
};
