/* Live Karten – Proxy-Logik mit austauschbarem fetch und Uhr (Tests, Dev-Server, Cloudflare Pages).
   GET /api/feed/<quelle>?<parameter> → { source, at, stale, features } */
import { SOURCES, ParamError, type Feature } from './sources.mts';

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
  /** Wartezeit vor dem zweiten Versuch; Tests setzen hier eine sofortige Fassung ein. */
  sleep?: (ms: number) => Promise<void>;
}

interface Entry { at: number; features: Feature[] }

const TIMEOUT_MS = 8000;
/** Fällt die Quelle aus, liefert der Proxy bis zu diesem Vielfachen der TTL alte Daten (markiert als stale). */
const STALE_FACTOR = 30;
const MAX_ENTRIES = 2000;
/** Nach einer Pause scheitert die erste Abfrage einer Quelle gelegentlich (kalte Verbindung): einmal neu versuchen. */
const RETRY_MS = 250;
// planespotters verlangt eine Kontaktadresse im User-Agent.
const UA = 'LiveKarten/1.0 (+https://karte.domenic-boe.de; private, nicht-kommerzielle Karte)';

export function createProxy(deps: Deps) {
  const cache = new Map<string, Entry>();
  const inflight = new Map<string, Promise<Entry>>();
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  /** Zweiter Versuch nach kurzer Pause, wenn die Quelle (samt Ausweichquelle) nicht antwortet. */
  async function twice<T>(run: () => Promise<T>): Promise<T> {
    const t0 = deps.now();
    try {
      return await run();
    } catch (e) {
      // Lief der erste Versuch schon ins Zeitlimit, hilft ein zweiter nicht – der Besucher wartet nur doppelt.
      if (deps.now() - t0 > TIMEOUT_MS / 2) throw e;
      await sleep(RETRY_MS);
      return run();
    }
  }

  async function fetchJson(url: string): Promise<unknown> {
    const res = await deps.fetch(url, {
      // Digitraffic bittet um eine Kennung im Header (und verlangt gzip); die übrigen Quellen ignorieren das.
      headers: { accept: 'application/json', 'accept-encoding': 'gzip', 'user-agent': UA, 'digitraffic-user': 'LiveKarten' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /** Mehrere Teilabfragen gleichzeitig; fehlende Teile kommen als null beim Parser an. Alles weg = Fehler. */
  async function upstreamParts(urls: string[], parse: (j: unknown) => Feature[]): Promise<Feature[]> {
    const parts = await Promise.allSettled(urls.map(fetchJson));
    if (parts.every((p) => p.status === 'rejected')) {
      throw new Error(parts.map((p, i) => `${new URL(urls[i]).host}: ${(p as PromiseRejectedResult).reason?.message ?? p}`).join('; '));
    }
    return parse(parts.map((p) => (p.status === 'fulfilled' ? p.value : null)));
  }

  async function upstream(urls: string[], parse: (j: unknown) => Feature[]): Promise<Feature[]> {
    const errors: string[] = [];
    for (const url of urls) {
      try {
        return parse(await fetchJson(url));
      } catch (e) {
        errors.push(`${new URL(url).host}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new Error(errors.join('; '));
  }

  function remember(key: string, entry: Entry) {
    cache.delete(key);
    cache.set(key, entry);
    // Map hält die Einfügereihenfolge: die ältesten Einträge fliegen zuerst.
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  }

  function json(status: number, body: unknown, ttl = 0): Response {
    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate'
    };
    // Gültigkeit für den gemeinsamen Cache der Anbindung (functions/api/feed): eine Upstream-Abfrage pro Zelle und TTL.
    if (ttl > 0) headers['x-feed-ttl'] = `s-maxage=${ttl}`;
    return new Response(JSON.stringify(body), { status, headers });
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Nur GET' });
    const url = new URL(req.url);
    const m = /^\/api\/feed\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (!m) return json(404, { error: 'Unbekannter Pfad' });
    const src = SOURCES[m[1]];
    if (!src) return json(404, { error: `Unbekannte Quelle: ${m[1]}` });

    let key: string;
    try {
      key = `${src.id}:${src.key(url.searchParams)}`;
    } catch (e) {
      if (e instanceof ParamError) return json(400, { error: e.message });
      throw e;
    }

    const now = deps.now();
    const hit = cache.get(key);
    const reply = (e: Entry, stale: boolean) =>
      json(200, { source: src.id, at: new Date(e.at).toISOString(), stale, features: e.features }, stale ? 0 : src.ttl);

    if (hit && now - hit.at < src.ttl * 1000) return reply(hit, false);

    // Gleichzeitige Anfragen für dieselbe Zelle teilen sich eine Upstream-Abfrage.
    let p = inflight.get(key);
    if (!p) {
      const sub = key.slice(src.id.length + 1);
      const parse = (j: unknown) => src.parse(j, sub);
      p = twice(() => (src.parts ? upstreamParts(src.urls(sub), parse) : upstream(src.urls(sub), parse)))
        .then((features) => {
          const e = { at: deps.now(), features };
          remember(key, e);
          return e;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    try {
      return reply(await p, false);
    } catch (e) {
      if (hit && now - hit.at < src.ttl * 1000 * STALE_FACTOR) return reply(hit, true);
      return json(502, { error: `Quelle nicht erreichbar – ${e instanceof Error ? e.message : String(e)}` });
    }
  };
}
