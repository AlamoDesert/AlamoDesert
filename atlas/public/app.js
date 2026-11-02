/* Live Karten – Oberfläche: Karte, Ebenen-Steuerung, Abfragetakt, Detailansicht. */
import { LAYERS, esc } from './layers.js';

const STORE = 'livekarten.v1';
const STYLES = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };
const BASE_ATTR = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const CONCURRENCY = 4;
const FETCH_TIMEOUT = 15_000;

const $ = (s) => document.querySelector(s);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(prefs) {
  try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* privater Modus: Auswahl gilt nur bis zum Neuladen */ }
}

const prefs = load();
const active = new Set(Array.isArray(prefs.layers) ? prefs.layers.filter((id) => LAYERS.some((l) => l.id === id)) : ['flights', 'quakes', 'cams']);
const runtime = new Map(LAYERS.map((l) => [l.id, { features: [], at: null, error: null, hint: null, stale: false, timer: 0, ctrl: null }]));

const dark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => (dark.matches ? 'dark' : 'light');

/** Stil vorab laden: ohne erreichbare Grundkarte feuert MapLibre nie „load“ – dann leere Fläche statt Stillstand. */
async function fetchStyle(kind) {
  try {
    const res = await fetch(STYLES[kind], { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    toast('Grundkarte nicht erreichbar – Live-Daten laufen trotzdem.');
    return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': kind === 'dark' ? '#1b1e24' : '#e9ecef' } }] };
  }
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

const map = new maplibregl.Map({
  container: 'map',
  style: await fetchStyle(theme()),
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
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: BASE_ATTR }), 'bottom-left');

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

function ensureInstalled(l) {
  if (map.getSource(srcId(l))) return;
  // Quellennachweis hängt an der Quelle: MapLibre zeigt ihn nur, solange die Ebene sichtbar ist.
  map.addSource(srcId(l), { type: 'geojson', data: toGeoJSON(runtime.get(l.id).features), attribution: l.attribution, ...(l.sourceOptions || {}) });
  l.install(map, srcId(l));
  // Ebenen-Handler überleben setStyle; nur einmal binden, sonst öffnet ein Klick die Details mehrfach.
  if (bound.has(l.id)) return;
  bound.add(l.id);
  for (const id of layerIds(l)) {
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
      showDetail(l, f.properties);
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
  } catch (e) {
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
  const results = await pool(plan.queries.map((q) => () => getJSON(`/api/feed/${l.id}${q ? `?${q}` : ''}`, ctrl.signal)), CONCURRENCY);
  if (ctrl.signal.aborted) return; // neuere Abfrage läuft schon

  const ok = results.filter((r) => r.ok).map((r) => r.value);
  const failed = results.filter((r) => !r.ok);
  if (ok.length) {
    const byId = new Map();
    for (const r of ok) for (const f of r.features) byId.set(f.id, f); // Zellen überlappen: doppelte Objekte zusammenführen
    rt.features = [...byId.values()];
    rt.at = ok.map((r) => Date.parse(r.at)).reduce((a, b) => Math.min(a, b));
    rt.stale = ok.some((r) => r.stale);
  }
  rt.error = failed.length
    ? `${failed.length === results.length ? 'Quelle nicht erreichbar' : `${failed.length} von ${results.length} Bereichen fehlen`}: ${failed[0].error.message}`
    : null;
  render(l);
  rt.timer = setTimeout(() => refresh(l), l.refresh);
}

function render(l) {
  const src = map.getSource(srcId(l));
  if (src) src.setData(toGeoJSON(runtime.get(l.id).features));
  renderPanel();
}

/* ---------- Ebenen-Panel ---------- */

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
  const base = `${rt.features.length.toLocaleString('de-DE')} · ${ago(rt.at)}`;
  if (rt.error) return { text: `${base} · ${rt.error}`, cls: 'err' };
  return { text: rt.stale ? `${base} · Quelle hängt, ältere Daten` : base, cls: rt.stale ? 'hint' : '' };
}

function renderPanel() {
  $('#layers').innerHTML = LAYERS.map((l) => {
    const s = status(l);
    return `<label class="layer"><input type="checkbox" data-layer="${l.id}" ${active.has(l.id) ? 'checked' : ''}>
      <span class="sw" aria-hidden="true"></span>
      <span class="txt"><b>${esc(l.name)}</b><small class="${s.cls}">${esc(s.text)}</small></span></label>`;
  }).join('');
  const errors = LAYERS.some((l) => active.has(l.id) && runtime.get(l.id).error);
  $('#layerbtn').classList.toggle('warn', errors);
}

$('#layers').addEventListener('change', (e) => {
  const id = e.target?.dataset?.layer;
  const l = LAYERS.find((x) => x.id === id);
  if (!l) return;
  if (e.target.checked) active.add(id); else active.delete(id);
  save({ ...prefs, layers: [...active] });
  setVisible(l, e.target.checked);
  if (e.target.checked) refresh(l); else { clearTimeout(runtime.get(id).timer); runtime.get(id).ctrl?.abort(); renderPanel(); }
});

$('#layerbtn').addEventListener('click', () => {
  const open = $('#panel').hidden;
  $('#panel').hidden = !open;
  $('#layerbtn').setAttribute('aria-expanded', String(open));
});

/* ---------- Detailansicht ---------- */

let imgTimer = 0;

/** Kamerabilder (img[data-refresh]) laden sich alle n Sekunden neu, solange die Detailkarte offen ist. */
function startImageRefresh() {
  clearInterval(imgTimer);
  const img = $('#detail img[data-refresh]');
  if (!img) return;
  const base = img.dataset.src;
  const load = () => { img.src = `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`; };
  img.addEventListener('error', () => { img.replaceWith(Object.assign(document.createElement('p'), { className: 'noimg', textContent: 'Bild gerade nicht verfügbar' })); clearInterval(imgTimer); }, { once: true });
  load();
  imgTimer = setInterval(() => { if (!document.hidden) load(); }, Number(img.dataset.refresh) * 1000);
}

function closeDetail() {
  clearInterval(imgTimer);
  $('#detail').hidden = true;
}

function showDetail(l, props) {
  // MapLibre liefert null-Werte aus GeoJSON-Properties als String "null" zurück, Zahlen bleiben Zahlen.
  const p = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v === 'null' ? null : v]));
  const d = l.detail(p);
  $('#detail').innerHTML = `<header><span class="kind">${esc(l.name)}</span><h2>${d.title}</h2>
    <button class="close" aria-label="Schließen">×</button></header>${d.body}`;
  $('#detail').hidden = false;
  startImageRefresh();
}
$('#detail').addEventListener('click', (e) => { if (e.target.closest('.close')) closeDetail(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); $('#panel').hidden = true; } });

/* ---------- Ablauf ---------- */

function installAll() {
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

// Hell/Dunkel folgt dem System. setStyle verwirft eigene Ebenen → nach dem Laden neu einhängen.
dark.addEventListener('change', async () => {
  map.setStyle(await fetchStyle(theme()));
  map.once('style.load', installAll);
});

setInterval(renderPanel, 5000); // „vor n s“ aktuell halten
renderPanel();
map.on('load', () => {
  installAll();
  LAYERS.forEach(refresh);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
