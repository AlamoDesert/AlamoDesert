/* Live Karten – Oberfläche: Karte, Ebenen-Leiste, Abfragetakt, Detailkarte, Suche, Favoriten-Wand. */
import { LAYERS, EMBED_HOSTS, esc } from './layers.js';

const STORE = 'livekarten.v1';
const OFM = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const ESRI = 'Satellit: <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, GIS User Community';
const CONCURRENCY = 4;
const FETCH_TIMEOUT = 15_000;

const $ = (s) => document.querySelector(s);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
const prefs = load();
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* privater Modus: gilt nur bis zum Neuladen */ }
}

const active = new Set(Array.isArray(prefs.layers) ? prefs.layers.filter((id) => LAYERS.some((l) => l.id === id)) : LAYERS.map((l) => l.id));
// Neu hinzugekommene Ebenen einmal von selbst einschalten, auch wenn schon eine Auswahl gespeichert ist.
const seen = new Set(Array.isArray(prefs.seen) ? prefs.seen : Array.isArray(prefs.layers) ? ['flights', 'quakes', 'cams', 'live'] : []);
for (const l of LAYERS) if (!seen.has(l.id)) active.add(l.id);
prefs.seen = LAYERS.map((l) => l.id);
prefs.layers = [...active];
const runtime = new Map(LAYERS.map((l) => [l.id, { features: [], at: null, error: null, hint: null, stale: false, timer: 0, ctrl: null }]));
let base = prefs.base === 'sat' ? 'sat' : 'dark';
const favs = new Map((Array.isArray(prefs.favs) ? prefs.favs : []).map((f) => [f.key, f]));

/* ---------- Grundkarte: dunkel (OpenFreeMap) oder Satellit (Esri) ---------- */

/** Satellit als Rasterstil, leicht abgedunkelt; Schriften von OpenFreeMap für die Zahlen in den Gruppen. */
const SAT_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    sat: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: ESRI,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
    names: { type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'] }
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#05080c' } },
    { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-brightness-max': 0.82, 'raster-saturation': -0.15, 'raster-contrast': 0.08 } },
    { id: 'names', type: 'raster', source: 'names', paint: { 'raster-opacity': 0.85 } }
  ]
};

/** Stil vorab laden: ohne erreichbare Grundkarte feuert MapLibre nie „load“ – dann leere Fläche statt Stillstand. */
async function fetchStyle(kind) {
  if (kind === 'sat') return SAT_STYLE;
  try {
    const res = await fetch('https://tiles.openfreemap.org/styles/dark', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const style = await res.json();
    // Etwas tiefer ins Schwarz ziehen, damit die Live-Punkte leuchten.
    for (const l of style.layers) {
      if (l.type === 'background') l.paint = { ...l.paint, 'background-color': '#070b10' };
      if (l.id === 'water') l.paint = { ...l.paint, 'fill-color': '#0a1a24' };
    }
    return style;
  } catch {
    toast('Grundkarte nicht erreichbar – Live-Daten laufen trotzdem.');
    return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#070b10' } }] };
  }
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

const map = new maplibregl.Map({
  container: 'map',
  style: await fetchStyle(base),
  center: [10.4, 51.2],
  zoom: 6,
  hash: 'karte', // Ausschnitt steht in der Adresse → teilbare Links
  attributionControl: false,
  maxPitch: 0,
  dragRotate: false
});
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, showUserLocation: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: OFM }), 'bottom-left');

/* ---------- Ebenen auf der Karte ---------- */

const srcId = (l) => `lk-${l.id}`;

function toGeoJSON(features) {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: { ...f.props, id: f.id, label: f.label, heading: f.heading }
    }))
  };
}

const bound = new Set();

/** Routen und Wege des angetippten Objekts: durchgezogen = geflogener/gefahrener Weg, gestrichelt = Route/Kurs. */
function ensureOverlay() {
  if (map.getSource('lk-overlay')) return;
  map.addSource('lk-overlay', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'lk-overlay-glow', type: 'line', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'track'],
    layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#19d6e8', 'line-width': 7, 'line-opacity': 0.18, 'line-blur': 3 } });
  map.addLayer({ id: 'lk-overlay-track', type: 'line', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'track'],
    layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#19d6e8', 'line-width': 2.2 } });
  map.addLayer({ id: 'lk-overlay-route', type: 'line', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'route'],
    paint: { 'line-color': '#dfeef2', 'line-width': 1.6, 'line-opacity': 0.75, 'line-dasharray': [2, 2.5] } });
  map.addLayer({ id: 'lk-overlay-airport', type: 'circle', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'airport'],
    paint: { 'circle-radius': 5, 'circle-color': '#05080c', 'circle-stroke-color': '#19d6e8', 'circle-stroke-width': 2 } });
  if (map.getStyle()?.glyphs) {
    map.addLayer({ id: 'lk-overlay-label', type: 'symbol', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'airport'],
      layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
      paint: { 'text-color': '#19d6e8', 'text-halo-color': 'rgba(0,0,0,.8)', 'text-halo-width': 1.2 } });
  }
}

function setOverlay(features) {
  map.getSource('lk-overlay')?.setData({ type: 'FeatureCollection', features });
}

function ensureInstalled(l) {
  if (map.getSource(srcId(l))) return;
  // Quellennachweis hängt an der Quelle: MapLibre zeigt ihn nur, solange die Ebene sichtbar ist.
  map.addSource(srcId(l), { type: 'geojson', data: toGeoJSON(runtime.get(l.id).features), attribution: l.attribution, ...(l.sourceOptions || {}) });
  l.install(map, srcId(l));
  // Ebenen-Handler überleben setStyle; nur einmal binden, sonst öffnet ein Klick die Details mehrfach.
  if (bound.has(l.id)) return;
  bound.add(l.id);
  for (const id of layerIds(l)) {
    if (id.endsWith('-glow')) continue;
    map.on('click', id, async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (f.properties.cluster) {
        // Gruppe antippen = so weit hineinzoomen, bis sie zerfällt.
        try {
          const zoom = await map.getSource(srcId(l)).getClusterExpansionZoom(f.properties.cluster_id);
          map.easeTo({ center: f.geometry.coordinates, zoom });
        } catch { map.easeTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2 }); }
        return;
      }
      showDetail(l, f.properties, f.geometry.coordinates);
    });
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  }
}

function layerIds(l) {
  return (map.getStyle()?.layers || []).filter((x) => x.source === srcId(l)).map((x) => x.id);
}

function setVisible(l, on) {
  for (const id of layerIds(l)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

/* ---------- Abfragen ---------- */

async function getJSON(url, signal) {
  // Eigener Zeitablauf statt AbortSignal.any (fehlt in Safari < 17.4).
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  const timer = setTimeout(stop, FETCH_TIMEOUT);
  signal.addEventListener('abort', stop, { once: true });
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch {
    throw new Error(signal.aborted ? 'abgebrochen' : ctrl.signal.aborted ? 'Zeitüberschreitung' : 'keine Verbindung');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
  }
  let body = null;
  try { body = await res.json(); } catch { /* Fehlerseite ohne JSON */ }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/** Führt Aufgaben mit begrenzter Parallelität aus; Ergebnisse als settled-Liste in Eingangsreihenfolge. */
async function pool(tasks, limit) {
  const out = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try { out[i] = { ok: true, value: await tasks[i]() }; } catch (e) { out[i] = { ok: false, error: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

async function refresh(l) {
  const rt = runtime.get(l.id);
  clearTimeout(rt.timer);
  rt.ctrl?.abort();
  if (!active.has(l.id)) return;
  // Hintergrund-Tab: nichts abfragen, beim Zurückkehren sofort aktualisieren (visibilitychange).
  if (document.hidden) return;

  const plan = l.requests(map);
  rt.hint = plan.hint || null;
  if (!plan.queries) {
    rt.features = [];
    rt.error = null;
    render(l);
    rt.timer = setTimeout(() => refresh(l), l.refresh);
    return;
  }

  const ctrl = new AbortController();
  rt.ctrl = ctrl;
  const url = l.url || `/api/feed/${l.id}`;
  const results = await pool(plan.queries.map((q) => () => getJSON(`${url}${q ? `?${q}` : ''}`, ctrl.signal)), CONCURRENCY);
  if (ctrl.signal.aborted) return; // neuere Abfrage läuft schon

  const ok = results.filter((r) => r.ok).map((r) => r.value);
  const failed = results.filter((r) => !r.ok);
  if (ok.length) {
    const byId = new Map();
    for (const r of ok) for (const f of r.features) byId.set(f.id, f); // Zellen überlappen: doppelte Objekte zusammenführen
    rt.features = [...byId.values()];
    if (l.trail) recordTrail(l, rt.features);
    rt.at = ok.map((r) => Date.parse(r.at)).reduce((a, b) => Math.min(a, b));
    rt.stale = ok.some((r) => r.stale);
  }
  rt.error = failed.length
    ? !navigator.onLine ? 'Keine Internetverbindung'
      : `${failed.length === results.length ? 'Quelle nicht erreichbar' : `${failed.length} von ${results.length} Bereichen fehlen`}: ${failed[0].error.message}`
    : null;
  render(l);
  rt.timer = setTimeout(() => refresh(l), l.refresh);
}

/** Positionen mitschreiben, solange die Karte offen ist (für Quellen ohne eigenen Verlauf). */
const trails = new Map();
function recordTrail(l, features) {
  for (const f of features) {
    const key = `${l.id}|${f.id}`;
    const t = trails.get(key) || [];
    const last = t[t.length - 1];
    if (!last || last[0] !== f.lon || last[1] !== f.lat) t.push([f.lon, f.lat]);
    if (t.length > 240) t.shift();
    trails.set(key, t);
  }
}

function render(l) {
  const src = map.getSource(srcId(l));
  if (src) src.setData(toGeoJSON(runtime.get(l.id).features));
  renderChrome();
}

/* ---------- Kopfleiste, Dock, Ebenen-Panel ---------- */

const num = (n) => n.toLocaleString('de-DE');
const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON_LAYERS = '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>';
const ICON_WALL = '<rect x="3.5" y="4.5" width="7.5" height="6.5" rx="1"/><rect x="13" y="4.5" width="7.5" height="6.5" rx="1"/><rect x="3.5" y="13" width="7.5" height="6.5" rx="1"/><rect x="13" y="13" width="7.5" height="6.5" rx="1"/>';

function ago(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 60 ? `vor ${s} s` : s < 3600 ? `vor ${Math.round(s / 60)} min` : `vor ${Math.round(s / 3600)} h`;
}

function status(l) {
  const rt = runtime.get(l.id);
  if (!active.has(l.id)) return { text: l.desc, cls: '' };
  if (rt.hint) return { text: rt.hint, cls: 'hint' };
  if (rt.error && !rt.at) return { text: rt.error, cls: 'err' };
  if (!rt.at) return { text: 'Lädt …', cls: '' };
  // Feste Listen: Stand der letzten Prüfung statt „vor n h“.
  if (l.fixed) return { text: `geprüft am ${new Date(rt.at).toLocaleDateString('de-DE')}`, cls: '' };
  if (rt.error) return { text: `${ago(rt.at)} · ${rt.error}`, cls: 'err' };
  return { text: rt.stale ? `${ago(rt.at)} · Quelle hängt, ältere Daten` : ago(rt.at), cls: rt.stale ? 'hint' : '' };
}

function renderChrome() {
  const count = (l) => runtime.get(l.id).features.length;
  $('#dock').innerHTML = LAYERS.map((l) => {
    const rt = runtime.get(l.id);
    return `<button class="dk ${active.has(l.id) ? 'on' : ''}" style="--c:${l.color}" data-layer="${l.id}" aria-pressed="${active.has(l.id)}" title="${esc(l.name)}">
      ${svg(l.icon)}<span>${esc(l.short)}</span><i class="n ${rt.error ? 'err' : ''}">${rt.error && !rt.at ? '!' : rt.hint ? '–' : count(l) > 999 ? `${Math.round(count(l) / 1000)}k` : count(l)}</i></button>`;
  }).join('') + '<div class="dk-sep"></div>'
    + `<button class="dk ${$('#panel').hidden ? '' : 'on'}" data-act="panel" title="Ebenen und Karte">${svg(ICON_LAYERS)}<span>Ebenen</span></button>`
    + `<button class="dk ${favs.size ? 'on' : ''}" style="--c:var(--warn)" data-act="wall" title="Favoriten-Wand">${svg(ICON_WALL)}<span>Wand</span><i class="n">${favs.size}</i></button>`;

  $('#stats').innerHTML = LAYERS.filter((l) => active.has(l.id) && (runtime.get(l.id).at || runtime.get(l.id).hint))
    .map((l) => `<div class="stat glass" style="--c:${l.color}" title="${esc(runtime.get(l.id).hint || '')}"><b>${runtime.get(l.id).hint ? '–' : num(count(l))}</b><span><i></i>${esc(l.name)}</span></div>`).join('');

  if (!$('#panel').hidden) {
    $('#panel').innerHTML = `<div class="p-head"><span class="caps">Ebenen</span><button class="ic" data-act="panel" aria-label="Schließen">×</button></div>`
      + LAYERS.map((l) => {
        const s = status(l);
        return `<button class="layer ${active.has(l.id) ? 'on' : ''}" style="--c:${l.color}" data-layer="${l.id}" aria-pressed="${active.has(l.id)}">
          <i class="bar"></i><span><b>${esc(l.name)}</b><small class="${s.cls}">${esc(s.text)}</small></span>
          <span class="cnt">${active.has(l.id) ? num(count(l)) : 'aus'}</span></button>`;
      }).join('')
      + `<div class="p-sub caps">Karte</div><div class="seg">
        <button data-base="dark" class="${base === 'dark' ? 'on' : ''}">Dunkel</button><button data-base="sat" class="${base === 'sat' ? 'on' : ''}">Satellit</button></div>`;
  }

  const errors = LAYERS.filter((l) => active.has(l.id) && runtime.get(l.id).error);
  $('#clock').classList.toggle('warn', errors.length > 0 || !navigator.onLine);
  $('#sys').textContent = !navigator.onLine ? 'Offline' : errors.length ? `${errors.length} Quelle${errors.length > 1 ? 'n' : ''} gestört` : 'System online';
}

function toggleLayer(id) {
  const l = LAYERS.find((x) => x.id === id);
  if (!l) return;
  const on = !active.has(id);
  if (on) active.add(id); else active.delete(id);
  prefs.layers = [...active];
  save();
  setVisible(l, on);
  if (on) refresh(l); else { clearTimeout(runtime.get(id).timer); runtime.get(id).ctrl?.abort(); }
  renderChrome();
}

async function setBase(kind) {
  if (kind === base) return;
  base = kind;
  prefs.base = kind;
  save();
  map.setStyle(await fetchStyle(kind));
  // setStyle verwirft eigene Ebenen → nach dem Laden neu einhängen.
  map.once('style.load', installAll);
  renderChrome();
}

function onChromeClick(e) {
  const t = e.target.closest('[data-layer],[data-act],[data-base]');
  if (!t) return;
  if (t.dataset.layer) toggleLayer(t.dataset.layer);
  else if (t.dataset.base) setBase(t.dataset.base);
  else if (t.dataset.act === 'panel') { $('#panel').hidden = !$('#panel').hidden; if (!$('#panel').hidden) closeDetail(); renderChrome(); }
  else if (t.dataset.act === 'wall') openWall();
}
$('#dock').addEventListener('click', onChromeClick);
$('#panel').addEventListener('click', onChromeClick);

function tickClock() {
  $('#utc').textContent = `${new Date().toISOString().slice(11, 19)} UTC`;
}
setInterval(tickClock, 1000);
tickClock();

/* ---------- Medien: Kamerabilder und Player ---------- */

const imgTimers = new Set();
const hlsPlayers = new Set();

/** Kamerabilder (img[data-refresh]) laden sich alle n Sekunden neu, solange sie zu sehen sind. */
function startImages(root) {
  for (const img of root.querySelectorAll('img[data-refresh]')) {
    const src = img.dataset.src;
    const load = () => { img.src = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`; };
    const timer = setInterval(() => { if (!document.hidden && img.isConnected) load(); }, Number(img.dataset.refresh) * 1000);
    img.addEventListener('error', () => { clearInterval(timer); img.replaceWith(Object.assign(document.createElement('p'), { className: 'noimg', textContent: 'Bild gerade nicht verfügbar' })); }, { once: true });
    imgTimers.add(timer);
    load();
  }
}

function stopMedia() {
  for (const t of imgTimers) clearInterval(t);
  imgTimers.clear();
  for (const h of hlsPlayers) h.destroy();
  hlsPlayers.clear();
}

function frame(src) {
  const f = document.createElement('iframe');
  f.className = 'player';
  f.src = src;
  f.title = 'Livestream';
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  return f;
}

/** Direkter HLS-Stream: Safari/iOS und neues Chrome spielen ihn selbst, sonst lädt hls.js (lokal, nur bei Bedarf). */
async function playHls(btn, url) {
  const v = document.createElement('video');
  Object.assign(v, { className: 'player', muted: true, autoplay: true, playsInline: true, controls: true });
  const fail = () => v.replaceWith(Object.assign(document.createElement('p'), { className: 'noimg', textContent: 'Video lässt sich hier gerade nicht abspielen – „Stream öffnen“ versuchen' }));
  btn.replaceWith(v);
  if (v.canPlayType('application/vnd.apple.mpegurl')) {
    v.addEventListener('error', fail, { once: true });
    v.src = url;
    return;
  }
  try {
    const { default: Hls } = await import('./vendor/hls/hls.light.min.mjs');
    if (!Hls.isSupported() || !v.isConnected) return fail();
    const h = new Hls({ lowLatencyMode: false });
    hlsPlayers.add(h);
    h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { h.destroy(); hlsPlayers.delete(h); fail(); } });
    h.loadSource(url);
    h.attachMedia(v);
  } catch { fail(); }
}

/** Player erst nach dem Antippen einbetten (YouTube über youtube-nocookie: keine Cookies, bevor abgespielt wird). */
function playVideo(btn) {
  const { yt, embed, hls } = btn.dataset;
  if (yt && /^[\w-]{11}$/.test(yt)) {
    btn.replaceWith(frame(`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&rel=0`));
  } else if (embed && EMBED_HOSTS.includes(new URL(embed).hostname)) {
    btn.replaceWith(frame(embed));
  } else if (hls && /^https:\/\//.test(hls)) {
    playHls(btn, hls);
  }
}

/* ---------- Detailkarte ---------- */

let current = null; // { l, p, coords }
let moreTimer = 0;
let moreRun = 0;

/** Nachladen (Foto, Route, Weg) für die offene Detailkarte; wiederholt sich, solange sie offen ist. */
async function loadMore() {
  clearTimeout(moreTimer);
  if (!current?.l.more) return;
  const run = ++moreRun;
  const { l, p, coords } = current;
  // Aktuelle Position aus den Live-Daten, falls sich das Objekt bewegt hat
  const live = runtime.get(l.id).features.find((f) => f.id === p.id);
  const pos = live ? [live.lon, live.lat] : coords;
  const ctrl = new AbortController();
  try {
    const r = await l.more(live ? { ...p, ...live.props, id: live.id } : p, pos, (url) => getJSON(url, ctrl.signal), trails.get(`${l.id}|${p.id}`));
    if (run !== moreRun || !current) return;
    const box = $('#detail .more');
    if (box && r.html !== undefined) box.innerHTML = r.html;
    setOverlay(r.overlay || []);
    if (r.every) moreTimer = setTimeout(loadMore, r.every);
  } catch {
    if (run === moreRun) { const box = $('#detail .more'); if (box) box.innerHTML = '<p class="noimg">Details gerade nicht abrufbar</p>'; }
  }
}

/** MapLibre liefert null-Werte aus GeoJSON-Properties als String "null" zurück, Zahlen bleiben Zahlen. */
const clean = (props) => Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v === 'null' ? null : v]));
const favKey = (l, p) => `${l.id}|${p.id}`;

function showDetail(l, props, coords) {
  const p = clean(props);
  const d = l.detail(p);
  stopMedia();
  current = { l, p, coords };
  const fav = d.fav ? `<button class="ic fav ${favs.has(favKey(l, p)) ? 'on' : ''}" data-act="fav" aria-label="Favorit" title="Auf die Wand legen">★</button>` : '';
  const [lon, lat] = coords || [];
  $('#detail').innerHTML = `<div class="d-head"><span class="caps">${d.kicker || esc(l.name)}</span>${fav}
      <button class="ic" data-act="close" aria-label="Schließen">×</button></div>
    <div class="d-body"><div class="d-title"><h2>${d.title}</h2>${d.chip ? `<span class="chip ${d.chip.cls}">${d.chip.text}</span>` : ''}</div>${d.body}
    ${coords ? `<div class="coords"><span>${lat.toFixed(4)}° N · ${lon.toFixed(4)}° E</span><span>${esc(l.name)}</span></div>` : ''}</div>`;
  $('#detail').hidden = false;
  $('#panel').hidden = true;
  startImages($('#detail'));
  setOverlay([]);
  loadMore();
  renderChrome();
}

function closeDetail() {
  stopMedia();
  clearTimeout(moreTimer);
  moreRun++;
  setOverlay([]);
  current = null;
  $('#detail').hidden = true;
  $('#detail').innerHTML = ''; // laufendes Video beenden
}

function toggleFav(btn) {
  if (!current) return;
  const { l, p, coords } = current;
  const key = favKey(l, p);
  if (favs.has(key)) favs.delete(key);
  else favs.set(key, { key, layer: l.id, props: p, coords });
  prefs.favs = [...favs.values()];
  save();
  btn.classList.toggle('on', favs.has(key));
  toast(favs.has(key) ? `„${p.label || p.name}“ liegt jetzt auf der Wand` : 'Von der Wand genommen');
  renderChrome();
}

$('#detail').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') return closeDetail();
  if (act === 'fav') return toggleFav(e.target.closest('[data-act]'));
  const btn = e.target.closest('button.player');
  if (btn) playVideo(btn);
});

/* ---------- Favoriten-Wand ---------- */

function openWall() {
  closeDetail();
  $('#panel').hidden = true;
  const tiles = [...favs.values()].map((f) => {
    const l = LAYERS.find((x) => x.id === f.layer);
    if (!l) return '';
    const d = l.detail(f.props);
    // Nur das Bild bzw. den Abspielknopf aus der Detailkarte übernehmen.
    const media = new DOMParser().parseFromString(d.body, 'text/html').body.firstElementChild?.outerHTML || '';
    return `<article class="tile glass" data-key="${esc(f.key)}"><header>${d.chip ? `<span class="chip ${d.chip.cls}">${d.chip.text}</span>` : ''}<b>${d.title}</b>
      <button class="ic" data-act="goto" title="Auf der Karte zeigen" aria-label="Auf der Karte zeigen">⌖</button>
      <button class="ic" data-act="unfav" title="Von der Wand nehmen" aria-label="Von der Wand nehmen">×</button></header>${media}</article>`;
  }).join('');
  $('#walltiles').innerHTML = tiles || '<p class="w-empty">Noch nichts auf der Wand.<br>Kamera oder Livestream öffnen und den Stern ★ antippen.</p>';
  $('#wallplay').hidden = !favs.size;
  $('#wall').hidden = false;
  startImages($('#walltiles'));
}

function closeWall() {
  stopMedia();
  $('#wall').hidden = true;
  $('#walltiles').innerHTML = '';
}

$('#wallclose').addEventListener('click', closeWall);
$('#wallplay').addEventListener('click', () => $('#walltiles').querySelectorAll('button.player').forEach(playVideo));
$('#walltiles').addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (tile && act === 'unfav') {
    favs.delete(tile.dataset.key);
    prefs.favs = [...favs.values()];
    save();
    tile.remove();
    renderChrome();
    if (!favs.size) openWall();
    return;
  }
  if (tile && act === 'goto') {
    const f = favs.get(tile.dataset.key);
    const l = LAYERS.find((x) => x.id === f?.layer);
    closeWall();
    if (f?.coords && l) {
      map.flyTo({ center: f.coords, zoom: Math.max(map.getZoom(), 12) });
      showDetail(l, f.props, f.coords);
    }
    return;
  }
  const btn = e.target.closest('button.player');
  if (btn) playVideo(btn);
});

/* ---------- Suche über alles, was gerade geladen ist ---------- */

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
let hits = [];
let sel = 0;

function searchText(l, f) {
  const p = f.props;
  return fold([f.label, p.name, p.channel, p.area, p.place, p.callsign, p.reg, p.type, f.id].filter(Boolean).join(' '));
}

function runSearch() {
  const q = fold($('#q').value.trim());
  const terms = q.split(/\s+/).filter(Boolean);
  hits = [];
  if (terms.length) {
    for (const l of LAYERS) {
      if (!active.has(l.id)) continue;
      for (const f of runtime.get(l.id).features) {
        const t = searchText(l, f);
        if (terms.every((w) => t.includes(w))) hits.push({ l, f, starts: fold(f.label).startsWith(terms[0]) });
        if (hits.length > 400) break;
      }
    }
    hits.sort((a, b) => (b.starts - a.starts) || LAYERS.indexOf(a.l) - LAYERS.indexOf(b.l) || a.f.label.localeCompare(b.f.label, 'de'));
    hits = hits.slice(0, 40);
  }
  sel = 0;
  $('#results').innerHTML = !terms.length
    ? '<p class="r-empty">Sucht in allen eingeschalteten Ebenen: Livestreams, Kameras, Flüge (Rufzeichen, Kennzeichen), Erdbeben.</p>'
    : hits.length
      ? hits.map((h, i) => `<button class="r ${i === sel ? 'sel' : ''}" style="--c:${h.l.color}" data-i="${i}"><i></i>
          <span>${esc(h.f.label)}<small>${esc(h.f.props.channel || h.f.props.area || h.f.props.place || h.f.props.type || '')}</small></span><em>${esc(h.l.short)}</em></button>`).join('')
      : '<p class="r-empty">Nichts gefunden – nur eingeschaltete Ebenen werden durchsucht.</p>';
}

function pick(i) {
  const h = hits[i];
  if (!h) return;
  closeSearch();
  map.flyTo({ center: [h.f.lon, h.f.lat], zoom: Math.max(map.getZoom(), h.l.id === 'flights' ? 9 : 13), speed: 1.6 });
  showDetail(h.l, { ...h.f.props, id: h.f.id, label: h.f.label, heading: h.f.heading }, [h.f.lon, h.f.lat]);
}

function openSearch() {
  $('#search').hidden = false;
  $('#q').value = '';
  runSearch();
  $('#q').focus();
}
function closeSearch() { $('#search').hidden = true; }

$('#searchbtn').addEventListener('click', openSearch);
$('#q').addEventListener('input', runSearch);
$('#results').addEventListener('click', (e) => { const r = e.target.closest('.r'); if (r) pick(Number(r.dataset.i)); });
$('#search').addEventListener('click', (e) => { if (e.target.id === 'search') closeSearch(); });
$('#q').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
    $('#results').querySelectorAll('.r').forEach((r, i) => r.classList.toggle('sel', i === sel));
    $('#results').querySelector('.r.sel')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') pick(sel);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#search').hidden) closeSearch();
    else if (!$('#wall').hidden) closeWall();
    else { closeDetail(); $('#panel').hidden = true; renderChrome(); }
  } else if (e.key === '/' && !e.target.closest('input, textarea') && $('#search').hidden) {
    e.preventDefault();
    openSearch();
  }
});

/* ---------- Ablauf ---------- */

/** Quellennachweis eingeklappt halten (öffnet sich über ⓘ), sonst verdeckt er am Handy die halbe Karte. */
function collapseAttribution() {
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
}

function installAll() {
  collapseAttribution();
  ensureOverlay();
  for (const l of LAYERS) {
    ensureInstalled(l);
    setVisible(l, active.has(l.id));
  }
}

let moveTimer = 0;
map.on('moveend', () => {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => LAYERS.filter((l) => l.viewport).forEach(refresh), 350);
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) LAYERS.forEach(refresh); });
// Ohne Netz zeigt der Service Worker die gespeicherte App; das soll man auch sehen.
addEventListener('offline', () => { toast('Keine Internetverbindung – Live-Daten pausieren.'); renderChrome(); });
addEventListener('online', () => { toast('Wieder online.'); LAYERS.forEach(refresh); });
if (!navigator.onLine) toast('Keine Internetverbindung – angezeigt wird die gespeicherte Version.');

setInterval(() => { if (!$('#panel').hidden) renderChrome(); }, 5000); // „vor n s“ aktuell halten
renderChrome();
// Ebenen schon beim fertigen Stil einhängen, nicht erst bei „load“ (das wartet auf alle Kacheln der Grundkarte).
function start() {
  installAll();
  LAYERS.forEach(refresh);
}
if (map.isStyleLoaded()) start(); else map.once('style.load', start);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
