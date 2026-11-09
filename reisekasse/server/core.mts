/* Reisekasse-API: gemeinsame Reisekasse mit Einträgen, Änderungsprotokoll und Belegfotos.
 * Reine Logik mit austauschbarem Speicher (Cloudflare D1 im Betrieb, Arbeitsspeicher lokal und im Test).
 * Jeder Eintrag ist ein eigener Schlüssel – parallele Änderungen an verschiedenen Einträgen überschreiben sich nicht.
 * Beträge sind ganze Zahlen in der kleinsten Einheit; die Geldrechnung prüft der Client.
 */

export interface Row { key: string; val: string; rev: number; t: number }
export interface Store {
  get(key: string): Promise<{ val: string; rev: number; t: number } | null>;
  /** expectRev: null = darf nicht existieren, Zahl = muss passen, undefined = ohne Bedingung. Gibt die neue Revision oder false zurück. */
  put(key: string, val: string, opts?: { expectRev?: number | null; t?: number }): Promise<number | false>;
  del(key: string): Promise<void>;
  list(prefix: string, opts?: { since?: number; limit?: number; before?: string; desc?: boolean }): Promise<Row[]>;
  getBlob(key: string): Promise<{ data: Uint8Array; type: string } | null>;
  putBlob(key: string, data: Uint8Array, type: string): Promise<void>;
}

const TRIP_ID_RE = /^[a-z0-9]{8,16}$/;
const ID_RE = /^[a-z0-9]{4,24}$/;
const LOG_RE = /^\d{13}-[a-z0-9]{4}(-[a-z0-9]{4})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CUR_RE = /^[A-Z]{3}$/;
const MAX_BODY = 64 * 1024;
const MAX_IMG = 1_500_000;
const MAX_ENTRIES = 1000;
const MAX_MEMBERS = 30;
const MAX_ITEMS = 200;
const MAX_AMOUNT = 1e11;
const OVERLAP = 5000; // Überlappung beim Abgleich (Uhrenabweichung, gleichzeitige Schreibvorgänge)
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const cleanText = (v: unknown, max = 1000): string =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

async function readBody(req: Request): Promise<any> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) throw new HttpError(413, 'Die Anfrage ist zu groß.');
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BODY) throw new HttpError(413, 'Die Anfrage ist zu groß.');
  if (!buf.byteLength) return {};
  try {
    const v = JSON.parse(new TextDecoder().decode(buf));
    if (!isObj(v)) throw new Error('kein Objekt');
    return v;
  } catch {
    throw new HttpError(400, 'Ungültige Anfrage.');
  }
}

const bearer = (req: Request) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
const metaKey = (id: string) => `t/${id}/meta`;
const entryPrefix = (id: string) => `t/${id}/e/`;
const logPrefix = (id: string) => `t/${id}/l/`;

// ---------- Prüfung ----------

function validateTrip(raw: any): { name: string; currency: string; members: any[] } {
  if (!isObj(raw)) throw new HttpError(400, 'Die Reisedaten fehlen.');
  const name = cleanText(raw.name, 200);
  if (!name) throw new HttpError(400, 'Bitte einen Reisenamen eingeben.');
  if (name.length > 60) throw new HttpError(400, 'Der Reisename darf höchstens 60 Zeichen haben.');
  const currency = typeof raw.currency === 'string' ? raw.currency : '';
  if (!CUR_RE.test(currency)) throw new HttpError(400, 'Die Währung muss ein dreibuchstabiger Code sein, z. B. EUR.');
  if (!Array.isArray(raw.members) || raw.members.length < 1) throw new HttpError(400, 'Bitte mindestens eine Person angeben.');
  if (raw.members.length > MAX_MEMBERS) throw new HttpError(400, `Eine Reise kann höchstens ${MAX_MEMBERS} Personen haben.`);
  const ids = new Set<string>();
  const names = new Set<string>();
  const members = raw.members.map((m: any) => {
    if (!isObj(m)) throw new HttpError(400, 'Ungültige Person.');
    if (typeof m.id !== 'string' || !ID_RE.test(m.id)) throw new HttpError(400, 'Ungültige Personen-Kennung.');
    if (ids.has(m.id)) throw new HttpError(400, 'Personen-Kennungen müssen verschieden sein.');
    ids.add(m.id);
    const mname = cleanText(m.name, 200);
    if (!mname) throw new HttpError(400, 'Jede Person braucht einen Namen.');
    if (mname.length > 40) throw new HttpError(400, 'Ein Name darf höchstens 40 Zeichen haben.');
    const lower = mname.toLowerCase();
    if (names.has(lower)) throw new HttpError(400, `Der Name „${mname}“ kommt doppelt vor.`);
    names.add(lower);
    if (typeof m.weight !== 'number' || !Number.isFinite(m.weight) || m.weight <= 0 || m.weight > 10)
      throw new HttpError(400, 'Der Anteil einer Person muss zwischen 0 und 10 liegen.');
    const out: any = { id: m.id, name: mname, weight: m.weight };
    for (const [f, max, label] of [['paypal', 60, 'PayPal'], ['iban', 40, 'IBAN'], ['bic', 11, 'BIC']] as const) {
      const v = cleanText(m[f], 200);
      if (v.length > max) throw new HttpError(400, `${label} ist zu lang.`);
      if (v) out[f] = v;
    }
    return out;
  });
  return { name, currency, members };
}

const memberIds = (trip: any): string[] => trip.members.map((m: any) => m.id);

function requireMember(trip: any, id: unknown, message = 'Unbekannte Person.'): string {
  if (typeof id !== 'string' || !trip.members.some((m: any) => m.id === id)) throw new HttpError(400, message);
  return id;
}

function intAmount(v: unknown, allowNegative: boolean, what: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || Math.abs(v) > MAX_AMOUNT || (!allowNegative && v < 1))
    throw new HttpError(400, `${what}: ungültiger Betrag.`);
  return v;
}

function validateSplit(raw: any, trip: any, required: boolean): any {
  if (raw == null && !required) return { mode: 'shares', among: [] };
  if (!isObj(raw)) throw new HttpError(400, 'Die Aufteilung fehlt.');
  if (!['shares', 'exact', 'items'].includes(raw.mode)) throw new HttpError(400, 'Unbekannte Aufteilungsart.');
  if (!Array.isArray(raw.among)) throw new HttpError(400, 'Bitte angeben, auf wen aufgeteilt wird.');
  const among: string[] = [];
  for (const id of raw.among) {
    requireMember(trip, id);
    if (!among.includes(id)) among.push(id);
  }
  const out: any = { mode: raw.mode, among };
  if (raw.weights != null) {
    if (!isObj(raw.weights)) throw new HttpError(400, 'Ungültige Anteile.');
    out.weights = {};
    for (const [id, w] of Object.entries(raw.weights)) {
      requireMember(trip, id);
      if (typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > 10) throw new HttpError(400, 'Ein Anteil muss zwischen 0 und 10 liegen.');
      out.weights[id] = w;
    }
  }
  if (raw.exact != null) {
    if (!isObj(raw.exact)) throw new HttpError(400, 'Ungültige Beträge.');
    out.exact = {};
    for (const [id, v] of Object.entries(raw.exact)) {
      requireMember(trip, id);
      out.exact[id] = intAmount(v, true, 'Aufteilung');
    }
  }
  if (raw.items != null) {
    if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) throw new HttpError(400, `Höchstens ${MAX_ITEMS} Posten pro Eintrag.`);
    const seen = new Set<string>();
    out.items = raw.items.map((it: any) => {
      if (!isObj(it) || typeof it.id !== 'string' || !ID_RE.test(it.id)) throw new HttpError(400, 'Ungültiger Posten.');
      if (seen.has(it.id)) throw new HttpError(400, 'Posten-Kennungen müssen verschieden sein.');
      seen.add(it.id);
      const name = cleanText(it.name, 200);
      if (name.length > 80) throw new HttpError(400, 'Ein Postenname darf höchstens 80 Zeichen haben.');
      if (!Array.isArray(it.who)) throw new HttpError(400, 'Ungültiger Posten.');
      const who: string[] = [];
      for (const id of it.who) {
        requireMember(trip, id);
        if (!who.includes(id)) who.push(id);
      }
      return { id: it.id, name, amount: intAmount(it.amount, true, 'Posten'), who };
    });
  }
  if (raw.mode === 'items' && !out.items) out.items = [];
  return out;
}

function validateEntry(raw: any, trip: any): any {
  if (!isObj(raw)) throw new HttpError(400, 'Der Eintrag fehlt.');
  if (!['expense', 'income', 'transfer'].includes(raw.kind)) throw new HttpError(400, 'Unbekannte Art des Eintrags.');
  const title = cleanText(raw.title, 500);
  if (title.length > 80) throw new HttpError(400, 'Der Titel darf höchstens 80 Zeichen haben.');
  if (typeof raw.date !== 'string' || !DATE_RE.test(raw.date)) throw new HttpError(400, 'Ungültiges Datum.');
  const category = cleanText(raw.category, 200);
  if (category.length > 20) throw new HttpError(400, 'Die Kategorie darf höchstens 20 Zeichen haben.');
  const amount = intAmount(raw.amount, false, 'Betrag');
  if (typeof raw.currency !== 'string' || !CUR_RE.test(raw.currency)) throw new HttpError(400, 'Ungültige Währung.');
  let rate: number | null = null;
  if (raw.currency !== trip.currency) {
    if (typeof raw.rate !== 'number' || !Number.isFinite(raw.rate) || raw.rate <= 0) throw new HttpError(400, 'Ungültiger Wechselkurs.');
    rate = raw.rate;
  }
  const payer = requireMember(trip, raw.payer, 'Unbekannte Person als Zahler.');
  const out: any = { kind: raw.kind, title, date: raw.date, category, amount, currency: raw.currency, rate, payer };
  if (raw.kind === 'transfer') {
    out.to = requireMember(trip, raw.to, 'Unbekannte Person als Empfänger.');
    if (out.to === payer) throw new HttpError(400, 'Eine Überweisung an sich selbst ist nicht möglich.');
  }
  out.split = validateSplit(raw.split, trip, raw.kind !== 'transfer');
  if (raw.receipt != null && raw.receipt !== '') {
    if (typeof raw.receipt !== 'string' || !ID_RE.test(raw.receipt)) throw new HttpError(400, 'Ungültiges Belegfoto.');
    out.receipt = raw.receipt;
  }
  const note = String(raw.note ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
  if (note.length > 500) throw new HttpError(400, 'Die Notiz darf höchstens 500 Zeichen haben.');
  if (note) out.note = note;
  return out;
}

// ---------- Hilfen ----------

interface Ctx { store: Store; now: () => number; id: string; trip: any; metaRev: number; metaT: number; keyHash: string }

let logSeq = 0;
async function addLog(c: Ctx, rec: Record<string, unknown>): Promise<void> {
  const at = c.now();
  // Laufnummer pro Instanz: Einträge derselben Millisekunde bleiben in Schreibreihenfolge; Zufall gegen Kollisionen zwischen Instanzen.
  logSeq = (logSeq + 1) % 1679616;
  const key = `${logPrefix(c.id)}${String(at).padStart(13, '0')}-${logSeq.toString(36).padStart(4, '0')}-${randomId(4)}`;
  await c.store.put(key, JSON.stringify({ at, ...rec }), { expectRev: null, t: at });
}

async function saveTrip(c: Ctx, trip: any): Promise<void> {
  const meta = { trip, keyHash: c.keyHash, created: trip.created };
  await c.store.put(metaKey(c.id), JSON.stringify(meta), { t: c.now() });
  c.trip = trip;
}

const parseEntry = (val: string): any => JSON.parse(val);

function tombstone(id: string, now: number, by: string) {
  return { id, deleted: true, updatedAt: now, updatedBy: by };
}

function entryId(raw: string | undefined): string {
  if (!raw || !ID_RE.test(raw)) throw new HttpError(400, 'Ungültige Kennung.');
  return raw;
}

function method(req: Request, ...allowed: string[]) {
  if (!allowed.includes(req.method)) throw new HttpError(405, 'Nicht erlaubt.');
}

// ---------- Routen ----------

async function createTrip(req: Request, store: Store, now: () => number): Promise<Response> {
  method(req, 'POST');
  const body = await readBody(req);
  const v = validateTrip(body.trip);
  const key = randomToken();
  const id = randomId(10);
  const created = now();
  const trip = { id, name: v.name, currency: v.currency, members: v.members, created };
  const ok = await store.put(metaKey(id), JSON.stringify({ trip, keyHash: await sha256(key), created }), { expectRev: null, t: created });
  if (ok === false) throw new HttpError(409, 'Bitte nochmal versuchen.');
  return json({ id, key, trip }, 201);
}

async function route(req: Request, store: Store, now: () => number): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'trips' && parts.length === 1) return createTrip(req, store, now);
  if (parts[0] !== 't' || parts.length < 2) throw new HttpError(404, 'Nicht gefunden.');

  const [, id, sub, a, b] = parts;
  if (!TRIP_ID_RE.test(id)) throw new HttpError(404, 'Diese Reise gibt es nicht.');
  const row = await store.get(metaKey(id));
  if (!row) throw new HttpError(404, 'Diese Reise gibt es nicht.');
  const meta = JSON.parse(row.val);
  const key = bearer(req);
  if (!key || !sameString(await sha256(key), meta.keyHash)) throw new HttpError(403, 'Kein Zugriff auf diese Reise.');
  const c: Ctx = { store, now, id, trip: meta.trip, metaRev: row.rev, metaT: row.t, keyHash: meta.keyHash };

  if (!sub) {
    method(req, 'GET');
    return getTrip(c, url);
  }
  if (sub === 'trip' && !a) { method(req, 'PUT'); return putTrip(c, req); }
  if (sub === 'e' && a) {
    const eid = entryId(a);
    if (!b) {
      method(req, 'PUT', 'DELETE');
      return req.method === 'PUT' ? putEntry(c, req, eid) : deleteEntry(c, url, eid);
    }
    if (b === 'claim' && parts.length === 5) { method(req, 'POST'); return claim(c, req, eid); }
    throw new HttpError(404, 'Nicht gefunden.');
  }
  if (sub === 'restore' && !a) { method(req, 'POST'); return restore(c, req); }
  if (sub === 'log' && !a) { method(req, 'GET'); return getLog(c, url); }
  if (sub === 'img' && parts.length <= 4) {
    if (!a) { method(req, 'POST'); return postImg(c, req); }
    method(req, 'GET');
    return getImg(c, a);
  }
  throw new HttpError(404, 'Nicht gefunden.');
}

async function getTrip(c: Ctx, url: URL): Promise<Response> {
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw == null || sinceRaw === '' ? null : Number(sinceRaw);
  if (since != null && !Number.isFinite(since)) throw new HttpError(400, 'Ungültige Anfrage.');
  const rows = await c.store.list(entryPrefix(c.id), since == null ? {} : { since: since - OVERLAP });
  const entries = rows.map((r) => parseEntry(r.val));
  const trip = since == null || c.metaT > since - OVERLAP ? c.trip : null;
  return json({ trip, tripT: c.metaT, entries, now: c.now() });
}

async function putTrip(c: Ctx, req: Request): Promise<Response> {
  const body = await readBody(req);
  const v = validateTrip(body.trip);
  requireMember(c.trip, body.by);
  const before = c.trip;
  const trip = { id: before.id, name: v.name, currency: v.currency, members: v.members, created: before.created };
  await saveTrip(c, trip);
  await addLog(c, { action: 'trip', by: body.by, before, after: trip });
  return json({ trip });
}

async function putEntry(c: Ctx, req: Request, eid: string): Promise<Response> {
  const body = await readBody(req);
  const by = requireMember(c.trip, body.by);
  const clean = validateEntry(body.entry, c.trip);
  const key = entryPrefix(c.id) + eid;
  const row = await c.store.get(key);
  const existing = row ? parseEntry(row.val) : null;
  if (!existing) {
    const n = await c.store.list(entryPrefix(c.id), { limit: MAX_ENTRIES });
    if (n.length >= MAX_ENTRIES) throw new HttpError(400, 'Diese Reise hat zu viele Einträge.');
  }
  const now = c.now();
  const entry = {
    id: eid, ...clean,
    createdAt: existing?.createdAt ?? now, createdBy: existing?.createdBy ?? by,
    updatedAt: now, updatedBy: by
  };
  await c.store.put(key, JSON.stringify(entry), { t: now });
  const live = existing && !existing.deleted;
  await addLog(c, { action: live ? 'edit' : 'add', by, id: eid, before: live ? existing : null, after: entry });
  return json({ entry });
}

async function deleteEntry(c: Ctx, url: URL, eid: string): Promise<Response> {
  const by = requireMember(c.trip, url.searchParams.get('by'));
  const key = entryPrefix(c.id) + eid;
  const row = await c.store.get(key);
  const existing = row ? parseEntry(row.val) : null;
  if (!existing || existing.deleted) throw new HttpError(404, 'Diesen Eintrag gibt es nicht.');
  const now = c.now();
  await c.store.put(key, JSON.stringify(tombstone(eid, now, by)), { t: now });
  await addLog(c, { action: 'delete', by, id: eid, before: existing });
  return json({ ok: true });
}

async function claim(c: Ctx, req: Request, eid: string): Promise<Response> {
  const body = await readBody(req);
  const by = requireMember(c.trip, body.by);
  const member = requireMember(c.trip, body.member);
  if (typeof body.on !== 'boolean') throw new HttpError(400, 'Ungültige Anfrage.');
  if (typeof body.item !== 'string') throw new HttpError(400, 'Dieser Posten fehlt.');
  const key = entryPrefix(c.id) + eid;
  for (let i = 0; i < 8; i++) {
    const row = await c.store.get(key);
    const entry = row ? parseEntry(row.val) : null;
    if (!entry || entry.deleted) throw new HttpError(404, 'Diesen Eintrag gibt es nicht.');
    if (!entry.split || entry.split.mode !== 'items') throw new HttpError(400, 'Dieser Eintrag wird nicht nach Posten aufgeteilt.');
    const item = (entry.split.items || []).find((it: any) => it.id === body.item);
    if (!item) throw new HttpError(400, 'Dieser Posten fehlt.');
    const who = new Set<string>(item.who);
    if (body.on) who.add(member); else who.delete(member);
    item.who = memberIds(c.trip).filter((m) => who.has(m));
    const now = c.now();
    entry.updatedAt = now;
    entry.updatedBy = by;
    if (await c.store.put(key, JSON.stringify(entry), { expectRev: row!.rev, t: now }) !== false) {
      await addLog(c, { action: 'claim', by, id: eid, item: body.item, member, on: body.on });
      return json({ entry });
    }
  }
  throw new HttpError(409, 'Gerade viel los – bitte nochmal versuchen.');
}

async function restore(c: Ctx, req: Request): Promise<Response> {
  const body = await readBody(req);
  const by = requireMember(c.trip, body.by);
  if (typeof body.log !== 'string' || !LOG_RE.test(body.log)) throw new HttpError(400, 'Ungültiger Protokolleintrag.');
  const row = await c.store.get(logPrefix(c.id) + body.log);
  if (!row) throw new HttpError(404, 'Diesen Protokolleintrag gibt es nicht.');
  const rec = JSON.parse(row.val);
  const now = c.now();

  if (rec.action === 'trip') {
    if (!isObj(rec.before)) throw new HttpError(400, 'Das lässt sich nicht wiederherstellen.');
    const before = c.trip;
    const trip = { ...rec.before, id: before.id, created: before.created };
    await saveTrip(c, trip);
    await addLog(c, { action: 'restore', by, before, after: trip });
    return json({ trip });
  }
  if (rec.action !== 'add' && rec.action !== 'edit' && rec.action !== 'delete') throw new HttpError(400, 'Das lässt sich nicht wiederherstellen.');
  const eid = entryId(rec.id);
  const key = entryPrefix(c.id) + eid;
  const curRow = await c.store.get(key);
  const current = curRow ? parseEntry(curRow.val) : null;

  if (rec.action === 'add') {
    if (!current || current.deleted) throw new HttpError(404, 'Dieser Eintrag ist schon gelöscht.');
    const entry = tombstone(eid, now, by);
    await c.store.put(key, JSON.stringify(entry), { t: now });
    await addLog(c, { action: 'restore', by, id: eid, before: current, after: entry });
    return json({ entry });
  }
  if (!isObj(rec.before)) throw new HttpError(400, 'Das lässt sich nicht wiederherstellen.');
  const entry = { ...rec.before, id: eid, updatedAt: now, updatedBy: by };
  delete entry.deleted;
  await c.store.put(key, JSON.stringify(entry), { t: now });
  await addLog(c, { action: 'restore', by, id: eid, before: current, after: entry });
  return json({ entry });
}

async function getLog(c: Ctx, url: URL): Promise<Response> {
  const before = url.searchParams.get('before');
  if (before && !LOG_RE.test(before)) throw new HttpError(400, 'Ungültige Anfrage.');
  const lim = url.searchParams.get('limit');
  const n = lim == null || lim === '' ? 50 : Math.floor(Number(lim));
  const limit = Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 50;
  const prefix = logPrefix(c.id);
  const rows = await c.store.list(prefix, { desc: true, limit: limit + 1, before: before ? prefix + before : undefined });
  const log = rows.slice(0, limit).map((r) => ({ key: r.key.slice(prefix.length), ...JSON.parse(r.val) }));
  return json({ log, more: rows.length > limit });
}

async function postImg(c: Ctx, req: Request): Promise<Response> {
  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!IMG_TYPES.includes(type)) throw new HttpError(415, 'Nur JPEG-, PNG- oder WebP-Bilder sind erlaubt.');
  if (Number(req.headers.get('content-length') || 0) > MAX_IMG) throw new HttpError(413, 'Das Bild ist zu groß (höchstens 1,5 MB).');
  const data = new Uint8Array(await req.arrayBuffer());
  if (data.length > MAX_IMG) throw new HttpError(413, 'Das Bild ist zu groß (höchstens 1,5 MB).');
  const ok = type === 'image/jpeg' ? data[0] === 0xff && data[1] === 0xd8
    : type === 'image/png' ? data[0] === 0x89 && data[1] === 0x50
    : data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46;
  if (!ok) throw new HttpError(400, 'Das ist kein gültiges Bild.');
  const img = randomId(12);
  await c.store.putBlob(`t/${c.id}/i/${img}`, data, type);
  return json({ img }, 201);
}

async function getImg(c: Ctx, img: string): Promise<Response> {
  if (!ID_RE.test(img)) throw new HttpError(404, 'Dieses Bild gibt es nicht.');
  const blob = await c.store.getBlob(`t/${c.id}/i/${img}`);
  if (!blob) throw new HttpError(404, 'Dieses Bild gibt es nicht.');
  return new Response(blob.data, {
    status: 200,
    headers: { 'content-type': blob.type, 'cache-control': 'private, max-age=31536000, immutable' }
  });
}

export async function handle(req: Request, store: Store, now: () => number = Date.now): Promise<Response> {
  try {
    return await route(req, store, now);
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Interner Fehler.' }, 500);
  }
}
