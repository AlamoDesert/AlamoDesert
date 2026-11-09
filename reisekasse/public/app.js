/* Reisekasse – Oberfläche, Speicher, Abgleich, Bon-Scan.
 * Rechenlogik in engine.js. Daten pro Reise lokal in localStorage (offline nutzbar), Änderungen gehen als
 * Warteschlange an /api/t/<id>/…; Bilder (Bons) liegen in IndexedDB, bis sie hochgeladen sind.
 * Zugriff: Link #/j/<id>/<schlüssel> – der Schlüssel steht nur im Fragment und geht nie in Server-Logs.
 */
import * as E from './engine.js';

const LS = 'reisekasse.v1';
const POLL_MS = 15000;
const CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD', 'CZK', 'PLN', 'HUF', 'DKK', 'SEK', 'NOK', 'ISK', 'RON', 'BGN', 'TRY', 'JPY', 'THB', 'AUD', 'CAD', 'NZD', 'MXN', 'ZAR', 'IDR', 'SGD', 'HKD', 'CNY', 'KRW', 'INR', 'BRL'];
const COLORS = ['#0E7C66', '#C2561F', '#3A62C9', '#A23B72', '#7A5BC7', '#2F8F9D', '#B08900', '#5E7D2A', '#C23B4B', '#4B5A69'];

// ---------- Speicher ----------
function loadDb() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || 'null');
    if (d && typeof d === 'object' && d.trips) return { trips: d.trips, order: Array.isArray(d.order) ? d.order : Object.keys(d.trips), rates: d.rates || {} };
  } catch { /* beschädigt → neu beginnen */ }
  return { trips: {}, order: [], rates: {} };
}
let db = loadDb();
function save() {
  try { localStorage.setItem(LS, JSON.stringify(db)); } catch (e) { toast('Speichern auf dem Gerät fehlgeschlagen: ' + e.message); }
}

// IndexedDB für Bilder (Bons): Schlüssel "<reise>/<bild>" → Blob.
const idb = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('reisekasse', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction('img', mode);
      const req = fn(t.objectStore('img'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    get: (k) => tx('readonly', (s) => s.get(k)).catch(() => null),
    put: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => null),
    del: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => null)
  };
})();

// ---------- Hilfen ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (minor, cur) => E.formatMoney(minor, cur);
const fmtNum = (n) => String(n).replace('.', ',');
const parseNum = (s) => {
  const n = Number(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const dayLabel = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  const today = E.todayISO();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === today) return 'Heute';
  if (iso === E.todayISO(y)) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const timeAgo = (ms) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  return new Date(ms).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  scale: '<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 006 0zM18 8l-3 6a3 3 0 006 0z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c2.2.7 3.5 2.5 3.5 5.2"/>',
  history: '<path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  wallet: '<path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H3z"/><path d="M3 7V6a2 2 0 012-2h11v3M16 13h2"/>',
  essen: '<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 0-3 2-3 5v5h3v8M17 3v18"/>',
  einkauf: '<path d="M3 4h2l2.5 11h10L20 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  unterkunft: '<path d="M3 20V8M3 13h18v7M21 13a3 3 0 00-3-3h-7v3"/><circle cx="7" cy="11" r="1.8"/>',
  transport: '<rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 11h16M7 21l2-4M17 21l-2-4"/><circle cx="8" cy="14" r=".8"/><circle cx="16" cy="14" r=".8"/>',
  tanken: '<path d="M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h14M5 10h10M15 8l3 2v8a1.5 1.5 0 003 0v-9l-3-3"/>',
  aktivitaet: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  sonstiges: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/>',
  transfer: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
  income: '<path d="M12 20V6M6 12l6-6 6 6M5 4h14"/>',
  receipt: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ICON.sonstiges}</svg>`;

let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- Reise-Zugriff ----------
const T = (id) => db.trips[id] || null;
const members = (t) => (t.trip && t.trip.members) || [];
const member = (t, id) => members(t).find((m) => m.id === id) || null;
const mname = (t, id) => (member(t, id) || {}).name || 'Unbekannt';
const mcolor = (t, id) => COLORS[Math.max(0, members(t).findIndex((m) => m.id === id)) % COLORS.length];
const avatar = (t, id) => `<span class="avatar" style="background:${mcolor(t, id)}">${esc((mname(t, id)[0] || '?').toUpperCase())}</span>`;
const liveEntries = (t) => Object.values(t.entries || {}).filter((e) => e && !e.deleted);
const shareLink = (t) => `${location.origin}${location.pathname}#/j/${t.id}/${t.key}`;
const pendingCount = (t) => (t.pending || []).length;

// ---------- Server ----------
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
async function api(t, path, { method = 'GET', json, body, type } = {}) {
  const headers = { authorization: 'Bearer ' + t.key };
  if (json !== undefined) headers['content-type'] = 'application/json';
  if (type) headers['content-type'] = type;
  let res;
  try {
    res = await fetch(`/api/t/${t.id}${path}`, { method, headers, body: json !== undefined ? JSON.stringify(json) : body, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Keine Verbindung.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Serverfehler (${res.status}).`);
  return data;
}
const isNetErr = (e) => !e.status || e.status >= 500 || e.status === 408 || e.status === 429;

// Warteschlange abarbeiten: Netzfehler → abbrechen und später erneut; fachliche Fehler (4xx) → Änderung verwerfen.
async function flush(t) {
  while (t.pending.length) {
    const op = t.pending[0];
    try {
      if (op.type === 'img') {
        const blob = await idb.get(`${t.id}/${op.local}`);
        if (blob) {
          const r = await api(t, '/img', { method: 'POST', body: blob, type: blob.type || 'image/jpeg' });
          await idb.put(`${t.id}/${r.img}`, blob);
          await idb.del(`${t.id}/${op.local}`);
          const from = 'local:' + op.local;
          for (const e of Object.values(t.entries)) if (e && e.receipt === from) e.receipt = r.img;
          for (const o of t.pending) if (o.entry && o.entry.receipt === from) o.entry.receipt = r.img;
        }
      } else if (op.type === 'put') {
        const r = await api(t, `/e/${op.eid}`, { method: 'PUT', json: { entry: op.entry, by: t.me } });
        if (!t.pending.slice(1).some((o) => o.eid === op.eid)) t.entries[op.eid] = r.entry;
      } else if (op.type === 'del') {
        try { await api(t, `/e/${op.eid}?by=${encodeURIComponent(t.me)}`, { method: 'DELETE' }); }
        catch (e) { if (e.status !== 404) throw e; }
      } else if (op.type === 'claim') {
        const r = await api(t, `/e/${op.eid}/claim`, { method: 'POST', json: { item: op.item, member: op.member, on: op.on, by: t.me } });
        if (!t.pending.slice(1).some((o) => o.eid === op.eid)) t.entries[op.eid] = r.entry;
      } else if (op.type === 'trip') {
        const r = await api(t, '/trip', { method: 'PUT', json: { trip: op.trip, by: t.me } });
        if (!t.pending.slice(1).some((o) => o.type === 'trip')) { t.trip = r.trip; }
      }
    } catch (e) {
      if (isNetErr(e) || e.status === 403) throw e;
      toast('Änderung abgelehnt: ' + e.message);
    }
    t.pending.shift();
    save();
  }
}

const syncing = new Map();
function sync(id, { full = false } = {}) {
  if (syncing.has(id)) return syncing.get(id);
  const p = (async () => {
    const t = T(id);
    if (!t) return;
    try {
      await flush(t);
      const since = !full && t.syncT ? `?since=${t.syncT}` : '';
      const d = await api(t, since);
      const busy = new Set(t.pending.map((o) => o.eid).filter(Boolean));
      if (d.trip && !t.pending.some((o) => o.type === 'trip')) t.trip = d.trip;
      for (const e of d.entries || []) if (e && e.id && !busy.has(e.id)) t.entries[e.id] = e;
      t.syncT = d.now;
      t.status = 'ok';
      t.err = null;
    } catch (e) {
      t.status = e.status === 403 || e.status === 404 ? 'err' : 'off';
      t.err = e.message;
    } finally {
      syncing.delete(id);
      save();
      if (currentTripId() === id && !editing()) render();
    }
  })();
  syncing.set(id, p);
  return p;
}
function queue(t, op) {
  t.pending.push(op);
  save();
  sync(t.id);
}

// ---------- Bilder ----------
const imgUrls = new Map();
async function imageUrl(t, ref) {
  if (!ref) return null;
  const k = `${t.id}/${ref.replace(/^local:/, '')}`;
  if (imgUrls.has(k)) return imgUrls.get(k);
  let blob = await idb.get(k);
  if (!blob && !ref.startsWith('local:')) {
    try {
      const r = await fetch(`/api/t/${t.id}/img/${ref}`, { headers: { authorization: 'Bearer ' + t.key } });
      if (r.ok) { blob = await r.blob(); idb.put(k, blob); }
    } catch { /* offline */ }
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  imgUrls.set(k, url);
  return url;
}
function hydrateImages(t) {
  document.querySelectorAll('img[data-img]').forEach(async (img) => {
    const url = await imageUrl(t, img.dataset.img);
    if (url) img.src = url; else img.alt = 'Bild nicht verfügbar (offline?)';
  });
}

async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* ältere Browser */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}
function drawScaled(src, max) {
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const toJpeg = (src, max, q) => new Promise((res, rej) => drawScaled(src, max).toBlob((b) => b ? res(b) : rej(new Error('Bild konnte nicht umgewandelt werden.')), 'image/jpeg', q));
// Für die Texterkennung: Graustufen + Kontrast strecken (2 %/98 %-Perzentil) – hilft bei blassen Thermobons.
function prepOcr(src) {
  const c = drawScaled(src, 2200);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    d[i] = g; hist[g]++;
  }
  const n = d.length / 4;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Texterkennung (Tesseract, lokal) ----------
let tessWorker = null;
let ocrProgress = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Texterkennung konnte nicht geladen werden.'));
    document.head.append(s);
  });
}
async function getWorker() {
  if (tessWorker) return tessWorker;
  if (!window.Tesseract) await loadScript('vendor/tesseract/tesseract.min.js');
  const abs = (p) => new URL(p, location.href).href;
  tessWorker = window.Tesseract.createWorker(['deu', 'eng'], 1, {
    workerPath: abs('vendor/tesseract/worker.min.js'),
    corePath: abs('vendor/tesseract/core'),
    langPath: abs('vendor/tesseract/lang'),
    gzip: true,
    logger: (m) => ocrProgress && ocrProgress(m)
  }).then(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1', user_defined_dpi: '300' });
    return w;
  });
  tessWorker.catch(() => { tessWorker = null; });
  return tessWorker;
}
async function recognize(canvas, onProgress) {
  ocrProgress = onProgress;
  try {
    const w = await getWorker();
    const r = await w.recognize(canvas);
    return (r && r.data && r.data.text) || '';
  } finally { ocrProgress = null; }
}

// ---------- Wechselkurse (EZB über Frankfurter) ----------
async function fetchRate(from, to, date) {
  const key = `${from}>${to}@${date}`;
  if (db.rates[key]) return db.rates[key];
  const d = date >= E.todayISO() ? 'latest' : date;
  let r;
  try { r = await fetch(`https://api.frankfurter.dev/v1/${d}?base=${from}&symbols=${to}`); }
  catch { throw new Error('Kurs nicht abrufbar (offline?).'); }
  if (!r.ok) throw new Error(r.status === 404 ? `Für ${from} gibt es keinen EZB-Kurs.` : 'Kurs nicht abrufbar.');
  const j = await r.json();
  const rate = j && j.rates && j.rates[to];
  if (!(rate > 0)) throw new Error(`Für ${from} gibt es keinen EZB-Kurs.`);
  const val = { rate, date: j.date };
  if (d !== 'latest') { db.rates[key] = val; save(); }
  return val;
}

// ---------- Routing ----------
const parts = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
const go = (h) => { if (location.hash !== h) location.hash = h; else render(); };
const currentTripId = () => { const p = parts(); return p[0] === 't' ? p[1] : null; };
let ed = null; // Formularzustand Ausgabe
const editing = () => !!ed || !!$('.sheet-bg') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));

function header(title, { back, sub, right = '' } = {}) {
  return `<header class="top">
    ${back ? `<a class="iconbtn" href="${esc(back)}" aria-label="Zurück">${icon('back')}</a>` : ''}
    <h1>${esc(title)}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>${right}
  </header>`;
}
function tabs(t, active) {
  const a = (k, href, label, ic) => `<a href="${href}" ${active === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`;
  return `<nav class="tabs"><div class="in">
    ${a('list', `#/t/${t.id}`, 'Ausgaben', 'list')}
    ${a('bal', `#/t/${t.id}/salden`, 'Salden', 'scale')}
    ${a('more', `#/t/${t.id}/mehr`, 'Mehr', 'more')}
  </div></nav>`;
}
function syncPill(t) {
  const n = pendingCount(t);
  if (t.status === 'err') return `<span class="syncpill err"><i></i>${esc(t.err || 'Fehler')}</span>`;
  if (t.status === 'off' || n) return `<span class="syncpill off"><i></i>${n ? `${n} Änderung${n === 1 ? '' : 'en'} warten` : 'Offline'}</span>`;
  return `<span class="syncpill"><i></i>Aktuell</span>`;
}

function render() {
  closeSheet();
  const p = parts();
  const app = $('#app');
  let html;
  if (p[0] !== 't' || !p[2] || !['neu', 'e'].includes(p[2])) ed = null;
  if (!p.length) html = viewHome();
  else if (p[0] === 'neu') html = viewCreate();
  else if (p[0] === 'j') { joinTrip(p[1], p[2]); return; }
  else if (p[0] === 't') {
    const t = T(p[1]);
    if (!t) html = viewMissing();
    else if (!t.trip) { html = header('Reise wird geladen …', { back: '#/' }) + `<main class="noTabs"><div class="empty">${t.err ? esc(t.err) : 'Einen Moment …'}</div><div class="btns"><button class="btn sec" data-act="retry" data-id="${t.id}">Erneut versuchen</button></div></main>`; sync(t.id, { full: true }); }
    else if (!t.me || !member(t, t.me) || p[2] === 'wer') html = viewWho(t);
    else if (!p[2]) html = viewList(t);
    else if (p[2] === 'salden') html = viewBalances(t);
    else if (p[2] === 'mehr') html = viewMore(t);
    else if (p[2] === 'team') html = viewTeam(t);
    else if (p[2] === 'protokoll') { html = viewLog(t); setTimeout(() => loadLog(t), 0); }
    else if (p[2] === 'neu') html = viewEditor(t, null, p[3]);
    else if (p[2] === 'e' && p[4] === 'bearbeiten') html = viewEditor(t, p[3]);
    else if (p[2] === 'e') html = viewEntry(t, p[3]);
    else html = viewMissing();
  } else html = viewMissing();
  app.innerHTML = html;
  const t = T(currentTripId());
  if (t) hydrateImages(t);
  if (t && ed && ed.currency !== t.trip.currency && !ed.rateStr && !ed.rateFor) autoRate(t);
}

// ---------- Ansichten: Start ----------
function viewHome() {
  const ids = db.order.filter((id) => db.trips[id]);
  const rows = ids.map((id) => {
    const t = db.trips[id];
    if (!t.trip) return `<a class="row" href="#/t/${id}"><span class="ico">${icon('wallet')}</span><div class="main"><div class="t">Reise wird geladen …</div></div></a>`;
    const bal = E.balances(t.trip, liveEntries(t));
    const mine = t.me && bal[t.me] ? bal[t.me].balance : 0;
    const total = liveEntries(t).filter((e) => e.kind === 'expense').reduce((s, e) => { const r = E.entryShares(e, t.trip); return s + (r.ok ? r.total : 0); }, 0);
    return `<a class="row" href="#/t/${id}"><span class="ico">${icon('wallet')}</span>
      <div class="main"><div class="t">${esc(t.trip.name)}</div><div class="s">${members(t).length} Personen · ${fmt(total, t.trip.currency)} gesamt</div></div>
      <div class="end">${t.me ? `<div class="amt ${mine > 0 ? 'pos' : mine < 0 ? 'neg' : ''}">${mine > 0 ? '+' : ''}${fmt(mine, t.trip.currency)}</div><div class="s small">dein Saldo</div>` : ''}</div></a>`;
  }).join('');
  return header('Reisekasse') + `<main class="noTabs">
    ${ids.length ? `<h2 class="sec">Deine Reisen</h2><div class="list">${rows}</div>` : `<div class="empty">${icon('wallet')}<p><strong>Noch keine Reise.</strong><br>Leg eine an und schick den Link an deine Mitreisenden – ohne Konto, ohne App-Store.</p></div>`}
    <div class="btns"><a class="btn block" href="#/neu">${icon('plus')}Neue Reise</a></div>
    <div class="card">
      <h2>Einladungslink öffnen</h2>
      <p class="small muted" style="margin:0 0 8px">Du hast einen Link bekommen? Einfügen und los.</p>
      <div class="copyline"><input class="in" id="joinlink" placeholder="https://…#/j/…" autocomplete="off" autocapitalize="off"><button class="btn sec" data-act="joinlink">Öffnen</button></div>
    </div>
    <p class="small muted" style="text-align:center;margin-top:24px">Bons werden auf deinem Gerät gelesen, nicht in der Cloud. Wechselkurse: EZB über frankfurter.dev.</p>
  </main>`;
}

// ---------- Neue Reise ----------
let cf = null;
function viewCreate() {
  if (!cf) cf = { name: '', currency: 'EUR', people: [{ id: E.newId(8), name: '', weight: 1 }, { id: E.newId(8), name: '', weight: 1 }], err: null, busy: false };
  const ppl = cf.people.map((m, i) => `<div class="share-line">
      <input class="in" data-cf="name" data-i="${i}" value="${esc(m.name)}" placeholder="${i === 0 ? 'Dein Name' : 'Name'}" maxlength="40" autocomplete="off" style="flex:1">
      <select class="in" data-cf="weight" data-i="${i}" style="width:96px" aria-label="Gewicht">${weightOptions(m.weight)}</select>
      ${i > 0 ? `<button class="iconbtn" data-act="cf-del" data-i="${i}" aria-label="Entfernen">${icon('trash')}</button>` : '<span style="width:40px"></span>'}
    </div>`).join('');
  return header('Neue Reise', { back: '#/' }) + `<main class="noTabs">
    <div class="card">
      <label class="f"><span>Name der Reise</span><input class="in" data-cf="tname" value="${esc(cf.name)}" placeholder="z. B. Mallorca 2027" maxlength="60" autocomplete="off"></label>
      <label class="f"><span>Hauptwährung</span><select class="in" data-cf="currency">${CURRENCIES.map((c) => `<option ${c === cf.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    </div>
    <div class="card">
      <h2>Wer fährt mit?</h2>
      <p class="small muted" style="margin:0 0 6px">Gewicht: wie viel jemand bei „für alle“ trägt – z. B. Kind = 0,5. Später änderbar, weitere Personen können sich auch selbst eintragen.</p>
      ${ppl}
      <button class="btn ghost" data-act="cf-add">${icon('plus')}Person hinzufügen</button>
    </div>
    ${cf.err ? `<div class="notice err">${esc(cf.err)}</div>` : ''}
    <button class="btn block" data-act="cf-save" ${cf.busy ? 'disabled' : ''}>${cf.busy ? 'Wird angelegt …' : 'Reise anlegen'}</button>
  </main>`;
}
function weightOptions(w) {
  const opts = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
  if (!opts.includes(w)) opts.push(w);
  return opts.sort((a, b) => a - b).map((v) => `<option value="${v}" ${v === w ? 'selected' : ''}>× ${fmtNum(v)}</option>`).join('');
}
async function createTrip() {
  const people = cf.people.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name);
  const name = cf.name.trim();
  if (!name) { cf.err = 'Bitte gib der Reise einen Namen.'; return render(); }
  if (!cf.people[0].name.trim()) { cf.err = 'Bitte trag deinen Namen ein.'; return render(); }
  const names = new Set();
  for (const m of people) {
    const k = m.name.toLowerCase();
    if (names.has(k)) { cf.err = `„${m.name}“ steht doppelt in der Liste.`; return render(); }
    names.add(k);
  }
  cf.busy = true; cf.err = null; render();
  try {
    const res = await fetch('/api/trips', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trip: { name, currency: cf.currency, members: people } }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error((d && d.error) || `Serverfehler (${res.status}).`);
    db.trips[d.id] = { id: d.id, key: d.key, me: people[0].id, trip: d.trip, entries: {}, syncT: 0, pending: [], status: 'ok' };
    db.order.unshift(d.id);
    save();
    cf = null;
    go(`#/t/${d.id}/mehr`);
    setTimeout(() => openInvite(T(d.id)), 50);
  } catch (e) {
    cf.busy = false;
    cf.err = e.message === 'Failed to fetch' ? 'Keine Verbindung – zum Anlegen brauchst du Internet.' : e.message;
    render();
  }
}

// ---------- Beitreten ----------
async function joinTrip(id, key) {
  if (!/^[a-z0-9]{8,16}$/.test(id || '') || !key) { $('#app').innerHTML = viewMissing(); return; }
  let t = T(id);
  if (!t) {
    t = db.trips[id] = { id, key, me: null, trip: null, entries: {}, syncT: 0, pending: [], status: 'off' };
    db.order.unshift(id);
  } else t.key = key;
  save();
  history.replaceState(null, '', `#/t/${id}`);
  render();
  await sync(id, { full: true });
  render();
}

function viewMissing() {
  return header('Nicht gefunden', { back: '#/' }) + `<main class="noTabs"><div class="empty"><p>Diese Seite oder Reise gibt es auf diesem Gerät nicht.<br>Öffne den Einladungslink erneut.</p></div><a class="btn block" href="#/">Zur Übersicht</a></main>`;
}

function viewWho(t) {
  const rows = members(t).map((m) => `<button class="row" data-act="pick-me" data-id="${m.id}">${avatar(t, m.id)}<div class="main"><div class="t">${esc(m.name)}</div></div>${t.me === m.id ? `<span class="badge ok">das bist du</span>` : ''}</button>`).join('');
  return header(t.trip.name, { back: t.me && member(t, t.me) ? `#/t/${t.id}/mehr` : '#/', sub: 'Wer bist du?' }) + `<main class="noTabs">
    <p class="muted">Wähl deinen Namen. Das merkt sich nur dieses Gerät.</p>
    <div class="list">${rows}</div>
    <div class="card"><h2>Nicht in der Liste?</h2>
      <div class="copyline"><input class="in" id="newme" placeholder="Dein Name" maxlength="40" autocomplete="off"><button class="btn" data-act="add-me">Hinzufügen</button></div>
    </div></main>`;
}

// ---------- Ausgabenliste ----------
function entryLine(t, e, cache) {
  const r = cache.get(e.id) || E.entryShares(e, t.trip);
  cache.set(e.id, r);
  const cur = t.trip.currency;
  const total = r.ok ? r.total : 0;
  const mine = r.ok ? (r.shares[t.me] || 0) : 0;
  let ico = `<span class="ico">${icon(e.category || 'sonstiges')}</span>`;
  let title = e.title || 'Ohne Titel';
  let sub = `${esc(mname(t, e.payer))} hat bezahlt`;
  let end = '';
  if (e.kind === 'transfer') {
    ico = `<span class="ico tr">${icon('transfer')}</span>`;
    title = e.title || 'Ausgleich';
    sub = `${esc(mname(t, e.payer))} → ${esc(mname(t, e.to))}`;
  } else if (e.kind === 'income') {
    ico = `<span class="ico in">${icon('income')}</span>`;
    sub = `${esc(mname(t, e.payer))} hat erhalten`;
  }
  if (e.kind !== 'transfer') {
    const paidByMe = e.payer === t.me;
    const effect = (e.kind === 'income' ? -1 : 1) * ((paidByMe ? total : 0) - mine);
    end = effect ? `<div class="s small ${effect > 0 ? 'pos' : 'neg'}">${effect > 0 ? 'du bekommst' : 'dein Anteil'} ${fmt(Math.abs(effect), cur)}</div>` : '<div class="s small">nicht beteiligt</div>';
  }
  const open = e.split && e.split.mode === 'items' && (e.split.items || []).some((it) => !it.who || !it.who.length);
  const foreign = e.currency !== cur ? `<div class="s small">${fmt(e.amount, e.currency)}</div>` : '';
  const pend = (t.pending || []).some((o) => o.eid === e.id);
  return `<a class="row" href="#/t/${t.id}/e/${e.id}">${ico}
    <div class="main"><div class="t">${esc(title)}</div><div class="s">${sub}${open ? ' · <span class="badge">Positionen offen</span>' : ''}${pend ? ' · wartet' : ''}${!r.ok ? ' · <span class="neg">fehlerhaft</span>' : ''}</div></div>
    <div class="end"><div class="amt">${fmt(total, cur)}</div>${foreign}${end}</div></a>`;
}
function viewList(t) {
  const cur = t.trip.currency;
  const entries = liveEntries(t).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const bal = E.balances(t.trip, entries);
  const cache = new Map();
  let spent = 0, myShare = 0;
  for (const e of entries) {
    if (e.kind === 'transfer') continue;
    const r = E.entryShares(e, t.trip);
    cache.set(e.id, r);
    if (!r.ok) continue;
    const sign = e.kind === 'income' ? -1 : 1;
    spent += sign * r.total;
    myShare += sign * (r.shares[t.me] || 0);
  }
  const mine = bal[t.me] ? bal[t.me].balance : 0;
  let body = '';
  let day = null, group = [];
  const flushDay = () => {
    if (!group.length) return;
    body += `<div class="daylabel"><span>${esc(dayLabel(day))}</span></div><div class="list">${group.join('')}</div>`;
    group = [];
  };
  for (const e of entries) {
    if (e.date !== day) { flushDay(); day = e.date; }
    group.push(entryLine(t, e, cache));
  }
  flushDay();
  return header(t.trip.name, { back: '#/', sub: syncPill(t) }) + `<main>
    <div class="stats">
      <div class="stat"><div class="l">Gesamtkosten</div><div class="v">${fmt(spent, cur)}</div></div>
      <div class="stat"><div class="l">Dein Saldo</div><div class="v ${mine > 0 ? 'pos' : mine < 0 ? 'neg' : ''}">${mine > 0 ? '+' : ''}${fmt(mine, cur)}</div></div>
    </div>
    <p class="small muted" style="margin:6px 4px 0">Dein Anteil an allen Kosten: ${fmt(myShare, cur)}</p>
    ${body || `<div class="empty">${icon('receipt')}<p><strong>Noch keine Ausgaben.</strong><br>Tipp auf „Ausgabe“ – oder fotografier direkt einen Bon.</p></div>`}
  </main>
  <a class="fab" href="#/t/${t.id}/neu">${icon('plus')}Ausgabe</a>` + tabs(t, 'list');
}

// ---------- Ausgabe ansehen ----------
function viewEntry(t, eid) {
  const e = t.entries[eid];
  if (!e || e.deleted) return header('Gelöscht', { back: `#/t/${t.id}` }) + `<main class="noTabs"><div class="empty">Diese Ausgabe gibt es nicht mehr.</div></main>`;
  const cur = t.trip.currency;
  const r = E.entryShares(e, t.trip);
  const cat = E.CATEGORIES.find((c) => c.id === e.category);
  const kindLabel = e.kind === 'transfer' ? 'Überweisung' : e.kind === 'income' ? 'Einnahme' : (cat ? cat.label : 'Ausgabe');
  let html = header(e.title || (e.kind === 'transfer' ? 'Ausgleich' : 'Ausgabe'), { back: `#/t/${t.id}`, right: `<a class="iconbtn" href="#/t/${t.id}/e/${e.id}/bearbeiten" aria-label="Bearbeiten">${icon('edit')}</a>` });
  html += `<main class="noTabs"><div class="hero">
      <div class="muted small">${esc(kindLabel)} · ${esc(dayLabel(e.date))}</div>
      <div class="big">${fmt(r.ok ? r.total : 0, cur)}</div>
      ${e.currency !== cur ? `<div class="muted small">${fmt(e.amount, e.currency)} · 1 ${e.currency} = ${fmtNum(e.rate)} ${cur}</div>` : ''}
      <div class="muted" style="margin-top:6px">${e.kind === 'transfer' ? `${esc(mname(t, e.payer))} → ${esc(mname(t, e.to))}` : `${e.kind === 'income' ? 'erhalten von' : 'bezahlt von'} <strong>${esc(mname(t, e.payer))}</strong>`}</div>
    </div>`;
  if (!r.ok) html += `<div class="notice err">${r.errors.map(esc).join('<br>')}</div>`;

  if (e.split && e.split.mode === 'items' && e.kind !== 'transfer') {
    const items = e.split.items || [];
    const open = items.filter((it) => !it.who || !it.who.length).length;
    html += `<h2 class="sec">Positionen ${open ? `<span class="badge">${open} offen</span>` : '<span class="badge ok">alle zugeordnet</span>'}</h2>
      <p class="small muted" style="margin:0 4px 6px">Tipp auf „Meins“ bei allem, was du hattest. Geteiltes wird zu gleichen Teilen verrechnet.</p>
      <div class="list">${items.map((it) => {
        const mineOn = (it.who || []).includes(t.me);
        const who = (it.who || []).map((id) => mname(t, id)).join(', ');
        return `<div class="claim"><div class="main"><div class="t">${esc(it.name || 'Position')}</div><div class="s small">${who ? esc(who) : '<span class="muted">noch niemand</span>'}</div></div>
          <div class="amt num">${fmt(it.amount, e.currency)}</div>
          <button class="tog" data-act="claim" data-eid="${e.id}" data-item="${it.id}" aria-pressed="${mineOn}">${mineOn ? '✓ Meins' : 'Meins'}</button></div>`;
      }).join('')}</div>`;
    const assigned = items.reduce((s, it) => s + ((it.who && it.who.length) ? it.amount : 0), 0);
    const rest = e.amount - assigned;
    if (rest) html += `<p class="small muted" style="margin:0 4px">Rest ${fmt(rest, e.currency)} (nicht zugeordnet, Trinkgeld usw.) wird gleich verteilt auf: ${esc((e.split.among || []).map((id) => mname(t, id)).join(', ') || '–')}.</p>`;
  }

  if (r.ok && e.kind !== 'transfer') {
    const lines = members(t).filter((m) => r.shares[m.id]).map((m) => `<div class="share-line" style="padding:10px 16px">${avatar(t, m.id)}<span class="nm">${esc(m.name)}${m.id === t.me ? ' (du)' : ''}</span><span class="v">${fmt(r.shares[m.id], cur)}</span></div>`).join('');
    html += `<h2 class="sec">Aufteilung</h2><div class="list">${lines || '<div class="share-line" style="padding:10px 16px">Niemand</div>'}</div>`;
  }
  if (e.receipt) html += `<h2 class="sec">Bon</h2><img class="receipt-full" data-img="${esc(e.receipt)}" alt="Bon">`;
  if (e.note) html += `<h2 class="sec">Notiz</h2><div class="card" style="white-space:pre-wrap">${esc(e.note)}</div>`;
  html += `<p class="small muted" style="margin:16px 4px">${e.createdBy ? `Angelegt von ${esc(mname(t, e.createdBy))}${e.createdAt ? ' ' + esc(timeAgo(e.createdAt)) : ''}` : ''}${e.updatedBy && e.updatedAt !== e.createdAt ? ` · zuletzt geändert von ${esc(mname(t, e.updatedBy))} ${esc(timeAgo(e.updatedAt))}` : ''}</p>
    <div class="btns"><a class="btn sec" href="#/t/${t.id}/e/${e.id}/bearbeiten">${icon('edit')}Bearbeiten</a></div></main>`;
  return html;
}

function claimItem(t, eid, itemId) {
  const e = t.entries[eid];
  if (!e || !e.split || !e.split.items) return;
  const it = e.split.items.find((x) => x.id === itemId);
  if (!it) return;
  const on = !(it.who || []).includes(t.me);
  const order = members(t).map((m) => m.id);
  const who = new Set(it.who || []);
  if (on) who.add(t.me); else who.delete(t.me);
  it.who = order.filter((id) => who.has(id));
  queue(t, { type: 'claim', eid, item: itemId, member: t.me, on });
  render();
}

// ---------- Ausgabe anlegen/bearbeiten ----------
function newDraft(t, kind) {
  const ids = members(t).map((m) => m.id);
  const currency = t.lastCur && CURRENCIES.includes(t.lastCur) ? t.lastCur : t.trip.currency;
  const lastRate = currency !== t.trip.currency && t.lastRates ? t.lastRates[currency] : null;
  return {
    tripId: t.id, eid: null, kind: ['income', 'transfer'].includes(kind) ? kind : 'expense',
    amountStr: '', currency,
    rateStr: lastRate ? fmtNum(lastRate) : '', rateInfo: lastRate ? 'Zuletzt verwendeter Kurs.' : '', rateFor: lastRate ? `${currency}@${E.todayISO()}` : '', title: '', date: E.todayISO(), category: 'sonstiges',
    payer: t.me, to: ids.find((id) => id !== t.me) || '', mode: 'shares', among: ids.slice(),
    exact: {}, items: [], receipt: null, note: '', ocr: null, tried: false, delArm: false
  };
}
function draftFrom(t, e) {
  const d = newDraft(t, e.kind);
  Object.assign(d, {
    eid: e.id, amountStr: E.formatAmount(e.amount, e.currency), currency: e.currency,
    rateStr: e.currency !== t.trip.currency && e.rate ? fmtNum(e.rate) : '', rateFor: `${e.currency}@${e.date}`,
    title: e.title || '', date: e.date, category: e.category || 'sonstiges', payer: e.payer, to: e.to || d.to,
    mode: (e.split && e.split.mode) || 'shares', among: (e.split && e.split.among) ? e.split.among.slice() : d.among,
    exact: Object.fromEntries(Object.entries((e.split && e.split.exact) || {}).map(([k, v]) => [k, E.formatAmount(v, e.currency)])),
    items: ((e.split && e.split.items) || []).map((it) => ({ id: it.id, name: it.name, amountStr: E.formatAmount(it.amount, e.currency), who: (it.who || []).slice() })),
    receipt: e.receipt || null, note: e.note || ''
  });
  return d;
}
function buildEntry(t, d) {
  const amount = E.toMinor(d.amountStr, d.currency);
  const foreign = d.currency !== t.trip.currency;
  const entry = {
    id: d.eid || E.newId(10), kind: d.kind, title: d.title.trim(), date: d.date, category: d.kind === 'transfer' ? 'sonstiges' : d.category,
    amount: amount == null ? 0 : amount, currency: d.currency, rate: foreign ? parseNum(d.rateStr) : null, payer: d.payer
  };
  if (d.kind === 'transfer') {
    entry.to = d.to;
    entry.split = { mode: 'shares', among: [d.to] };
  } else {
    const split = { mode: d.mode, among: d.among.slice() };
    if (d.mode === 'exact') {
      split.exact = {};
      for (const m of members(t)) {
        const v = E.toMinor(d.exact[m.id] || '', d.currency);
        if (v) split.exact[m.id] = v;
      }
    }
    if (d.mode === 'items') {
      split.items = d.items.map((it) => ({ id: it.id, name: it.name.trim(), amount: E.toMinor(it.amountStr, d.currency) ?? 0, who: it.who.slice() }))
        .filter((it) => it.name || it.amount);
    }
    entry.split = split;
  }
  if (d.receipt) entry.receipt = d.receipt;
  if (d.note.trim()) entry.note = d.note.trim();
  return entry;
}

function viewEditor(t, eid, kind) {
  if (!ed || ed.tripId !== t.id || (eid && ed.eid !== eid) || (!eid && ed.eid)) {
    if (eid) {
      const e = t.entries[eid];
      if (!e || e.deleted) return viewMissing();
      ed = draftFrom(t, e);
    } else ed = newDraft(t, kind);
  }
  const d = ed;
  const back = d.eid ? `#/t/${t.id}/e/${d.eid}` : `#/t/${t.id}`;
  const cur = t.trip.currency;
  const foreign = d.currency !== cur;
  const curOpts = [...new Set([cur, ...CURRENCIES, d.currency])].map((c) => `<option ${c === d.currency ? 'selected' : ''}>${c}</option>`).join('');
  const memberOpts = (sel, exclude) => members(t).filter((m) => m.id !== exclude).map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}${m.id === t.me ? ' (du)' : ''}</option>`).join('');
  const seg = (k, label) => `<button type="button" data-act="ed-kind" data-v="${k}" aria-pressed="${d.kind === k}">${label}</button>`;

  let h = header(d.eid ? 'Bearbeiten' : d.kind === 'transfer' ? 'Neue Überweisung' : d.kind === 'income' ? 'Neue Einnahme' : 'Neue Ausgabe', { back });
  h += `<main class="noTabs"><form id="edform" autocomplete="off" onsubmit="return false">
    <div class="seg" role="group" aria-label="Art">${seg('expense', 'Ausgabe')}${seg('income', 'Einnahme')}${seg('transfer', 'Überweisung')}</div>`;

  if (d.kind !== 'transfer') {
    h += `<div class="card" style="margin-top:12px">
      <input type="file" id="rcfile" accept="image/*" class="sr" tabindex="-1">
      ${receiptBlock(t, d)}
    </div>`;
  }
  h += `<div class="card">
    <label class="f" style="margin-top:0"><span>Betrag</span>
      <div class="amountline"><input class="in big" data-ed="amountStr" inputmode="decimal" value="${esc(d.amountStr)}" placeholder="0,00" aria-label="Betrag">
      <select class="in" data-ed="currency" aria-label="Währung">${curOpts}</select></div></label>
    ${foreign ? `<label class="f"><span>Kurs: 1 ${esc(d.currency)} = … ${esc(cur)}</span>
      <div class="copyline"><input class="in" data-ed="rateStr" inputmode="decimal" value="${esc(d.rateStr)}" placeholder="z. B. 1,0612"><button type="button" class="btn sec" data-act="ed-rate">EZB-Kurs</button></div>
      <div class="small muted" id="rateinfo" style="margin:6px 2px 0">${esc(d.rateInfo)}</div></label>` : ''}
    ${d.kind !== 'transfer' ? `<label class="f"><span>Wofür?</span><input class="in" data-ed="title" value="${esc(d.title)}" placeholder="z. B. Abendessen, Supermarkt, Ferienwohnung" maxlength="80"></label>` : `<label class="f"><span>Vermerk (optional)</span><input class="in" data-ed="title" value="${esc(d.title)}" placeholder="z. B. Ausgleich" maxlength="80"></label>`}
    <div class="grid2">
      <label class="f"><span>${d.kind === 'income' ? 'Erhalten von' : d.kind === 'transfer' ? 'Von' : 'Bezahlt von'}</span><select class="in" data-ed="payer">${memberOpts(d.payer)}</select></label>
      ${d.kind === 'transfer' ? `<label class="f"><span>An</span><select class="in" data-ed="to">${memberOpts(d.to, d.payer)}</select></label>` : `<label class="f"><span>Datum</span><input class="in" type="date" data-ed="date" value="${esc(d.date)}"></label>`}
    </div>
    ${d.kind === 'transfer' ? `<label class="f"><span>Datum</span><input class="in" type="date" data-ed="date" value="${esc(d.date)}"></label>` : ''}
  </div>`;

  if (d.kind !== 'transfer') {
    h += `<div class="card"><div class="flabel">Kategorie</div><div class="chips">${E.CATEGORIES.map((c) => `<button type="button" class="chip" data-act="ed-cat" data-v="${c.id}" aria-pressed="${d.category === c.id}">${icon(c.id)}${esc(c.label)}</button>`).join('')}</div></div>`;
    h += `<div class="card"><div class="flabel">Aufteilen</div>
      <div class="seg" role="group" aria-label="Aufteilung">
        <button type="button" data-act="ed-mode" data-v="shares" aria-pressed="${d.mode === 'shares'}">Gleich</button>
        <button type="button" data-act="ed-mode" data-v="exact" aria-pressed="${d.mode === 'exact'}">Beträge</button>
        <button type="button" data-act="ed-mode" data-v="items" aria-pressed="${d.mode === 'items'}">Positionen</button>
      </div><div class="split">${splitBlock(t, d)}</div></div>`;
  }
  h += `<div class="card"><h2>Vorschau</h2><div id="preview">${previewHtml(t, d)}</div></div>
    <details class="more" ${d.note ? 'open' : ''}><summary>Notiz</summary><textarea class="in" data-ed="note" maxlength="500" placeholder="z. B. inkl. Kurtaxe">${esc(d.note)}</textarea></details>
    <div id="ederr"></div>
    <div class="btns">
      <button type="button" class="btn block" data-act="ed-save">${icon('check')}Speichern</button>
      ${d.eid ? `<button type="button" class="btn danger block" data-act="ed-del">${icon('trash')}${d.delArm ? 'Wirklich löschen?' : 'Löschen'}</button>` : ''}
    </div>
  </form></main>`;
  return h;
}

function receiptBlock(t, d) {
  const o = d.ocr;
  let h = '';
  if (d.receipt) {
    h += `<div class="receipt-thumb"><img data-img="${esc(d.receipt)}" alt="Bon"><div class="main" style="flex:1"><div class="t">Bon angehängt</div>
      <div class="small muted">${o && o.state === 'run' ? esc(o.msg) : o && o.state === 'done' ? esc(o.msg) : 'Wird mit der Ausgabe gespeichert.'}</div>
      ${o && o.state === 'run' ? `<div class="progress"><i style="width:${Math.round((o.p || 0) * 100)}%"></i></div>` : ''}</div>
      <button type="button" class="iconbtn" data-act="ed-rc-del" aria-label="Bon entfernen">${icon('trash')}</button></div>`;
  }
  if (o && o.state === 'err') h += `<div class="notice err">${esc(o.msg)}</div>`;
  if (o && o.state === 'done' && o.items && o.items.length && d.mode !== 'items') {
    h += `<div class="notice info">${o.items.length} Position${o.items.length === 1 ? '' : 'en'} erkannt (${esc(fmt(o.items.reduce((s, i) => s + i.amount, 0), 'EUR').replace(/\s?€/, ''))}). Jede Person kann sich ihre Positionen selbst zuordnen.
      <div class="btns" style="margin-top:8px"><button type="button" class="btn" data-act="ed-take-items">Positionen übernehmen</button></div></div>`;
  }
  if (o && o.state === 'done' && o.text) h += `<details class="more"><summary>Erkannter Text</summary><pre class="kbd" style="white-space:pre-wrap;margin:8px 0 0">${esc(o.text)}</pre></details>`;
  h += `<div class="btns" style="${d.receipt ? '' : 'margin-top:0'}"><label for="rcfile" class="btn sec block" role="button">${icon('camera')}${d.receipt ? 'Anderen Bon wählen' : 'Bon fotografieren oder wählen'}</label></div>`;
  if (!d.receipt) h += `<p class="small muted" style="margin:8px 2px 0">Betrag, Datum, Geschäft und Positionen werden auf deinem Gerät erkannt – bitte danach kurz prüfen.</p>`;
  return h;
}

function splitBlock(t, d) {
  const chips = (sel, act, extra = '') => members(t).map((m) => `<button type="button" class="chip" data-act="${act}" data-id="${m.id}" ${extra} aria-pressed="${sel.includes(m.id)}">${esc(m.name)}${m.weight !== 1 ? ` <span class="w">×${fmtNum(m.weight)}</span>` : ''}</button>`).join('');
  if (d.mode === 'shares') {
    return `<div class="chips">${chips(d.among, 'ed-among')}</div>
      <div class="btns" style="margin-top:8px"><button type="button" class="btn ghost" data-act="ed-all">Alle</button><button type="button" class="btn ghost" data-act="ed-none">Keiner</button></div>`;
  }
  if (d.mode === 'exact') {
    return members(t).map((m) => `<div class="share-line"><span class="nm">${esc(m.name)}</span><input class="in" data-exact="${m.id}" inputmode="decimal" value="${esc(d.exact[m.id] || '')}" placeholder="0,00"></div>`).join('') + `<div class="rest" id="rest"></div>`;
  }
  // Positionen
  const items = d.items.map((it, i) => `<div class="item">
      <div class="top"><input class="in nm" data-item="${i}" data-k="name" value="${esc(it.name)}" placeholder="Position" maxlength="80">
      <input class="in am" data-item="${i}" data-k="amountStr" inputmode="decimal" value="${esc(it.amountStr)}" placeholder="0,00">
      <button type="button" class="iconbtn" data-act="ed-item-del" data-i="${i}" aria-label="Position löschen">${icon('trash')}</button></div>
      <div class="chips">${members(t).map((m) => `<button type="button" class="chip" data-act="ed-item-who" data-i="${i}" data-id="${m.id}" aria-pressed="${it.who.includes(m.id)}">${esc(m.name)}</button>`).join('')}</div>
    </div>`).join('');
  return `<p class="small muted" style="margin:0 0 6px">Ordne Positionen zu oder lass sie offen – die anderen können sich später selbst eintragen.</p>
    ${items || '<p class="muted small">Noch keine Positionen.</p>'}
    <button type="button" class="btn ghost" data-act="ed-item-add">${icon('plus')}Position</button>
    <div class="rest" id="rest"></div>
    <div class="flabel" style="margin-top:12px">Rest und offene Positionen gleich verteilen auf</div>
    <div class="chips">${chips(d.among, 'ed-among')}</div>`;
}

function previewHtml(t, d) {
  const entry = buildEntry(t, d);
  const cur = t.trip.currency;
  if (!entry.amount) return '<p class="muted small" style="margin:0">Betrag eingeben.</p>';
  const r = E.entryShares(entry, t.trip);
  if (!r.ok) return `<p class="small neg" style="margin:0">${r.errors.map(esc).join('<br>')}</p>`;
  if (d.kind === 'transfer') return `<p style="margin:0">${esc(mname(t, d.payer))} → ${esc(mname(t, d.to))}: <strong>${fmt(r.total, cur)}</strong></p>`;
  return members(t).filter((m) => r.shares[m.id]).map((m) => `<div class="share-line"><span class="nm">${esc(m.name)}</span><span class="v">${fmt(r.shares[m.id], cur)}</span></div>`).join('')
    + (d.currency !== cur ? `<p class="small muted" style="margin:6px 0 0">Summe ${fmt(r.total, cur)}</p>` : '');
}
function restHtml(t, d) {
  const amount = E.toMinor(d.amountStr, d.currency) || 0;
  if (d.mode === 'exact') {
    const sum = members(t).reduce((s, m) => s + (E.toMinor(d.exact[m.id] || '', d.currency) || 0), 0);
    const diff = amount - sum;
    return diff === 0 ? '✓ Passt genau.' : diff > 0 ? `Noch ${fmt(diff, d.currency)} zu verteilen.` : `${fmt(-diff, d.currency)} zu viel.`;
  }
  if (d.mode === 'items') {
    const all = d.items.reduce((s, it) => s + (E.toMinor(it.amountStr, d.currency) || 0), 0);
    const assigned = d.items.reduce((s, it) => s + (it.who.length ? (E.toMinor(it.amountStr, d.currency) || 0) : 0), 0);
    return `Positionen: ${fmt(all, d.currency)} · zugeordnet: ${fmt(assigned, d.currency)} · <strong>Rest gleich verteilt: ${fmt(amount - assigned, d.currency)}</strong>${all > amount ? ' <span class="neg">– Positionen größer als der Betrag?</span>' : ''}`;
  }
  return '';
}
function updatePreview() {
  const t = T(ed.tripId);
  const p = $('#preview');
  if (p) p.innerHTML = previewHtml(t, ed);
  const r = $('#rest');
  if (r) r.innerHTML = restHtml(t, ed);
}
async function autoRate(t, force = false) {
  const d = ed;
  if (!d || d.currency === t.trip.currency) return;
  const key = `${d.currency}@${d.date}`;
  if (!force && d.rateFor === key && d.rateStr) return;
  d.rateFor = key;
  d.rateInfo = 'Kurs wird geladen …';
  const info = $('#rateinfo'); if (info) info.textContent = d.rateInfo;
  try {
    const r = await fetchRate(d.currency, t.trip.currency, d.date);
    if (ed !== d) return;
    d.rateStr = fmtNum(Number(r.rate.toPrecision(6)));
    d.rateInfo = `EZB-Referenzkurs vom ${new Date(r.date + 'T12:00').toLocaleDateString('de-DE')}. Bei Kartenzahlung weicht der Bankkurs leicht ab – du kannst ihn anpassen.`;
  } catch (e) {
    if (ed !== d) return;
    d.rateInfo = `${e.message} Bitte Kurs selbst eintragen.`;
  }
  const inp = document.querySelector('[data-ed="rateStr"]'); if (inp && document.activeElement !== inp) inp.value = d.rateStr;
  const info2 = $('#rateinfo'); if (info2) info2.textContent = d.rateInfo;
  updatePreview();
}

async function onReceiptFile(file) {
  const t = T(ed.tripId);
  const d = ed;
  if (!file) return;
  if (!/^image\//.test(file.type || 'image/')) { toast('Bitte ein Foto wählen.'); return; }
  d.ocr = { state: 'run', p: 0, msg: 'Bild wird vorbereitet …' };
  rerenderEditor();
  let bmp;
  try {
    bmp = await loadBitmap(file);
    const jpg = await toJpeg(bmp, 1500, 0.72);
    const local = E.newId(12);
    await idb.put(`${t.id}/${local}`, jpg);
    d.receipt = 'local:' + local;
  } catch (e) {
    d.ocr = { state: 'err', msg: 'Das Bild konnte nicht gelesen werden: ' + e.message };
    return rerenderEditor();
  }
  rerenderEditor();
  const setP = (m) => {
    if (ed !== d || !d.ocr || d.ocr.state !== 'run') return;
    const lbl = { 'loading tesseract core': 'Texterkennung wird geladen …', 'loading language traineddata': 'Sprachdaten werden geladen (einmalig) …', 'initializing api': 'Wird vorbereitet …', 'recognizing text': 'Text wird erkannt …' }[m.status];
    if (lbl) d.ocr.msg = lbl;
    if (typeof m.progress === 'number') d.ocr.p = m.progress;
    const bar = $('.progress i'); if (bar) bar.style.width = Math.round(d.ocr.p * 100) + '%';
    const msg = $('.receipt-thumb .small'); if (msg) msg.textContent = d.ocr.msg;
  };
  try {
    const text = await Promise.race([
      recognize(prepOcr(bmp), setP),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Die Texterkennung hat zu lange gebraucht.')), 120000))
    ]);
    if (ed !== d) return;
    const r = E.parseReceipt(text);
    const found = [];
    if (r.currency && r.currency !== d.currency) { d.currency = r.currency; found.push('Währung'); }
    if (r.total) { d.amountStr = E.formatAmount(r.total, 'EUR'); found.push('Betrag'); }
    if (r.date) { d.date = r.date; found.push('Datum'); }
    if (r.merchant && !d.title.trim()) { d.title = r.merchant; found.push('Geschäft'); }
    d.ocr = { state: 'done', items: r.items, text, msg: found.length ? `Erkannt: ${found.join(', ')}. Bitte prüfen.` : 'Nichts Eindeutiges erkannt – bitte von Hand eintragen.' };
    if (d.mode === 'items' && !d.items.length && r.items.length) takeItems(r.items);
    rerenderEditor();
    autoRate(t);
  } catch (e) {
    if (ed !== d) return;
    d.ocr = { state: 'err', msg: e.message + ' Der Bon bleibt angehängt, Betrag bitte von Hand eintragen.' };
    rerenderEditor();
  }
}
function takeItems(items) {
  ed.mode = 'items';
  ed.items = items.map((it) => ({ id: E.newId(8), name: it.name, amountStr: E.formatAmount(it.amount, 'EUR'), who: [] }));
}
function rerenderEditor() {
  if (!ed) return;
  const y = window.scrollY;
  const t = T(ed.tripId);
  $('#app').innerHTML = viewEditor(t, ed.eid);
  hydrateImages(t);
  updatePreview();
  window.scrollTo(0, y);
}
function saveDraft() {
  const t = T(ed.tripId);
  const d = ed;
  d.tried = true;
  if (d.kind !== 'transfer' && !d.title.trim()) {
    $('#ederr').innerHTML = '<div class="notice err">Bitte gib an, wofür das Geld war.</div>';
    return;
  }
  const entry = buildEntry(t, d);
  const errors = E.validateEntry(entry, t.trip);
  if (errors.length) {
    $('#ederr').innerHTML = `<div class="notice err">${errors.map(esc).join('<br>')}</div>`;
    $('#ederr').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const old = d.eid ? t.entries[d.eid] : null;
  if (old) { entry.createdAt = old.createdAt; entry.createdBy = old.createdBy; }
  else { entry.createdAt = Date.now(); entry.createdBy = t.me; }
  entry.updatedAt = Date.now(); entry.updatedBy = t.me;
  if (entry.receipt && entry.receipt.startsWith('local:') && (!old || old.receipt !== entry.receipt)) {
    t.pending.push({ type: 'img', local: entry.receipt.slice(6) });
  }
  t.entries[entry.id] = entry;
  t.lastCur = d.currency;
  if (entry.rate) t.lastRates = { ...(t.lastRates || {}), [d.currency]: entry.rate };
  ed = null;
  queue(t, { type: 'put', eid: entry.id, entry });
  go(`#/t/${t.id}`);
  toast(old ? 'Gespeichert.' : 'Ausgabe gespeichert.');
}
function deleteDraft() {
  const t = T(ed.tripId);
  if (!ed.delArm) { ed.delArm = true; rerenderEditor(); return; }
  const eid = ed.eid;
  t.entries[eid] = { id: eid, deleted: true, updatedAt: Date.now(), updatedBy: t.me };
  ed = null;
  queue(t, { type: 'del', eid });
  go(`#/t/${t.id}`);
  toast('Gelöscht. Im Protokoll lässt es sich wiederherstellen.');
}

// ---------- Salden ----------
function viewBalances(t) {
  const cur = t.trip.currency;
  const entries = liveEntries(t);
  const bal = E.balances(t.trip, entries);
  const order = members(t).map((m) => m.id);
  const max = Math.max(1, ...order.map((id) => Math.abs(bal[id].balance)));
  const rows = members(t).map((m) => {
    const b = bal[m.id];
    const w = Math.round((Math.abs(b.balance) / max) * 50);
    return `<div class="bal">${avatar(t, m.id)}<div class="main" style="flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(m.name)}${m.id === t.me ? ' (du)' : ''}</strong><strong class="num ${b.balance > 0 ? 'pos' : b.balance < 0 ? 'neg' : ''}">${b.balance > 0 ? '+' : ''}${fmt(b.balance, cur)}</strong></div>
      <div class="small muted">bezahlt ${fmt(b.paid, cur)} · Anteil ${fmt(b.share, cur)}${b.sent - b.received > 0 ? ` · überwiesen ${fmt(b.sent - b.received, cur)}` : b.sent - b.received < 0 ? ` · erhalten ${fmt(b.received - b.sent, cur)}` : ''}</div>
      <div class="bar"><i class="${b.balance >= 0 ? 'p' : 'n'}" style="width:${w}%"></i></div></div></div>`;
  }).join('');
  const plan = E.settle(bal, order);
  const planRows = plan.map((s, i) => `<div class="settle">${avatar(t, s.from)}<div class="main"><div><strong>${esc(mname(t, s.from))}</strong> <span class="arrow">→</span> <strong>${esc(mname(t, s.to))}</strong></div><div class="num">${fmt(s.amount, cur)}</div></div>
      <button class="btn sec" data-act="pay" data-i="${i}">${s.from === t.me ? 'Bezahlen' : 'Details'}</button></div>`).join('');
  const cats = E.categoryTotals(t.trip, entries).filter((c) => c.amount > 0);
  const cmax = Math.max(1, ...cats.map((c) => c.amount));
  const catRows = cats.map((c) => `<div class="catbar"><div class="lbl"><span>${esc((E.CATEGORIES.find((x) => x.id === c.category) || { label: c.category }).label)}</span><span class="num">${fmt(c.amount, cur)}</span></div><div class="track"><i style="width:${(c.amount / cmax) * 100}%"></i></div></div>`).join('');
  return header('Salden', { back: '#/', sub: esc(t.trip.name) }) + `<main>
    <h2 class="sec">Wer liegt vorn, wer hinten?</h2><div class="list">${rows}</div>
    <h2 class="sec">So wird ausgeglichen</h2>
    ${plan.length ? `<div class="list">${planRows}</div><p class="small muted" style="margin:0 4px">Mit ${plan.length} Überweisung${plan.length === 1 ? '' : 'en'} ist alles ausgeglichen. Nach dem Bezahlen „Als bezahlt markieren“.</p>` : '<div class="card">Alles ausgeglichen.</div>'}
    ${catRows ? `<h2 class="sec">Kosten nach Kategorie</h2><div class="list">${catRows}</div>` : ''}
  </main>` + tabs(t, 'bal');
}
function openPay(t, i) {
  const cur = t.trip.currency;
  const plan = E.settle(E.balances(t.trip, liveEntries(t)), members(t).map((m) => m.id));
  const s = plan[i];
  if (!s) return;
  const to = member(t, s.to);
  let h = `<h2>${esc(mname(t, s.from))} → ${esc(to.name)}</h2><div class="hero" style="padding-top:0"><div class="big">${fmt(s.amount, cur)}</div></div>`;
  const pp = to.paypal ? E.paypalLink(to.paypal, s.amount, cur) : null;
  if (pp) h += `<a class="btn block" href="${esc(pp)}" target="_blank" rel="noopener">Mit PayPal bezahlen</a><p class="small muted">Öffnet PayPal mit vorausgefülltem Betrag (Freunde &amp; Familie wählen).</p>`;
  if (to.iban && E.validIban(to.iban)) {
    if (cur === 'EUR') {
      let qr = null;
      try { qr = qrSvg(E.epcPayload({ name: to.name, iban: to.iban, bic: to.bic || '', amount: s.amount, text: `Reisekasse ${t.trip.name}` })); } catch { qr = null; }
      if (qr) h += `<div class="card"><h2>GiroCode</h2><p class="small muted" style="margin:0">Mit der Banking-App scannen – Empfänger, IBAN und Betrag sind ausgefüllt.</p><div class="qr">${qr}</div></div>`;
    }
    h += `<div class="card"><div class="flabel">IBAN von ${esc(to.name)}</div><div class="copyline"><input class="in kbd" readonly value="${esc(E.formatIban(to.iban))}"><button class="btn sec" data-act="copy" data-v="${esc(E.normIban(to.iban))}">${icon('copy')}</button></div></div>`;
  }
  if (!pp && !to.iban) h += `<div class="notice info">${esc(to.name)} hat noch kein PayPal und keine IBAN hinterlegt (Mehr › Personen).</div>`;
  h += `<div class="btns"><button class="btn sec block" data-act="mark-paid" data-i="${i}">${icon('check')}Als bezahlt markieren</button></div>`;
  openSheet(h);
}
function markPaid(t, i) {
  const plan = E.settle(E.balances(t.trip, liveEntries(t)), members(t).map((m) => m.id));
  const s = plan[i];
  if (!s) return;
  const entry = {
    id: E.newId(10), kind: 'transfer', title: 'Ausgleich', date: E.todayISO(), category: 'sonstiges',
    amount: s.amount, currency: t.trip.currency, rate: null, payer: s.from, to: s.to, split: { mode: 'shares', among: [s.to] },
    createdAt: Date.now(), createdBy: t.me, updatedAt: Date.now(), updatedBy: t.me
  };
  t.entries[entry.id] = entry;
  queue(t, { type: 'put', eid: entry.id, entry });
  closeSheet();
  render();
  toast('Als bezahlt eingetragen.');
}
function qrSvg(text) {
  if (typeof window.qrcode !== 'function') return null;
  window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
  const q = window.qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><path d="${d}"/></svg>`;
}

// ---------- Mehr ----------
function viewMore(t) {
  return header('Mehr', { back: '#/', sub: esc(t.trip.name) }) + `<main>
    <div class="list">
      <button class="row" data-act="invite"><span class="ico">${icon('share')}</span><div class="main"><div class="t">Mitreisende einladen</div><div class="s">Link oder QR-Code teilen</div></div></button>
      <a class="row" href="#/t/${t.id}/team"><span class="ico">${icon('users')}</span><div class="main"><div class="t">Personen</div><div class="s">${members(t).length} · Gewicht, PayPal, IBAN</div></div></a>
      <a class="row" href="#/t/${t.id}/wer"><span class="ico">${icon('user')}</span><div class="main"><div class="t">Ich bin …</div><div class="s">${esc(mname(t, t.me))}</div></div></a>
    </div>
    <div class="list">
      <a class="row" href="#/t/${t.id}/protokoll"><span class="ico">${icon('history')}</span><div class="main"><div class="t">Protokoll</div><div class="s">Wer hat was geändert · wiederherstellen</div></div></a>
      <button class="row" data-act="export"><span class="ico">${icon('download')}</span><div class="main"><div class="t">Export (CSV)</div><div class="s">Für Excel, Numbers, Google Tabellen</div></div></button>
      <button class="row" data-act="trip-edit"><span class="ico">${icon('edit')}</span><div class="main"><div class="t">Reise umbenennen</div><div class="s">${esc(t.trip.name)} · ${esc(t.trip.currency)}</div></div></button>
    </div>
    <div class="list">
      <button class="row" data-act="sync-now"><span class="ico tr">${icon('history')}</span><div class="main"><div class="t">Jetzt abgleichen</div><div class="s">${syncPill(t)}</div></div></button>
      <button class="row" data-act="forget"><span class="ico in">${icon('trash')}</span><div class="main"><div class="t neg">Von diesem Gerät entfernen</div><div class="s">Die Reise bleibt für die anderen erhalten</div></div></button>
    </div>
  </main>` + tabs(t, 'more');
}
function openInvite(t) {
  if (!t) return;
  const link = shareLink(t);
  openSheet(`<h2>Mitreisende einladen</h2>
    <p class="small muted" style="margin:0">Wer den Link hat, kann Ausgaben sehen und eintragen. Nur an Mitreisende schicken.</p>
    <div class="qr">${qrSvg(link) || ''}</div>
    <div class="copyline"><input class="in kbd" readonly value="${esc(link)}"><button class="btn sec" data-act="copy" data-v="${esc(link)}" aria-label="Kopieren">${icon('copy')}</button></div>
    <div class="btns">${navigator.share ? `<button class="btn block" data-act="share-link">${icon('share')}Teilen</button>` : ''}</div>`);
}

function viewTeam(t) {
  const used = new Set();
  for (const e of liveEntries(t)) {
    used.add(e.payer); if (e.to) used.add(e.to);
    for (const id of (e.split && e.split.among) || []) used.add(id);
    for (const id of Object.keys((e.split && e.split.exact) || {})) used.add(id);
    for (const it of (e.split && e.split.items) || []) for (const id of it.who || []) used.add(id);
  }
  const rows = members(t).map((m) => `<button class="row" data-act="member-edit" data-id="${m.id}">${avatar(t, m.id)}<div class="main"><div class="t">${esc(m.name)}${m.id === t.me ? ' (du)' : ''}</div>
    <div class="s">Gewicht ×${fmtNum(m.weight)}${m.paypal ? ' · PayPal' : ''}${m.iban ? ' · IBAN' : ''}</div></div></button>`).join('');
  t._used = used;
  return header('Personen', { back: `#/t/${t.id}/mehr`, sub: esc(t.trip.name) }) + `<main class="noTabs">
    <div class="list">${rows}</div>
    <button class="btn sec block" data-act="member-edit" data-id="">${icon('plus')}Person hinzufügen</button>
    <p class="small muted">Das Gewicht bestimmt den Anteil bei „Gleich“: ×0,5 trägt halb so viel. Gilt für alle Ausgaben, auch frühere.</p>
  </main>`;
}
function openMember(t, id) {
  const m = id ? member(t, id) : { id: '', name: '', weight: 1, paypal: '', iban: '', bic: '' };
  if (!m) return;
  const canDel = id && !(t._used && t._used.has(id)) && id !== t.me;
  openSheet(`<h2>${id ? esc(m.name) : 'Neue Person'}</h2>
    <form id="mform" onsubmit="return false" autocomplete="off">
      <input type="hidden" name="id" value="${esc(m.id)}">
      <label class="f"><span>Name</span><input class="in" name="name" value="${esc(m.name)}" maxlength="40" required></label>
      <label class="f"><span>Gewicht bei „Gleich“</span><select class="in" name="weight">${weightOptions(m.weight)}</select></label>
      <label class="f"><span>PayPal.me-Name (optional)</span><input class="in" name="paypal" value="${esc(m.paypal || '')}" maxlength="60" placeholder="z. B. maxmuster" autocapitalize="off"></label>
      <label class="f"><span>IBAN (optional, für GiroCode)</span><input class="in kbd" name="iban" value="${esc(m.iban ? E.formatIban(m.iban) : '')}" maxlength="42" placeholder="DE…" autocapitalize="characters"></label>
      <label class="f"><span>BIC (optional)</span><input class="in kbd" name="bic" value="${esc(m.bic || '')}" maxlength="11" autocapitalize="characters"></label>
      <div id="merr"></div>
      <div class="btns"><button class="btn block" data-act="member-save">Speichern</button>
      ${canDel ? `<button class="btn danger block" data-act="member-del" data-id="${m.id}">Entfernen</button>` : ''}</div>
      ${id && !canDel && id !== t.me ? '<p class="small muted">Entfernen geht nur, solange die Person in keiner Ausgabe vorkommt.</p>' : ''}
      <p class="small muted">PayPal und IBAN sehen alle Mitreisenden – nur eintragen, wenn das für dich in Ordnung ist.</p>
    </form>`);
}
function saveMember(t) {
  const f = $('#mform');
  const v = Object.fromEntries(new FormData(f).entries());
  const name = String(v.name || '').trim();
  const err = (m) => { $('#merr').innerHTML = `<div class="notice err">${esc(m)}</div>`; };
  if (!name) return err('Bitte einen Namen eingeben.');
  if (members(t).some((m) => m.id !== v.id && m.name.toLowerCase() === name.toLowerCase())) return err('Diesen Namen gibt es schon.');
  const iban = E.normIban(v.iban || '');
  if (iban && !E.validIban(iban)) return err('Die IBAN stimmt nicht – bitte prüfen.');
  const paypal = String(v.paypal || '').trim();
  if (paypal && !E.paypalLink(paypal, 100, 'EUR')) return err('PayPal.me-Name ungültig (nur Buchstaben und Ziffern).');
  const data = { name, weight: Number(v.weight) || 1, paypal: paypal || undefined, iban: iban || undefined, bic: String(v.bic || '').trim().toUpperCase() || undefined };
  const list = members(t).map((m) => ({ ...m }));
  if (v.id) Object.assign(list.find((m) => m.id === v.id), data);
  else list.push({ id: E.newId(8), ...data });
  for (const m of list) for (const k of ['paypal', 'iban', 'bic']) if (!m[k]) delete m[k];
  updateTrip(t, { ...t.trip, members: list });
  closeSheet();
  render();
}
function updateTrip(t, trip) {
  t.trip = trip;
  queue(t, { type: 'trip', trip });
}

// ---------- Protokoll ----------
let logState = null;
function viewLog(t) {
  return header('Protokoll', { back: `#/t/${t.id}/mehr`, sub: esc(t.trip.name) }) + `<main class="noTabs"><div id="logbox"><div class="empty">Wird geladen …</div></div></main>`;
}
async function loadLog(t, more = false) {
  if (!more || !logState || logState.tripId !== t.id) logState = { tripId: t.id, items: [], more: false };
  const box = $('#logbox');
  try {
    const before = more && logState.items.length ? `&before=${encodeURIComponent(logState.items[logState.items.length - 1].key)}` : '';
    const d = await api(t, `/log?limit=50${before}`);
    logState.items.push(...d.log);
    logState.more = d.more;
  } catch (e) {
    if (box) box.innerHTML = `<div class="notice err">${esc(e.message)} Das Protokoll braucht eine Verbindung.</div>`;
    return;
  }
  if (!$('#logbox')) return;
  const cur = t.trip.currency;
  const label = (x) => x ? (x.title || (x.kind === 'transfer' ? 'Ausgleich' : 'Ausgabe')) : 'Eintrag';
  const amt = (x) => x && x.amount ? ` (${fmt(x.amount, x.currency || cur)})` : '';
  const rows = logState.items.map((l) => {
    const who = esc(mname(t, l.by));
    let txt = '';
    let canRestore = false;
    if (l.action === 'add') { txt = `${who} hat „${esc(label(l.after))}“${amt(l.after)} angelegt`; canRestore = true; }
    else if (l.action === 'edit') {
      const ch = [];
      if (l.before && l.after) {
        if (l.before.amount !== l.after.amount || l.before.currency !== l.after.currency) ch.push(`Betrag ${fmt(l.before.amount, l.before.currency || cur)} → ${fmt(l.after.amount, l.after.currency || cur)}`);
        if (l.before.title !== l.after.title) ch.push(`Titel „${esc(l.before.title || '')}“ → „${esc(l.after.title || '')}“`);
        if (l.before.payer !== l.after.payer) ch.push(`Zahler ${esc(mname(t, l.before.payer))} → ${esc(mname(t, l.after.payer))}`);
        if (JSON.stringify(l.before.split) !== JSON.stringify(l.after.split)) ch.push('Aufteilung geändert');
        if (l.before.date !== l.after.date) ch.push(`Datum ${esc(l.before.date)} → ${esc(l.after.date)}`);
      }
      txt = `${who} hat „${esc(label(l.after))}“ geändert${ch.length ? ': ' + ch.join(', ') : ''}`;
      canRestore = true;
    } else if (l.action === 'delete') { txt = `${who} hat „${esc(label(l.before))}“${amt(l.before)} gelöscht`; canRestore = true; }
    else if (l.action === 'claim') {
      const e = t.entries[l.id];
      const it = e && e.split && (e.split.items || []).find((x) => x.id === l.item);
      txt = `${who} hat ${l.member === l.by ? 'sich' : esc(mname(t, l.member))} ${l.on ? 'eingetragen bei' : 'ausgetragen bei'} „${esc(it ? it.name : 'Position')}“${e ? ` (${esc(label(e))})` : ''}`;
    } else if (l.action === 'trip') { txt = `${who} hat Reise/Personen geändert`; canRestore = true; }
    else if (l.action === 'restore') txt = `${who} hat einen früheren Stand wiederhergestellt`;
    else txt = `${who}: ${esc(l.action)}`;
    return `<div class="row logrow"><div class="main"><div class="s" style="color:var(--fg)">${txt}</div><div class="s small">${esc(timeAgo(l.at))}</div></div>
      ${canRestore ? `<button class="btn ghost" style="min-height:36px;padding:0 10px;font-size:14px" data-act="restore" data-key="${esc(l.key)}">${l.action === 'add' ? 'Rückgängig' : 'Wiederherstellen'}</button>` : ''}</div>`;
  }).join('');
  $('#logbox').innerHTML = rows ? `<div class="list">${rows}</div>${logState.more ? '<button class="btn sec block" data-act="log-more">Ältere laden</button>' : ''}` : '<div class="empty">Noch keine Änderungen.</div>';
}
async function restore(t, key) {
  try {
    await flush(t);
    await api(t, '/restore', { method: 'POST', json: { log: key, by: t.me } });
    toast('Wiederhergestellt.');
    await sync(t.id);
    loadLog(t);
  } catch (e) { toast(e.message); }
}

// ---------- Sheets ----------
function openSheet(html) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) closeSheet(); });
  document.body.append(bg);
  const f = bg.querySelector('input:not([readonly]):not([type=hidden])');
  if (f && !f.value) f.focus();
}
function closeSheet() { document.querySelectorAll('.sheet-bg').forEach((n) => n.remove()); }

async function copyText(v) {
  try { await navigator.clipboard.writeText(v); toast('Kopiert.'); }
  catch { toast('Kopieren nicht möglich – bitte markieren und kopieren.'); }
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- Ereignisse ----------
const ACT = {
  retry: (el) => sync(el.dataset.id, { full: true }),
  joinlink: () => {
    const v = ($('#joinlink').value || '').trim();
    const m = /#\/j\/([a-z0-9]{8,16})\/([A-Za-z0-9_-]+)/.exec(v);
    if (!m) return toast('Das ist kein Einladungslink der Reisekasse.');
    go(`#/j/${m[1]}/${m[2]}`);
  },
  'cf-add': () => { cf.people.push({ id: E.newId(8), name: '', weight: 1 }); render(); const ins = document.querySelectorAll('[data-cf="name"]'); ins[ins.length - 1].focus(); },
  'cf-del': (el) => { cf.people.splice(Number(el.dataset.i), 1); render(); },
  'cf-save': () => createTrip(),
  'pick-me': (el) => { const t = T(currentTripId()); t.me = el.dataset.id; save(); go(`#/t/${t.id}`); },
  'add-me': () => {
    const t = T(currentTripId());
    const name = ($('#newme').value || '').trim();
    if (!name) return toast('Bitte deinen Namen eingeben.');
    if (members(t).some((m) => m.name.toLowerCase() === name.toLowerCase())) return toast('Den Namen gibt es schon – tipp ihn oben an.');
    const id = E.newId(8);
    t.me = id;
    updateTrip(t, { ...t.trip, members: [...members(t), { id, name, weight: 1 }] });
    go(`#/t/${t.id}`);
  },
  claim: (el) => claimItem(T(currentTripId()), el.dataset.eid, el.dataset.item),
  'ed-kind': (el) => { ed.kind = el.dataset.v; rerenderEditor(); },
  'ed-cat': (el) => { ed.category = el.dataset.v; document.querySelectorAll('[data-act="ed-cat"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); },
  'ed-mode': (el) => {
    ed.mode = el.dataset.v;
    if (ed.mode === 'items' && !ed.items.length && ed.ocr && ed.ocr.items && ed.ocr.items.length) takeItems(ed.ocr.items);
    if (ed.mode === 'items' && !ed.items.length) ed.items.push({ id: E.newId(8), name: '', amountStr: '', who: [] });
    rerenderEditor();
  },
  'ed-among': (el) => { const id = el.dataset.id; ed.among = ed.among.includes(id) ? ed.among.filter((x) => x !== id) : members(T(ed.tripId)).map((m) => m.id).filter((x) => x === id || ed.among.includes(x)); el.setAttribute('aria-pressed', String(ed.among.includes(id))); updatePreview(); },
  'ed-all': () => { ed.among = members(T(ed.tripId)).map((m) => m.id); rerenderEditor(); },
  'ed-none': () => { ed.among = []; rerenderEditor(); },
  'ed-item-add': () => { ed.items.push({ id: E.newId(8), name: '', amountStr: '', who: [] }); rerenderEditor(); const ins = document.querySelectorAll('[data-k="name"]'); if (ins.length) ins[ins.length - 1].focus(); },
  'ed-item-del': (el) => { ed.items.splice(Number(el.dataset.i), 1); rerenderEditor(); },
  'ed-item-who': (el) => {
    const it = ed.items[Number(el.dataset.i)];
    const id = el.dataset.id;
    const set = new Set(it.who);
    if (set.has(id)) set.delete(id); else set.add(id);
    it.who = members(T(ed.tripId)).map((m) => m.id).filter((x) => set.has(x));
    el.setAttribute('aria-pressed', String(set.has(id)));
    updatePreview();
  },
  'ed-take-items': () => { takeItems(ed.ocr.items); rerenderEditor(); },
  'ed-rc-del': () => { ed.receipt = null; ed.ocr = null; rerenderEditor(); },
  'ed-rate': () => autoRate(T(ed.tripId), true),
  'ed-save': () => saveDraft(),
  'ed-del': () => deleteDraft(),
  pay: (el) => openPay(T(currentTripId()), Number(el.dataset.i)),
  'mark-paid': (el) => markPaid(T(currentTripId()), Number(el.dataset.i)),
  copy: (el) => copyText(el.dataset.v),
  invite: () => openInvite(T(currentTripId())),
  'share-link': () => { const t = T(currentTripId()); navigator.share({ title: `Reisekasse: ${t.trip.name}`, text: `Trag deine Ausgaben für „${t.trip.name}“ ein:`, url: shareLink(t) }).catch(() => {}); },
  'member-edit': (el) => openMember(T(currentTripId()), el.dataset.id),
  'member-save': () => saveMember(T(currentTripId())),
  'member-del': (el) => {
    const t = T(currentTripId());
    updateTrip(t, { ...t.trip, members: members(t).filter((m) => m.id !== el.dataset.id) });
    closeSheet(); render();
  },
  'trip-edit': () => {
    const t = T(currentTripId());
    openSheet(`<h2>Reise umbenennen</h2><form id="tform" onsubmit="return false"><label class="f"><span>Name</span><input class="in" name="name" value="${esc(t.trip.name)}" maxlength="60"></label>
      <p class="small muted">Hauptwährung: ${esc(t.trip.currency)} (lässt sich nach dem Anlegen nicht mehr ändern, weil alle Kurse darauf beruhen).</p>
      <div class="btns"><button class="btn block" data-act="trip-save">Speichern</button></div></form>`);
  },
  'trip-save': () => {
    const t = T(currentTripId());
    const name = String(new FormData($('#tform')).get('name') || '').trim();
    if (!name) return toast('Bitte einen Namen eingeben.');
    updateTrip(t, { ...t.trip, name });
    closeSheet(); render();
  },
  export: () => {
    const t = T(currentTripId());
    const safe = t.trip.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'reise';
    download(`Reisekasse-${safe}-${E.todayISO()}.csv`, E.csvExport(t.trip, liveEntries(t)), 'text/csv;charset=utf-8');
  },
  'sync-now': async () => { const t = T(currentTripId()); await sync(t.id, { full: true }); toast(t.status === 'ok' ? 'Abgeglichen.' : t.err || 'Offline.'); },
  forget: (el) => {
    const t = T(currentTripId());
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.querySelector('.t').textContent = pendingCount(t) ? `Wirklich? ${pendingCount(t)} Änderung(en) sind noch nicht hochgeladen!` : 'Nochmal tippen zum Entfernen'; return; }
    delete db.trips[t.id];
    db.order = db.order.filter((x) => x !== t.id);
    save();
    go('#/');
  },
  restore: (el) => restore(T(currentTripId()), el.dataset.key),
  'log-more': () => loadLog(T(currentTripId()), true)
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  Promise.resolve(fn(el, ev)).catch((e) => toast(e.message));
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.cf && cf) {
    const i = Number(el.dataset.i);
    if (el.dataset.cf === 'tname') cf.name = el.value;
    else if (el.dataset.cf === 'currency') cf.currency = el.value;
    else if (el.dataset.cf === 'name') cf.people[i].name = el.value;
    else if (el.dataset.cf === 'weight') cf.people[i].weight = Number(el.value) || 1;
    return;
  }
  if (!ed) return;
  if (el.dataset.ed) {
    const k = el.dataset.ed;
    ed[k] = el.value;
    if (k === 'currency' || k === 'payer' || (k === 'date' && ed.kind === 'transfer')) {
      if (k === 'payer' && ed.to === ed.payer) ed.to = members(T(ed.tripId)).map((m) => m.id).find((id) => id !== ed.payer) || '';
      if (k === 'currency') { ed.rateStr = ''; ed.rateInfo = ''; }
      rerenderEditor();
      if (k === 'currency') autoRate(T(ed.tripId));
      return;
    }
    if (k === 'date') autoRate(T(ed.tripId));
  } else if (el.dataset.exact) ed.exact[el.dataset.exact] = el.value;
  else if (el.dataset.item != null && el.dataset.k) ed.items[Number(el.dataset.item)][el.dataset.k] = el.value;
  else return;
  updatePreview();
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'rcfile' && ed) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    onReceiptFile(f);
  } else if (ev.target.matches('select') && (ev.target.dataset.ed || ev.target.dataset.cf)) {
    ev.target.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') closeSheet();
  if (ev.key === 'Enter' && ev.target.id === 'joinlink') ACT.joinlink();
  if (ev.key === 'Enter' && ev.target.id === 'newme') ACT['add-me']();
});

window.addEventListener('hashchange', render);
window.addEventListener('online', () => { const id = currentTripId(); if (id) sync(id); });
document.addEventListener('visibilitychange', () => { const id = currentTripId(); if (id && document.visibilityState === 'visible') sync(id); });
setInterval(() => {
  const id = currentTripId();
  if (id && document.visibilityState === 'visible') sync(id);
  else for (const t of Object.values(db.trips)) if (t.pending && t.pending.length) sync(t.id);
}, POLL_MS);

// Andere Tabs desselben Geräts: Speicher neu lesen.
window.addEventListener('storage', (e) => { if (e.key === LS) { db = loadDb(); if (!editing()) render(); } });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
{ const id = currentTripId(); if (id) sync(id); }
