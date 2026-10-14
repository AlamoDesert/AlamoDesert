/* Courtside-API: Online-Anmeldung zu einem Turnier.
 * Reine Logik mit austauschbarem Speicher (Netlify Blobs im Betrieb, Speicher-Map lokal und im Test).
 * Jede Anmeldung ist ein eigener Schlüssel – parallele Anmeldungen überschreiben sich nicht.
 */

export interface Store {
  get(key: string, opts: { type: 'json' }): Promise<any>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  list(opts: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

const LEVELS = ['beginner', 'intermediate', 'pro'];
const SPORTS = ['padel', 'pickleball', 'tennis'];
const MODES = ['americano', 'mexicano', 'kotc', 'team'];
const MAX_PLAYERS = 64;
const MAX_BODY = 8000;
const ID_RE = /^[a-z0-9]{6,16}$/;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function randomId(len: number): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 Zeichen: gleichverteilt, keine verwechselbaren
  let s = '';
  for (const b of crypto.getRandomValues(new Uint8Array(len))) s += alphabet[b % 32];
  return s;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

const cleanText = (v: unknown, max: number): string =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function parsePerson(body: any): { name: string; level: string; rating: number | null } {
  const name = cleanText(body && body.name, 40);
  if (!name) throw new HttpError(400, 'Bitte einen Namen eingeben.');
  let rating: number | null = null;
  if (body.rating != null && body.rating !== '') {
    const n = Number(String(body.rating).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 7) throw new HttpError(400, 'Das Playtomic-Level liegt zwischen 0 und 7.');
    rating = Math.round(n * 10) / 10;
  }
  let level = LEVELS.includes(body.level) ? body.level : null;
  if (!level && rating != null) level = rating < 2 ? 'beginner' : rating < 4 ? 'intermediate' : 'pro';
  if (!level) throw new HttpError(400, 'Bitte ein Level wählen.');
  return { name, level, rating };
}

async function readBody(req: Request): Promise<any> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Die Anfrage ist zu groß.');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Ungültige Anfrage.'); }
}

const bearer = (req: Request) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
const metaKey = (id: string) => `e/${id}/meta`;
const playerPrefix = (id: string) => `e/${id}/p/`;

async function loadMeta(store: Store, id: string): Promise<any> {
  if (!ID_RE.test(id)) throw new HttpError(404, 'Diese Anmeldung gibt es nicht.');
  const meta = await store.get(metaKey(id), { type: 'json' });
  if (!meta) throw new HttpError(404, 'Diese Anmeldung gibt es nicht (mehr).');
  return meta;
}

async function loadPlayers(store: Store, id: string): Promise<any[]> {
  const { blobs } = await store.list({ prefix: playerPrefix(id) });
  const players = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  return players.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const publicPlayer = (p: any) => ({ id: p.id, name: p.name, level: p.level, rating: p.rating ?? null, createdAt: p.createdAt });
const publicEvent = (meta: any, players: any[]) => ({
  id: meta.id, name: meta.name, sport: meta.sport, mode: meta.mode, when: meta.when, note: meta.note,
  open: meta.open, createdAt: meta.createdAt, players: players.map(publicPlayer)
});

async function isAdmin(req: Request, meta: any): Promise<boolean> {
  const key = bearer(req);
  return !!key && (await sha256(key)) === meta.adminHash;
}

function applyEventFields(meta: any, body: any, creating: boolean) {
  if (creating || body.name !== undefined) {
    meta.name = cleanText(body.name, 80);
    if (!meta.name) throw new HttpError(400, 'Bitte einen Turniernamen eingeben.');
  }
  if (creating || body.sport !== undefined) {
    if (!SPORTS.includes(body.sport)) throw new HttpError(400, 'Unbekannte Sportart.');
    meta.sport = body.sport;
  }
  if (creating || body.mode !== undefined) {
    if (!MODES.includes(body.mode)) throw new HttpError(400, 'Unbekannter Modus.');
    meta.mode = body.mode;
  }
  if (creating || body.when !== undefined) meta.when = cleanText(body.when, 60);
  if (creating || body.note !== undefined) meta.note = cleanText(body.note, 300);
  if (body.open !== undefined) meta.open = !!body.open;
}

async function route(req: Request, store: Store): Promise<Response> {
  const parts = new URL(req.url).pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = req.method;
  if (parts[0] !== 'events') throw new HttpError(404, 'Nicht gefunden.');
  const [, id, sub, pid] = parts;

  // POST /api/events – Anmeldung eröffnen
  if (!id) {
    if (method !== 'POST') throw new HttpError(405, 'Nicht erlaubt.');
    const body = await readBody(req);
    const adminKey = randomToken();
    const meta: any = { id: randomId(10), open: true, createdAt: new Date().toISOString(), adminHash: await sha256(adminKey) };
    applyEventFields(meta, body, true);
    await store.setJSON(metaKey(meta.id), meta);
    return json({ event: publicEvent(meta, []), adminKey }, 201);
  }

  const meta = await loadMeta(store, id);

  if (!sub) {
    if (method === 'GET') {
      const players = await loadPlayers(store, id);
      return json({ event: publicEvent(meta, players), admin: await isAdmin(req, meta) });
    }
    if (!(await isAdmin(req, meta))) throw new HttpError(403, 'Keine Berechtigung.');
    if (method === 'PATCH') {
      applyEventFields(meta, await readBody(req), false);
      await store.setJSON(metaKey(id), meta);
      return json({ event: publicEvent(meta, await loadPlayers(store, id)) });
    }
    if (method === 'DELETE') {
      const { blobs } = await store.list({ prefix: `e/${id}/` });
      await Promise.all(blobs.map((b) => store.delete(b.key)));
      return json({ ok: true });
    }
    throw new HttpError(405, 'Nicht erlaubt.');
  }

  if (sub !== 'players') throw new HttpError(404, 'Nicht gefunden.');
  const admin = await isAdmin(req, meta);
  const closedMsg = 'Die Anmeldung ist geschlossen. Bitte direkt an die Turnierleitung wenden.';

  // POST /api/events/:id/players – sich anmelden (Turnierleitung auch nach Schluss)
  if (!pid) {
    if (method !== 'POST') throw new HttpError(405, 'Nicht erlaubt.');
    if (!meta.open && !admin) throw new HttpError(409, closedMsg);
    const person = parsePerson(await readBody(req));
    const players = await loadPlayers(store, id);
    if (players.length >= MAX_PLAYERS) throw new HttpError(409, 'Das Turnier ist voll.');
    if (players.some((p) => p.name.toLowerCase() === person.name.toLowerCase())) {
      throw new HttpError(409, 'Dieser Name ist schon angemeldet. Bitte mit Initiale des Nachnamens ergänzen.');
    }
    const token = randomToken();
    const player = Object.assign({ id: randomId(8), createdAt: new Date().toISOString(), tokenHash: await sha256(token) }, person);
    await store.setJSON(playerPrefix(id) + player.id, player);
    return json({ player: publicPlayer(player), token }, 201);
  }

  if (!ID_RE.test(pid)) throw new HttpError(404, 'Diese Anmeldung gibt es nicht.');
  const key = playerPrefix(id) + pid;
  const player = await store.get(key, { type: 'json' });
  if (!player) throw new HttpError(404, 'Diese Anmeldung gibt es nicht (mehr).');
  const own = !!bearer(req) && (await sha256(bearer(req))) === player.tokenHash;
  if (!own && !admin) throw new HttpError(403, 'Keine Berechtigung. Bitte den persönlichen Link verwenden.');
  if (!meta.open && !admin) throw new HttpError(409, closedMsg);

  if (method === 'PUT') {
    const person = parsePerson(await readBody(req));
    const others = (await loadPlayers(store, id)).filter((p) => p.id !== pid);
    if (others.some((p) => p.name.toLowerCase() === person.name.toLowerCase())) throw new HttpError(409, 'Dieser Name ist schon angemeldet.');
    Object.assign(player, person, { updatedAt: new Date().toISOString() });
    await store.setJSON(key, player);
    return json({ player: publicPlayer(player) });
  }
  if (method === 'DELETE') {
    await store.delete(key);
    return json({ ok: true });
  }
  throw new HttpError(405, 'Nicht erlaubt.');
}

export async function handle(req: Request, store: Store): Promise<Response> {
  try {
    return await route(req, store);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Der Server hat gerade ein Problem. Bitte gleich noch einmal versuchen.' }, 500);
  }
}
