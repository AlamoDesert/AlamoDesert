/* Live Karten – Oberfläche: Karte, Dock, Abfragetakt, Detailkarte, Suche, Favoriten, Wetterkarte mit Zeitleiste. */
import { LAYERS, DOCK_GROUPS, EMBED_HOSTS, esc } from './layers.js';
import { KINDS, buildSteps, nowIndex, nearestStep, stepLabel, dayTicks, legendUrl, imageUrl, forecast, forecastHtml } from './weather.js';

const STORE = 'livekarten.v1';
const OFM = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const ESRI = 'Satellit: <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, GIS User Community';
const CONCURRENCY = 6;
const FETCH_TIMEOUT = 15_000;

const $ = (s) => document.querySelector(s);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
const prefs = load();
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* privater Modus: gilt nur bis zum Neuladen */ }
}

// Ebenen mit `off: true` (Zusatzebenen in „Wetter“/„Sonstige“) starten ausgeschaltet.
const active = new Set(Array.isArray(prefs.layers) ? prefs.layers.filter((id) => LAYERS.some((l) => l.id === id)) : LAYERS.filter((l) => !l.off).map((l) => l.id));
// Neu hinzugekommene Ebenen einmal von selbst einschalten, auch wenn schon eine Auswahl gespeichert ist.
const seen = new Set(Array.isArray(prefs.seen) ? prefs.seen : Array.isArray(prefs.layers) ? ['flights', 'cams', 'live'] : []);
for (const l of LAYERS) if (!seen.has(l.id) && !l.off) active.add(l.id);
prefs.seen = LAYERS.map((l) => l.id);
prefs.layers = [...active];
const runtime = new Map(LAYERS.map((l) => [l.id, { features: [], at: null, error: null, hint: null, stale: false, timer: 0, ctrl: null }]));
let base = ['sat', 'light'].includes(prefs.base) ? prefs.base : 'dark';
const applyTheme = () => {
  document.documentElement.dataset.theme = base === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', base === 'light' ? '#f4f5f7' : '#121417');
};
applyTheme();
const favs = new Map((Array.isArray(prefs.favs) ? prefs.favs : []).map((f) => [f.key, f]));
// Wetterkarte: Art (rain/temp/wind oder null), Schritte der Zeitleiste, aktueller Schritt, Wiedergabe
const wx = { kind: KINDS[prefs.wx] ? prefs.wx : null, steps: [], idx: 0, playing: false, error: null, legend: false, run: 0, timer: 0 };

/* ---------- Grundkarte: dunkel, hell (OpenFreeMap) oder Satellit (Esri) ---------- */

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
    { id: 'bg', type: 'background', paint: { 'background-color': '#121417' } },
    { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-brightness-max': 0.82, 'raster-saturation': -0.15, 'raster-contrast': 0.08 } },
    { id: 'names', type: 'raster', source: 'names', paint: { 'raster-opacity': 0.85 } }
  ]
};

/** Stil vorab laden: ohne erreichbare Grundkarte feuert MapLibre nie „load“ – dann leere Fläche statt Stillstand. */
async function fetchStyle(kind) {
  if (kind === 'sat') return SAT_STYLE;
  const light = kind === 'light';
  try {
    const res = await fetch(`https://tiles.openfreemap.org/styles/${light ? 'positron' : 'dark'}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const style = await res.json();
    // Dunkel: neutrales Anthrazit statt Blauschwarz, Wasser gedämpft.
    if (!light) {
      for (const l of style.layers) {
        if (l.type === 'background') l.paint = { ...l.paint, 'background-color': '#16191d' };
        if (l.id === 'water') l.paint = { ...l.paint, 'fill-color': '#1d2630' };
      }
    }
    return style;
  } catch {
    toast('Grundkarte nicht erreichbar – Live-Daten laufen trotzdem.');
    return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': light ? '#eceef1' : '#16191d' } }] };
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
      geometry: f.geometry || { type: 'Point', coordinates: [f.lon, f.lat] }, // Flächen (Warnungen, Nacht) bringen ihre Geometrie mit
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
    layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4cc3d9', 'line-width': 7, 'line-opacity': 0.12, 'line-blur': 2 } });
  map.addLayer({ id: 'lk-overlay-track', type: 'line', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'track'],
    layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4cc3d9', 'line-width': 2.2 } });
  map.addLayer({ id: 'lk-overlay-route', type: 'line', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'route'],
    paint: { 'line-color': '#dfeef2', 'line-width': 1.6, 'line-opacity': 0.75, 'line-dasharray': [2, 2.5] } });
  map.addLayer({ id: 'lk-overlay-airport', type: 'circle', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'airport'],
    paint: { 'circle-radius': 5, 'circle-color': '#16191d', 'circle-stroke-color': '#4cc3d9', 'circle-stroke-width': 2 } });
  // Das angetippte Objekt selbst: immer sichtbar (auch wenn die Ebene beim Herauszoomen nichts mehr lädt), hervorgehoben.
  map.addLayer({ id: 'lk-overlay-self-ring', type: 'circle', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'self'],
    paint: { 'circle-radius': 17, 'circle-color': 'rgba(76,195,217,.14)', 'circle-stroke-color': '#4cc3d9', 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'lk-overlay-self', type: 'symbol', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'self'],
    layout: { 'icon-image': ['get', 'icon'], 'icon-size': 1, 'icon-rotate': ['coalesce', ['get', 'heading'], 0], 'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true },
    paint: { 'icon-color': '#ffffff', 'icon-halo-color': '#4cc3d9', 'icon-halo-width': 2 } });
  if (map.getStyle()?.glyphs) {
    map.addLayer({ id: 'lk-overlay-label', type: 'symbol', source: 'lk-overlay', filter: ['==', ['get', 'role'], 'airport'],
      layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
      paint: { 'text-color': '#4cc3d9', 'text-halo-color': 'rgba(0,0,0,.8)', 'text-halo-width': 1.2 } });
  }
}

function setOverlay(features) {
  map.getSource('lk-overlay')?.setData({ type: 'FeatureCollection', features: [...follow(features), ...selfMarker()] });
}

/** Weg und Route hängen am angetippten Objekt: der bisherige Weg endet und die geplante Route beginnt an der
    hochgerechneten Position von jetzt – sonst klaffen sie bis zum nächsten Nachladen (30–60 s) auseinander. */
function follow(features) {
  if (!current?.l.compact || !features.length) return features;
  const pos = currentPos(current.l, current.p.id);
  if (!pos) return features;
  return features.map((f) => {
    const c = f.geometry.type === 'LineString' ? f.geometry.coordinates : null;
    if (!c || c.length < 2) return f;
    const role = f.properties.role;
    if (role === 'track') return { ...f, geometry: { type: 'LineString', coordinates: [...c.slice(0, -1), pos] } };
    if (role === 'route') return { ...f, geometry: { type: 'LineString', coordinates: [pos, ...trimPassed(c, pos)] } };
    return f;
  });
}

/** Routenpunkte, die schon hinter dem Objekt liegen, weglassen (der nächste Punkt der Route, dann der Rest). */
function trimPassed(c, pos) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < Math.min(c.length, 60); i++) {
    const d = (c[i][0] - pos[0]) ** 2 + (c[i][1] - pos[1]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return c.slice(best + 1).length ? c.slice(best + 1) : c.slice(-1);
}

/** Markierung des angetippten Flugzeugs/Schiffs an der hochgerechneten Position. */
function selfMarker() {
  if (!current?.l.compact) return [];
  const pos = currentPos(current.l, current.p.id) || current.pos || current.coords;
  if (!pos) return [];
  const st = motion.get(current.l.id)?.get(current.p.id);
  const heading = st?.f.heading ?? current.p.heading ?? current.p.hdg ?? current.p.cog ?? 0;
  return [{ type: 'Feature', geometry: { type: 'Point', coordinates: pos },
    properties: { role: 'self', icon: current.l.id === 'flights' ? 'lk-plane' : 'lk-ship', heading: Number(heading) || 0 } }];
}

function ensureInstalled(l) {
  if (map.getSource(srcId(l))) return;
  if (l.raster) {
    // Rasterkacheln (Regenradar): erst einhängen, wenn die aktuelle Kachel-Adresse bekannt ist (refresh).
    const url = runtime.get(l.id).rasterUrl;
    if (!url) return;
    map.addSource(srcId(l), { type: 'raster', tiles: [url], tileSize: 256, maxzoom: l.raster.maxzoom, attribution: l.attribution });
    map.addLayer({ id: `${srcId(l)}-raster`, type: 'raster', source: srcId(l), paint: { 'raster-opacity': l.raster.opacity, 'raster-fade-duration': 0 } }, below());
    return;
  }
  // Quellennachweis hängt an der Quelle: MapLibre zeigt ihn nur, solange die Ebene sichtbar ist.
  if (l.tiles) map.addSource(srcId(l), { type: 'vector', tiles: [l.tiles.url], maxzoom: l.tiles.maxzoom, attribution: l.attribution });
  else map.addSource(srcId(l), { type: 'geojson', data: toGeoJSON(runtime.get(l.id).features), attribution: l.attribution, ...(l.sourceOptions || {}) });
  // Genaue Liste des Ausschnitts (bewegt sich flüssig), zusätzlich zu den Übersichtskacheln
  if (l.live) map.addSource(`${srcId(l)}-live`, { type: 'geojson', data: toGeoJSON([]) });
  l.install(map, srcId(l), below());
  // Ebenen-Handler überleben setStyle; nur einmal binden, sonst öffnet ein Klick die Details mehrfach.
  if (bound.has(l.id) || l.noclick) return;
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
      // Fläche (Warngebiet) unter einem Punkt (Flugzeug, Kamera …): der Punkt hat Vorrang, sonst öffnen beide nacheinander.
      if (f.geometry.type !== 'Point' && map.queryRenderedFeatures(e.point).some((x) => x.geometry.type === 'Point' && LAYERS.some((o) => !o.noclick && srcId(o) === x.source.replace(/-live$/, '')))) return;
      // Vektorkacheln tragen die Kennung am Feature, nicht in den Properties. Flächen: Koordinaten der angetippten Stelle.
      const at = f.geometry.type === 'Point' ? f.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
      showDetail(l, { ...f.properties, id: f.properties.id ?? f.id ?? f.properties.mmsi }, at);
    });
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  }
}

/** Flächen und Raster unter Punkte und Routen legen: vor die erste eigene Punkt-/Linienebene. */
function below() {
  return map.getLayer('lk-overlay-glow') ? 'lk-overlay-glow' : undefined;
}

function layerIds(l) {
  return (map.getStyle()?.layers || []).filter((x) => x.source === srcId(l) || x.source === `${srcId(l)}-live`).map((x) => x.id);
}

function setVisible(l, on) {
  const liveOn = runtime.get(l.id).liveOn;
  for (const id of layerIds(l)) {
    const isLive = map.getLayer(id)?.source === `${srcId(l)}-live`;
    // Mit Ausschnitt-Liste die Kacheln ausblenden und umgekehrt
    const show = on && (!l.live || isLive === Boolean(liveOn));
    map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
  }
}

/* ---------- Flüssige Bewegung ----------
   Zwischen zwei Meldungen rechnet die App jede Position mit Geschwindigkeit und Kurs bis „jetzt“ weiter
   (Koppelnavigation). Kommt eine neue Meldung, gleitet das Symbol weich dorthin statt zu springen. */

const BLEND_MS = 1500;
const motion = new Map(); // Ebene → (Kennung → Zustand)

function setMotion(l, features, at) {
  const now = Date.now();
  const old = motion.get(l.id) || new Map();
  const next = new Map();
  for (const f of features) {
    const st = { f, m: l.motion(f, at), lon: f.lon, lat: f.lat, blend: 0 };
    const prev = old.get(f.id);
    if (prev) { [st.fromLon, st.fromLat] = posOf(prev, now); st.blend = now; }
    next.set(f.id, st);
  }
  motion.set(l.id, next);
}

function posOf(st, now) {
  let lon = st.lon, lat = st.lat;
  if (st.m) {
    const km = (st.m.kmh * Math.min(Math.max(0, now - st.m.t0), st.m.max)) / 3_600_000;
    const c = (st.m.course * Math.PI) / 180;
    lat += (km * Math.cos(c)) / 111.32;
    lon += (km * Math.sin(c)) / (111.32 * Math.cos((lat * Math.PI) / 180));
  }
  if (st.blend) {
    const k = Math.min(1, (now - st.blend) / BLEND_MS);
    if (k < 1) {
      const e = k * k * (3 - 2 * k); // weich anfahren und abbremsen
      lon = st.fromLon + (lon - st.fromLon) * e;
      lat = st.fromLat + (lat - st.fromLat) * e;
    } else st.blend = 0;
  }
  return [lon, lat];
}

/** Aktuelle (hochgerechnete) Position eines Objekts, z. B. für Route und Weg in der Detailkarte. */
function currentPos(l, id) {
  const st = motion.get(l.id)?.get(id);
  return st ? posOf(st, Date.now()) : null;
}

function motionGeoJSON(l) {
  const now = Date.now();
  const out = [];
  for (const st of motion.get(l.id)?.values() || []) {
    const [lon, lat] = posOf(st, now);
    out.push({ ...st.f, lon, lat });
  }
  return toGeoJSON(out);
}

let lastFrame = 0;
function tick(ts) {
  requestAnimationFrame(tick);
  if (document.hidden) return;
  // Bei sehr vielen Objekten seltener neu zeichnen, damit das Handy flüssig bleibt
  const total = LAYERS.reduce((n, l) => n + (active.has(l.id) && l.motion ? motion.get(l.id)?.size || 0 : 0), 0);
  if (ts - lastFrame < (total > 4000 ? 300 : total > 1500 ? 180 : 110)) return;
  lastFrame = ts;
  if (current?.l.compact && map.isSourceLoaded('lk-overlay')) setOverlay(current.overlay || []);
  for (const l of LAYERS) {
    if (!l.motion || !active.has(l.id) || !motion.get(l.id)?.size) continue;
    if (l.live && !runtime.get(l.id).liveOn) continue;
    const id = l.live ? `${srcId(l)}-live` : srcId(l);
    // Erst neue Positionen schicken, wenn die vorigen verarbeitet sind – sonst staut sich der Worker
    // und die Grundkarte lädt keine Kacheln mehr.
    if (!map.getSource(id) || !map.isSourceLoaded(id)) continue;
    map.getSource(id).setData(motionGeoJSON(l));
  }
}
requestAnimationFrame(tick);

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

  if (l.raster) {
    try {
      const { url, at } = await l.raster.url();
      if (!active.has(l.id)) return;
      if (url !== rt.rasterUrl) {
        rt.rasterUrl = url;
        const src = map.getSource(srcId(l));
        if (src) src.setTiles([url]);
        else { ensureInstalled(l); setVisible(l, true); }
      }
      rt.at = at;
      rt.error = null;
    } catch (e) {
      rt.error = !navigator.onLine ? 'Keine Internetverbindung' : `Quelle nicht erreichbar: ${e.message}`;
    }
    renderChrome();
    if (active.has(l.id)) rt.timer = setTimeout(() => refresh(l), l.refresh);
    return;
  }

  if (l.compute) {
    // Lokal berechnet (Tag/Nacht): kein Netz nötig.
    rt.features = l.compute(new Date());
    rt.at = Date.now();
    rt.error = null;
    render(l);
    rt.timer = setTimeout(() => refresh(l), l.refresh);
    return;
  }

  if (l.tiles) {
    const now = Date.now();
    // Kacheln mit neuem Zeitstempel anfordern (die Quelle cached nur kurz), Zählen übernimmt countTiles.
    if (!rt.tilesAt) rt.tilesAt = now;
    else if (now - rt.tilesAt >= l.refresh) { map.getSource(srcId(l))?.setTiles([`${l.tiles.url}?t=${now}`]); rt.tilesAt = now; }
    rt.at = now;
    rt.error = null;
    if (l.live) await refreshLive(l, rt);
    renderChrome();
    if (active.has(l.id)) rt.timer = setTimeout(() => refresh(l), l.live ? l.live.refresh : l.refresh);
    return;
  }

  const plan = l.requests(map);
  rt.hint = plan.hint || null;
  rt.note = plan.note || null;
  const every = plan.every || l.refresh;
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
    rt.at = ok.map((r) => Date.parse(r.at)).reduce((a, b) => Math.min(a, b));
    rt.stale = ok.some((r) => r.stale);
  }
  rt.error = failed.length
    ? !navigator.onLine ? 'Keine Internetverbindung'
      : `${failed.length === results.length ? 'Quelle nicht erreichbar' : `${failed.length} von ${results.length} Bereichen fehlen`}: ${failed[0].error.message.replace(/^Quelle nicht erreichbar – /, '')}`
    : null;
  render(l);
  rt.timer = setTimeout(() => refresh(l), every);
}

/** Genaue Liste des Ausschnitts holen, wenn nah genug herangezoomt; sonst zeigen die Kacheln die Übersicht. */
async function refreshLive(l, rt) {
  const b = map.getBounds();
  const box = [b.getWest(), Math.max(-85, b.getSouth()), b.getEast(), Math.min(85, b.getNorth())];
  const area = (box[2] - box[0]) * (box[3] - box[1]);
  let on = false;
  if (map.getZoom() >= l.live.minzoom && area <= l.live.maxArea) {
    const ctrl = new AbortController();
    rt.ctrl = ctrl;
    try {
      rt.liveFeatures = l.live.parse(await getJSON(l.live.url(box), ctrl.signal));
      setMotion(l, rt.liveFeatures, Date.now());
      map.getSource(`${srcId(l)}-live`)?.setData(motionGeoJSON(l));
      on = true;
    } catch {
      if (ctrl.signal.aborted) return;
    }
  }
  if (rt.liveOn !== on) { rt.liveOn = on; setVisible(l, active.has(l.id)); }
  if (on) rt.features = rt.liveFeatures; else countTiles();
}

function render(l) {
  const src = map.getSource(srcId(l));
  if (src && !l.tiles) {
    if (l.motion) {
      setMotion(l, runtime.get(l.id).features, runtime.get(l.id).at || Date.now());
      src.setData(motionGeoJSON(l));
    } else src.setData(toGeoJSON(runtime.get(l.id).features));
  }
  renderChrome();
}

/* ---------- Kopfleiste, Dock, Ebenen-Panel ---------- */

const num = (n) => n.toLocaleString('de-DE');
const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON_OPTS = '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>';
const ICON_FAV = '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7.9-5.6-4-3.9 5.6-.8z"/>';

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
  if (rt.stale) return { text: `${ago(rt.at)} · Quelle hängt, ältere Daten`, cls: 'hint' };
  return { text: rt.note ? `${ago(rt.at)} · ${rt.note}` : ago(rt.at), cls: rt.note ? 'hint' : '' };
}

/** Dock-Tasten in Ebenen-Reihenfolge: eine Ebene samt ihrer Gruppenmitglieder (Livestreams unter „Kameras“)
    oder ein Menü aus DOCK_GROUPS („Wetter“, „Sonstige“), das seine Ebenen im Panel zum einzelnen Schalten zeigt. */
const DOCK = [];
for (const l of LAYERS) {
  if (!l.group) DOCK.push({ lead: l, members: [l, ...LAYERS.filter((x) => x.group === l.id)] });
  else if (DOCK_GROUPS[l.group] && !DOCK.some((g) => g.lead.id === l.group)) {
    DOCK.push({ lead: DOCK_GROUPS[l.group], members: LAYERS.filter((x) => x.group === l.group), menu: true });
  }
}
// Menüs ans Ende des Dock (vor „Ebenen“/„Wand“), in der Reihenfolge von DOCK_GROUPS
const menuRank = (g) => (g.menu ? 1 + Object.keys(DOCK_GROUPS).indexOf(g.lead.id) : 0);
DOCK.sort((a, b) => menuRank(a) - menuRank(b));
const groupOn = (g) => g.members.some((l) => active.has(l.id));
let panelGroup = null; // null = alle Ebenen, sonst id eines Menüs

const count = (l) => runtime.get(l.id).features.length;
const short = (n) => (n > 999 ? `${Math.round(n / 1000)}k` : n);

function dockButton(g) {
  const l = g.lead;
  const mine = g.members.filter((x) => active.has(x.id));
  const rts = mine.map((x) => runtime.get(x.id));
  const err = rts.some((rt) => rt.error);
  if (g.menu) {
    // Menü: Zahl = eingeschaltete Ebenen; „an“, sobald eine läuft.
    const open = !$('#panel').hidden && panelGroup === l.id;
    const extra = l.id === 'wx' && wx.kind ? 1 : 0; // Wetterkarte zählt mit
    return `<button class="dk ${mine.length + extra || open ? 'on' : ''}" style="--c:${l.color}" data-menu="${l.id}" aria-expanded="${open}" title="${esc(`${l.name}: ${g.members.map((x) => x.name).join(', ')}`)}">
      ${svg(l.icon)}<span>${esc(l.short)}</span><i class="n ${err ? 'err' : ''}">${mine.length + extra}</i></button>`;
  }
  const on = mine.length > 0;
  const n = mine.reduce((s, x) => s + count(x), 0);
  const badge = !on ? 0 : rts.every((rt) => rt.error && !rt.at) ? '!' : rts.every((rt) => rt.hint) ? '–' : short(n);
  return `<button class="dk ${on ? 'on' : ''}" style="--c:${l.color}" data-group="${l.id}" aria-pressed="${on}" title="${esc(g.members.length > 1 ? 'Kameras: Live-Video und Standbilder' : l.name)}">
      ${svg(l.icon)}<span>${esc(l.short)}</span><i class="n ${err ? 'err' : ''}">${badge}</i></button>`;
}

function layerRow(l) {
  const s = status(l);
  const cnt = !active.has(l.id) ? 'aus' : l.nocount ? 'an' : num(count(l));
  return `<button class="layer ${active.has(l.id) ? 'on' : ''}" style="--c:${l.color}" data-layer="${l.id}" aria-pressed="${active.has(l.id)}">
          <i class="bar"></i><span><b>${esc(l.name)}</b><small class="${s.cls}">${esc(s.text)}</small></span>
          <span class="cnt">${cnt}</span></button>`;
}

function renderChrome() {
  $('#dock').innerHTML = DOCK.map(dockButton).join('') + '<div class="dk-sep"></div>'
    + `<button class="dk ${!$('#panel').hidden && panelGroup === 'opts' ? 'on' : ''}" data-act="opts" title="Kartenstil">${svg(ICON_OPTS)}<span>Optionen</span></button>`
    + `<button class="dk ${favs.size ? 'on' : ''}" style="--c:var(--warn)" data-act="wall" title="Favoriten">${svg(ICON_FAV)}<span>Favoriten</span><i class="n">${favs.size}</i></button>`;

  // Kopfzeilen-Zähler nur für die Hauptebenen (Kameras zusammen); Menü-Ebenen zählt ihr Panel.
  $('#stats').innerHTML = DOCK.filter((g) => !g.menu).map((g) => {
    const mine = g.members.filter((l) => active.has(l.id) && (runtime.get(l.id).at || runtime.get(l.id).hint));
    if (!mine.length) return '';
    const hint = mine.every((l) => runtime.get(l.id).hint) ? runtime.get(mine[0].id).hint : '';
    const label = g.members.length > 1 ? g.lead.short : g.lead.name;
    return `<div class="stat glass" style="--c:${g.lead.color}" title="${esc(hint)}"><b>${hint ? '–' : num(mine.reduce((s, l) => s + count(l), 0))}</b><span><i></i>${esc(label)}</span></div>`;
  }).join('');

  if (!$('#panel').hidden) {
    const menu = panelGroup && DOCK.find((g) => g.menu && g.lead.id === panelGroup);
    const head = (title) => `<div class="p-head"><b>${esc(title)}</b><button class="ic" data-act="panel-close" aria-label="Schließen">×</button></div>`;
    if (panelGroup === 'opts') {
      $('#panel').innerHTML = head('Optionen')
        + `<div class="p-sub">Kartenstil</div><div class="seg">
          ${[['dark', 'Dunkel'], ['light', 'Hell'], ['sat', 'Satellit']].map(([k, n]) => `<button data-base="${k}" class="${base === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    } else if (menu && menu.lead.id === 'wx') {
      $('#panel').innerHTML = head('Wetter')
        + `<div class="p-sub">Wetterkarte mit Zeitleiste</div><div class="seg">
          <button data-wx="" class="${wx.kind ? '' : 'on'}">Aus</button>${Object.entries(KINDS).map(([k, v]) => `<button data-wx="${k}" class="${wx.kind === k ? 'on' : ''}">${v.short}</button>`).join('')}</div>`
        + `<button class="row-btn" data-act="fc">Vorhersage 16 Tage für die Kartenmitte<small>Mit eingeschalteter Wetterkarte: beliebige Stelle antippen</small></button>`
        + `<div class="p-sub">Weitere Ebenen</div>${menu.members.map(layerRow).join('')}`;
    } else {
      $('#panel').innerHTML = head(menu ? menu.lead.name : 'Ebenen') + (menu ? menu.members : LAYERS).map(layerRow).join('');
    }
  }

  const errors = LAYERS.filter((l) => active.has(l.id) && runtime.get(l.id).error);
  $('#clock').classList.toggle('warn', errors.length > 0 || !navigator.onLine);
  $('#sys').textContent = !navigator.onLine ? 'Offline' : errors.length ? `${errors.length} Quelle${errors.length > 1 ? 'n' : ''} gestört` : 'System online';
}

function setLayer(l, on) {
  if (on === active.has(l.id)) return;
  if (on) active.add(l.id); else active.delete(l.id);
  setVisible(l, on);
  if (on) refresh(l); else { clearTimeout(runtime.get(l.id).timer); runtime.get(l.id).ctrl?.abort(); }
}

function toggleLayer(id) {
  const l = LAYERS.find((x) => x.id === id);
  if (!l) return;
  setLayer(l, !active.has(id));
  prefs.layers = [...active];
  save();
  renderChrome();
}

/** Dock-Taste: alle Ebenen der Gruppe gemeinsam an bzw. aus (an, sobald eine aus ist und keine läuft). */
function toggleGroup(id) {
  const g = DOCK.find((x) => x.lead.id === id);
  if (!g) return;
  const on = !groupOn(g);
  for (const l of g.members) setLayer(l, on);
  prefs.layers = [...active];
  save();
  renderChrome();
}

async function setBase(kind) {
  if (kind === base) return;
  base = kind;
  prefs.base = kind;
  save();
  applyTheme();
  map.setStyle(await fetchStyle(kind));
  // setStyle verwirft eigene Ebenen → nach dem Laden neu einhängen.
  map.once('style.load', installAll);
  renderChrome();
}

/** Panel öffnen (alle Ebenen oder ein Menü); dieselbe Taste noch einmal schließt es. */
function openPanel(group) {
  const same = !$('#panel').hidden && panelGroup === group;
  panelGroup = group;
  $('#panel').hidden = same;
  if (!same) closeDetail();
  renderChrome();
}

function onChromeClick(e) {
  const t = e.target.closest('[data-layer],[data-group],[data-menu],[data-act],[data-base],[data-wx]');
  if (!t) return;
  if (t.dataset.group) toggleGroup(t.dataset.group);
  else if (t.dataset.menu) openPanel(t.dataset.menu);
  else if (t.dataset.layer) toggleLayer(t.dataset.layer);
  else if (t.dataset.base) setBase(t.dataset.base);
  else if (t.dataset.act === 'opts') openPanel('opts');
  else if (t.dataset.wx !== undefined) setWxKind(t.dataset.wx || null);
  else if (t.dataset.act === 'fc') openForecast(map.getCenter().toArray());
  else if (t.dataset.act === 'panel-close') { $('#panel').hidden = true; renderChrome(); }
  else if (t.dataset.act === 'wall') openWall();
}
$('#dock').addEventListener('click', onChromeClick);
$('#panel').addEventListener('click', onChromeClick);

function tickClock() {
  $('#utc').textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
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
  const live = runtime.get(l.id)?.features.find((f) => f.id === p.id);
  const pos = currentPos(l, p.id) || (live ? [live.lon, live.lat] : coords);
  const ctrl = new AbortController();
  try {
    const r = await l.more(live ? { ...p, ...live.props, id: live.id } : p, pos, (url) => getJSON(url, ctrl.signal));
    if (run !== moreRun || !current) return;
    const box = $('#detail .more');
    if (box && r.html !== undefined) box.innerHTML = r.html;
    if (r.summary) { const el = $('#detail .sum'); if (el) el.innerHTML = r.summary; }
    setOverlay(r.overlay || []);
    current.overlay = r.overlay || [];
    current.pos = pos;
    // Beim ersten Laden die ganze Route ins Bild holen
    if (!current.fitted && current.overlay.length) { current.fitted = true; fitRoute(); }
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
  const fav = d.fav ? `<button class="ic fav ${favs.has(favKey(l, p)) ? 'on' : ''}" data-act="fav" aria-label="Favorit" title="Zu den Favoriten">★</button>` : '';
  const [lon, lat] = coords || [];
  // Flugzeuge/Schiffe: erst kompakt (Name, eine Zeile, Route/Details), damit die Karte mit der Route sichtbar bleibt.
  const sum = l.compact ? `<div class="d-sum"><p class="sum">${d.summary || ''}</p><div class="d-act">
      <button class="btn" data-act="route">Route</button><button class="btn ghost" data-act="expand">Details ▾</button></div></div>` : '';
  $('#detail').innerHTML = `<div class="d-head"><span class="caps">${d.kicker || esc(l.name)}</span><b class="d-mint">${d.title}</b>${fav}
      <button class="ic" data-act="min" aria-label="Einklappen" title="Einklappen">▾</button>
      <button class="ic" data-act="close" aria-label="Schließen">×</button></div>
    <div class="d-body"><div class="d-title"><h2>${d.title}</h2>${d.chip ? `<span class="chip ${d.chip.cls}">${d.chip.text}</span>` : ''}</div>${sum}${d.body}
    ${coords ? `<div class="coords"><span>${lat.toFixed(4)}° N · ${lon.toFixed(4)}° E</span><span>${esc(l.name)}</span></div>` : ''}</div>`;
  $('#detail').classList.toggle('compact', Boolean(l.compact));
  $('#detail').classList.remove('min');
  $('#detail').hidden = false;
  $('#panel').hidden = true;
  startImages($('#detail'));
  setOverlay([]);
  loadMore();
  renderChrome();
}

/** Ausschnitt so wählen, dass Weg und Route ganz zu sehen sind – neben bzw. über der Infokarte, nicht darunter. */
function fitRoute() {
  if (!current) return;
  const pts = [current.pos || current.coords];
  for (const f of current.overlay || []) {
    if (f.geometry.type === 'Point') pts.push(f.geometry.coordinates);
    else pts.push(...f.geometry.coordinates);
  }
  const ok = pts.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (!ok.length) return;
  const b = new maplibregl.LngLatBounds(ok[0], ok[0]);
  for (const c of ok) b.extend(c);
  const r = $('#detail').getBoundingClientRect();
  const mobile = innerWidth <= 760;
  const pad = mobile
    ? { top: 76, left: 30, right: 30, bottom: Math.max(90, innerHeight - r.top + 24) }
    : { top: 76, bottom: 50, right: 100, left: Math.min(innerWidth / 2, r.right + 30) };
  map.fitBounds(b, { padding: pad, maxZoom: 11, duration: 900 });
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

function setMin(min) {
  const box = $('#detail');
  box.classList.toggle('min', min);
  const btn = box.querySelector('[data-act="min"]');
  if (btn) { btn.textContent = min ? '▴' : '▾'; const t = min ? 'Aufklappen' : 'Einklappen'; btn.title = t; btn.setAttribute('aria-label', t); }
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
  toast(favs.has(key) ? `„${p.label || p.name}“ ist jetzt ein Favorit` : 'Aus den Favoriten entfernt');
  renderChrome();
}

$('#detail').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') return closeDetail();
  // Einklappen auf die Kopfzeile; im eingeklappten Zustand klappt ein Tipp auf die Kopfzeile wieder auf.
  if (act === 'min' || (!act && $('#detail').classList.contains('min') && e.target.closest('.d-head'))) return setMin(!$('#detail').classList.contains('min'));
  if (act === 'route') return fitRoute();
  if (act === 'expand') {
    const open = $('#detail').classList.toggle('compact') === false;
    e.target.closest('[data-act]').textContent = open ? 'Weniger ▴' : 'Details ▾';
    return;
  }
  if (act === 'fav') return toggleFav(e.target.closest('[data-act]'));
  const btn = e.target.closest('button.player');
  if (btn) playVideo(btn);
});

/* ---------- Wetterkarte mit Zeitleiste ----------
   Pro Zeitpunkt EIN Bild in Bildschirmauflösung für den sichtbaren Ausschnitt (MapLibre-Bildquelle) statt vieler
   hochskalierter Kacheln: scharf und nur eine Abfrage. Zwei Bildquellen im Wechsel: das neue Bild lädt vorab
   (Image-Cache des Browsers), dann wird überblendet; die nächsten Zeitpunkte lädt die App im Voraus. */

const WX_BUF = ['lk-wx-a', 'lk-wx-b'];
const wxSources = new Set(); // eingehängte Puffer (nach setStyle leer)
let wxFront = 0;
const wxImgs = new Map(); // URL → Promise (Bild geladen)

/** Ausschnitt plus 20 % Rand je Seite (beim Verschieben bleibt Wetter sichtbar, bis das neue Bild da ist),
    begrenzt auf ±180°/±85°, und Bildgröße in Gerätepixeln (Faktor höchstens 1,5, Kante höchstens 2048). */
function wxView() {
  const c = map.getCanvas();
  const W = c.clientWidth, H = c.clientHeight, pad = 0.2;
  const a = map.unproject([-W * pad, -H * pad]), z = map.unproject([W * (1 + pad), H * (1 + pad)]);
  const v = { w: Math.max(-180, a.lng), e: Math.min(180, z.lng), s: Math.max(-85, z.lat), n: Math.min(85, a.lat) };
  if (!(v.e > v.w) || !(v.n > v.s)) Object.assign(v, { w: -180, e: 180, s: -85, n: 85 });
  const nw = map.project([v.w, v.n]), se = map.project([v.e, v.s]);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let width = Math.max(64, (se.x - nw.x) * dpr), height = Math.max(64, (se.y - nw.y) * dpr);
  const k = Math.min(1, 2048 / Math.max(width, height));
  width = Math.round(width * k); height = Math.round(height * k);
  return { box: v, width, height, coords: [[v.w, v.n], [v.e, v.n], [v.e, v.s], [v.w, v.s]] };
}

function wxUrl(step, view) {
  return imageUrl(step.layer, step.t, view.box, view.width, view.height, step.ref);
}

/** Bild vorab laden (einmal je URL) und als blob:-Adresse merken – der DWD sendet keine Cache-Header, der Browser
    würde das Bild sonst für die Kartenquelle ein zweites Mal holen. Fehler → null (Zeitleiste hängt nicht). */
function wxPreload(url) {
  if (!wxImgs.has(url)) {
    while (wxImgs.size > 60) {
      const [old, p] = wxImgs.entries().next().value;
      wxImgs.delete(old);
      p.then((u) => u && setTimeout(() => URL.revokeObjectURL(u), 10_000));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    wxImgs.set(url, fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok && (r.headers.get('content-type') || '').startsWith('image/') ? r.blob() : null))
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer)));
  }
  return wxImgs.get(url);
}

function wxPut(buf, url, coords) {
  const id = WX_BUF[buf];
  const src = map.getSource(id);
  if (src) { src.updateImage({ url, coordinates: coords }); return; }
  // Bildquellen kennen kein „attribution“ (MapLibre lehnt die Quelle sonst still ab) – Nachweis steht in der Legende.
  map.addSource(id, { type: 'image', url, coordinates: coords });
  map.addLayer({ id: `${id}-r`, type: 'raster', source: id, paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 200 }, 'raster-fade-duration': 0 } }, below());
  wxSources.add(id);
}

/** Warten, bis die Bildquelle ihr neues Bild übernommen hat. isSourceLoaded() gibt bei Bildquellen nichts
    Brauchbares zurück, daher auf das „sourcedata“-Ereignis hören; das Bild liegt schon als blob: vor (schnell). */
function wxLoaded(id, ms = 800) {
  return new Promise((done) => {
    const finish = () => { clearTimeout(t); map.off('sourcedata', on); done(); };
    const on = (e) => { if (e.sourceId === id && e.dataType === 'source') requestAnimationFrame(finish); };
    const t = setTimeout(finish, ms);
    map.on('sourcedata', on);
  });
}

/** Nächste Zeitpunkte im Voraus laden (beim Abspielen mehr). */
function wxPrefetch(view, count) {
  for (let k = 1; k <= count; k++) {
    const st = wx.steps[(wx.idx + k) % wx.steps.length];
    if (st) wxPreload(wxUrl(st, view));
  }
}

/** Schritt i zeigen: Bild für den aktuellen Ausschnitt laden, in den hinteren Puffer, dann überblenden. */
async function showStep(i, instant = false) {
  if (!wx.steps.length) return;
  wx.idx = Math.max(0, Math.min(wx.steps.length - 1, i));
  renderWxBar();
  const run = ++wx.run;
  const view = wxView();
  const blob = await wxPreload(wxUrl(wx.steps[wx.idx], view));
  if (run !== wx.run || !wx.kind) return;
  if (!blob) { wxPrefetch(view, 2); return; } // Bild fehlt (DWD gerade nicht erreichbar): altes Bild stehen lassen
  const back = instant ? wxFront : 1 - wxFront;
  wxPut(back, blob, view.coords);
  await wxLoaded(WX_BUF[back]);
  if (run !== wx.run || !wx.kind) return;
  map.setPaintProperty(`${WX_BUF[back]}-r`, 'raster-opacity', KINDS[wx.kind].opacity);
  if (back !== wxFront && map.getLayer(`${WX_BUF[wxFront]}-r`)) map.setPaintProperty(`${WX_BUF[wxFront]}-r`, 'raster-opacity', 0);
  wxFront = back;
  wxPrefetch(view, wx.playing ? 8 : 3);
}

// Ausschnitt geändert: aktuelles Bild für den neuen Ausschnitt nachladen
let wxMove = 0;
map.on('moveend', () => {
  if (!wx.kind || !wx.steps.length) return;
  clearTimeout(wxMove);
  wxMove = setTimeout(() => { if (!wx.playing) showStep(wx.idx); }, 250);
});

function wxRemove() {
  for (const id of WX_BUF) {
    if (map.getLayer(`${id}-r`)) map.removeLayer(`${id}-r`);
    if (map.getSource(id)) map.removeSource(id);
  }
  wxSources.clear();
}

async function setWxKind(kind) {
  wx.run++;
  wx.playing = false;
  clearTimeout(wx.timer);
  wx.kind = KINDS[kind] ? kind : null;
  prefs.wx = wx.kind;
  save();
  wx.steps = [];
  wx.error = null;
  wx.legend = false;
  wxRemove();
  renderWxBar();
  renderChrome();
  if (!wx.kind) return;
  const kindNow = wx.kind;
  try {
    // Regen: das Radar (eine schnelle Quelle) sofort zeigen, die Modellvorhersage hängt sich danach an
    if (KINDS[kindNow].layers[0].radar) {
      const first = await buildSteps(kindNow, Date.now(), 1).catch(() => null);
      if (wx.kind !== kindNow) return;
      if (first) { wx.steps = first; showStep(nowIndex(first)); }
    }
    const steps = await buildSteps(kindNow);
    if (wx.kind !== kindNow) return;
    const t = wx.steps[wx.idx]?.t;
    wx.steps = steps;
    wx.loadedAt = Date.now();
    if (t === undefined) await showStep(nowIndex(steps));
    else { wx.idx = nearestStep(steps, t); renderWxBar(); }
  } catch (e) {
    if (wx.kind !== kindNow) return;
    wx.error = !navigator.onLine ? 'Keine Internetverbindung' : e.message;
    renderWxBar();
  }
}

/** Neue Radarbilder und Modellläufe: Schritte alle 15 min neu holen, aktuelle Zeit beibehalten. */
async function wxReload() {
  if (!wx.kind || wx.playing || !wx.steps.length || Date.now() - (wx.loadedAt || 0) < 15 * 60_000) return;
  const kindNow = wx.kind;
  const t = wx.steps[wx.idx].t;
  try {
    const steps = await buildSteps(kindNow);
    if (wx.kind !== kindNow || wx.playing) return;
    wx.steps = steps;
    wx.loadedAt = Date.now();
    showStep(nearestStep(steps, t));
  } catch { /* nächster Versuch beim nächsten Takt */ }
}
setInterval(wxReload, 60_000);

function togglePlay() {
  wx.playing = !wx.playing;
  clearTimeout(wx.timer);
  renderWxBar();
  if (!wx.playing) return;
  const next = async () => {
    if (!wx.playing || !wx.steps.length) return;
    await showStep(wx.idx >= wx.steps.length - 1 ? 0 : wx.idx + 1);
    if (wx.playing) wx.timer = setTimeout(next, 450);
  };
  next();
}

function renderWxBar() {
  const bar = $('#wxbar');
  document.body.classList.toggle('wx-on', Boolean(wx.kind));
  if (!wx.kind) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  const k = KINDS[wx.kind];
  const step = wx.steps[wx.idx];
  const lab = step ? stepLabel(step.t) : null;
  const when = wx.error ? `<b>${esc(k.name)}</b><span class="err">${esc(wx.error)}</span>`
    : !step ? `<b>${esc(k.name)}</b><span>Lädt …</span>`
      : `<b>${esc(lab.day)}, ${esc(lab.time)}</b><span>${esc(lab.rel)} · ${esc(step.src === 'Radar' ? 'Radar, gemessen' : step.src === 'Radar-Vorhersage' ? 'Radar-Vorhersage' : `Vorhersage ${step.src}`)}</span>`;
  // Regler und Tagesmarken nur neu bauen, wenn sich die Schritte geändert haben (sonst springt der Daumen beim Ziehen)
  const sig = `${wx.kind}|${wx.steps.length}|${wx.steps[0]?.t}`;
  if (bar.dataset.sig !== sig) {
    bar.dataset.sig = sig;
    const ticks = dayTicks(wx.steps).map((d) => `<i style="left:${(d.pos * 100).toFixed(2)}%">${esc(d.label)}</i>`).join('');
    bar.innerHTML = `<div class="wx-row">
        <button class="ic wx-play" data-wxact="play" aria-label="Abspielen"></button>
        <div class="wx-when"></div>
        <button class="chipbtn" data-wxact="legend">Legende</button>
        <button class="ic" data-wxact="close" aria-label="Wetterkarte ausblenden">×</button>
      </div>
      <div class="wx-track"><input type="range" min="0" max="1000" step="1" aria-label="Zeitpunkt"><div class="wx-ticks">${ticks}</div></div>
      <div class="wx-legend" hidden></div>`;
  }
  bar.querySelector('.wx-when').innerHTML = when;
  const play = bar.querySelector('.wx-play');
  play.textContent = wx.playing ? '❚❚' : '▶';
  play.setAttribute('aria-label', wx.playing ? 'Anhalten' : 'Abspielen');
  play.disabled = !wx.steps.length;
  // Regler als Zeitachse (0..1000): Tage sind gleich breit, egal ob stündliche oder 3-stündliche Schritte
  const range = bar.querySelector('input[type=range]');
  const t0 = wx.steps[0]?.t, span = (wx.steps.at(-1)?.t - t0) || 1;
  if (document.activeElement !== range && step) range.value = String(Math.round(((step.t - t0) / span) * 1000));
  range.disabled = !wx.steps.length;
  // Radar-Abschnitt (gemessen) auf der Leiste andeuten
  const lastRadar = wx.steps.filter((s) => s.src === 'Radar').at(-1);
  range.style.setProperty('--radar', lastRadar ? `${((lastRadar.t - t0) / span) * 100}%` : '0%');
  const leg = bar.querySelector('.wx-legend');
  leg.hidden = !wx.legend;
  if (wx.legend) {
    const layer = step?.layer || k.layers[0].wms;
    leg.innerHTML = `<img alt="Legende ${esc(k.name)}" src="${esc(legendUrl(layer))}"><p>Daten: <a href="https://www.dwd.de" target="_blank" rel="noopener">Deutscher Wetterdienst</a> (Radar, ICON, GeoNutzV)</p>`;
  }
}

let wxDrag = 0;
$('#wxbar').addEventListener('input', (e) => {
  if (e.target.type !== 'range') return;
  if (wx.playing) { wx.playing = false; clearTimeout(wx.timer); }
  const t0 = wx.steps[0]?.t, span = (wx.steps.at(-1)?.t - t0) || 1;
  wx.idx = nearestStep(wx.steps, t0 + (Number(e.target.value) / 1000) * span);
  renderWxBar();
  clearTimeout(wxDrag);
  wxDrag = setTimeout(() => showStep(wx.idx), 120);
});
$('#wxbar').addEventListener('click', (e) => {
  const act = e.target.closest('[data-wxact]')?.dataset.wxact;
  if (act === 'play') togglePlay();
  else if (act === 'close') setWxKind(null);
  else if (act === 'legend') { wx.legend = !wx.legend; renderWxBar(); }
});

/* ---------- Vorhersage für einen Ort (16 Tage) ---------- */

const FORECAST = {
  id: 'forecast',
  name: 'Wettervorhersage',
  detail() {
    return {
      title: 'Wetter an diesem Ort',
      kicker: 'Vorhersage · 16 Tage',
      chip: { text: 'Open-Meteo', cls: 'acc' },
      body: '<div class="more">Lädt Vorhersage …</div><p class="src">Daten: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0), Modelle u. a. DWD ICON</p>'
    };
  },
  async more(p, pos) {
    try {
      return { html: forecastHtml(await forecast(pos[0], pos[1])) };
    } catch (e) {
      return { html: `<p class="noimg">Vorhersage nicht abrufbar: ${esc(e.message)}</p>` };
    }
  }
};

function openForecast(lonlat) {
  $('#panel').hidden = true;
  showDetail(FORECAST, { id: `${lonlat[0].toFixed(3)},${lonlat[1].toFixed(3)}` }, lonlat);
}

// Mit eingeschalteter Wetterkarte: leere Stelle antippen = Vorhersage dort
map.on('click', (e) => {
  if (!wx.kind) return;
  const hit = map.queryRenderedFeatures(e.point).some((f) => LAYERS.some((o) => !o.noclick && srcId(o) === String(f.source).replace(/-live$/, '')));
  if (!hit) openForecast([e.lngLat.lng, e.lngLat.lat]);
});

/* ---------- Favoriten ---------- */

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
      <button class="ic" data-act="unfav" title="Aus den Favoriten entfernen" aria-label="Aus den Favoriten entfernen">×</button></header>${media}</article>`;
  }).join('');
  $('#walltiles').innerHTML = tiles || '<p class="w-empty">Noch keine Favoriten.<br>Kamera oder Livestream öffnen und den Stern ★ antippen.</p>';
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
  return fold([f.label, p.name, p.channel, p.area, p.place, p.callsign, p.reg, p.type, p.title, p.headline, p.event, p.water, p.country, f.id].filter(Boolean).join(' '));
}

/* Suche: zuerst was geladen ist (sofort), dann weltweit nachgeladen – Schiffe nach Namen/MMSI (Open Waters),
   Flüge nach genauem Rufzeichen/Kennzeichen (adsb.lol über den Proxy) und Orte (Photon/OpenStreetMap). */
let searchRun = 0;
let searchTimer = 0;
let searchCtrl = null;
let remote = { ships: [], flights: [], places: [], busy: false };

function localHits(terms) {
  const out = [];
  for (const l of LAYERS) {
    if (!active.has(l.id) || l.nocount) continue; // Polarlicht: nichts zum Suchen
    for (const f of runtime.get(l.id).features) {
      const t = searchText(l, f);
      if (terms.every((w) => t.includes(w))) out.push({ l, f, starts: fold(f.label).startsWith(terms[0]) });
      if (out.length > 400) break;
    }
  }
  out.sort((a, b) => (b.starts - a.starts) || LAYERS.indexOf(a.l) - LAYERS.indexOf(b.l) || a.f.label.localeCompare(b.f.label, 'de'));
  return out.slice(0, 30);
}

async function remoteSearch(raw, run) {
  const L = (id) => LAYERS.find((l) => l.id === id);
  const c = map.getCenter();
  searchCtrl?.abort();
  const ctrl = new AbortController();
  searchCtrl = ctrl;
  const json = async (url) => {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  const ships = raw.length >= 2
    ? json(`https://ais.openwaters.io/v1/vessels?q=${encodeURIComponent(raw)}&around=${c.lat.toFixed(2)},${c.lng.toFixed(2)}`)
      // Nur Schiffsstationen (MMSI 2xx–7xx), keine Rettungsboote/Funkbaken (97x/98x/99x)
      .then((fc) => L('ships').live.parse(fc).filter((f) => /^[2-7]\d{8}$/.test(String(f.props.mmsi))).slice(0, 15)).catch(() => [])
    : Promise.resolve([]);
  const flights = /^[a-z0-9][a-z0-9-]{1,9}$/i.test(raw)
    ? json(`/api/feed/find?q=${encodeURIComponent(raw)}`).then((r) => r.features || []).catch(() => [])
    : Promise.resolve([]);
  // Orte nur für Wörter – bei Rufzeichen/MMSI liefert der Ortsdienst nur Zufallstreffer
  const places = raw.length >= 3 && !/\d/.test(raw)
    ? json(`https://photon.komoot.io/api/?q=${encodeURIComponent(raw)}&limit=5&lang=de&lat=${c.lat.toFixed(2)}&lon=${c.lng.toFixed(2)}`)
      .then((fc) => (fc.features || []).filter((f) => f.geometry?.type === 'Point').map((f) => {
        const p = f.properties || {};
        return { name: p.name || p.street || raw, sub: [p.city !== p.name ? p.city : null, p.state, p.country].filter(Boolean).join(', '),
          center: f.geometry.coordinates, extent: Array.isArray(p.extent) ? p.extent : null };
      })).catch(() => [])
    : Promise.resolve([]);
  remote.busy = true;
  const [s, f, pl] = await Promise.all([ships, flights, places]);
  if (run !== searchRun) return;
  remote = { ships: s, flights: f, places: pl, busy: false };
  renderSearch();
}

function runSearch() {
  const raw = $('#q').value.trim();
  const run = ++searchRun;
  remote = { ships: [], flights: [], places: [], busy: raw.length >= 2 };
  clearTimeout(searchTimer);
  searchCtrl?.abort();
  if (raw.length >= 2) searchTimer = setTimeout(() => remoteSearch(raw, run), 300);
  renderSearch();
}

function renderSearch() {
  const raw = $('#q').value.trim();
  const terms = fold(raw).split(/\s+/).filter(Boolean);
  const L = (id) => LAYERS.find((l) => l.id === id);
  const local = terms.length ? localHits(terms) : [];
  const seen = new Set(local.map((h) => `${h.l.id}:${h.f.id}`));
  const world = [
    ...remote.flights.map((f) => ({ l: L('flights'), f, world: true })),
    ...remote.ships.map((f) => ({ l: L('ships'), f, world: true }))
  ].filter((h) => !seen.has(`${h.l.id}:${h.f.id}`));
  // Eine Liste: Name beginnt mit dem Suchwort zuerst (AIDA-Schiffe vor dem Kennzeichen D-AIDA), dann Geladenes vor Weltweitem
  const score = (h) => (fold(h.f.label).startsWith(terms[0] || '') ? 2 : 0) + (h.world ? 0 : 1);
  const things = [...local, ...world].map((h, n) => ({ h, n, sc: score(h) })).sort((a, b) => b.sc - a.sc || a.n - b.n).map((x) => x.h).slice(0, 40);
  hits = [...things, ...remote.places.map((p) => ({ place: p }))];
  sel = 0;
  const row = (h, i) => h.place
    ? `<button class="r" style="--c:var(--muted)" data-i="${i}"><i></i><span>${esc(h.place.name)}<small>${esc(h.place.sub)}</small></span><em>Ort</em></button>`
    : `<button class="r" style="--c:${h.l.color}" data-i="${i}"><i></i>
        <span>${esc(h.f.label)}${h.world ? ' <b class="r-w">weltweit</b>' : ''}<small>${esc(h.f.props.channel || h.f.props.area || h.f.props.place || h.f.props.destination || (typeof h.f.props.type === 'string' ? h.f.props.type : '') || (h.f.props.mmsi ? `MMSI ${h.f.props.mmsi}` : ''))}</small></span><em>${esc(h.l.short)}</em></button>`;
  const head = (t) => `<div class="r-head">${t}</div>`;
  let i = 0;
  const block = (title, list) => (list.length ? head(title) + list.map((h) => row(h, i++)).join('') : '');
  const html = block('Treffer', things) + block('Orte', hits.filter((h) => h.place));
  $('#results').innerHTML = !terms.length
    ? '<p class="r-empty">Schiffe (Name, MMSI), Flüge (Rufzeichen wie DLH4AB, Kennzeichen wie D-AIBA), Kameras, Livestreams und Orte.</p>'
    : html + (remote.busy ? '<p class="r-empty">Sucht weltweit …</p>' : html ? '' : '<p class="r-empty">Nichts gefunden.</p>');
  $('#results').querySelector('.r')?.classList.add('sel');
}

function pick(i) {
  const h = hits[i];
  if (!h) return;
  closeSearch();
  if (h.place) {
    const e = h.place.extent;
    if (e && e[0] !== e[2]) map.fitBounds([[e[0], e[3]], [e[2], e[1]]], { padding: 40, maxZoom: 14, speed: 1.6 });
    else map.flyTo({ center: h.place.center, zoom: Math.max(map.getZoom(), 13), speed: 1.6 });
    return;
  }
  // Treffer aus der weltweiten Suche: Ebene dafür einschalten
  if (!active.has(h.l.id)) { setLayer(h.l, true); prefs.layers = [...active]; save(); renderChrome(); }
  // Schiffe/Flüge: direkt hinspringen statt zu fliegen – ein Flug über halb Europa lädt Hunderte Zwischenkacheln,
  // die dann abbrechen (Open Waters erlaubt 600 Kacheln/min); den Ausschnitt mit Route stellt danach fitRoute ein.
  const target = { center: [h.f.lon, h.f.lat], zoom: Math.max(map.getZoom(), h.l.id === 'flights' ? 8 : h.l.id === 'ships' ? 10 : 13) };
  if (h.l.compact) map.jumpTo(target); else map.flyTo({ ...target, speed: 1.6 });
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
  // setStyle verwirft auch die Wetterkarte → aktuellen Zeitpunkt neu einhängen
  wxSources.clear();
  if (wx.kind && wx.steps.length) showStep(wx.idx, true);
}

/** Objekte aus den geladenen Vektorkacheln übernehmen (für Zähler, Suche und Detail-Aktualisierung). */
function countTiles() {
  for (const l of LAYERS) {
    if (!l.tiles || !active.has(l.id) || !map.getSource(srcId(l)) || runtime.get(l.id).liveOn) continue;
    const byId = new Map();
    for (const f of map.querySourceFeatures(srcId(l), { sourceLayer: l.tiles.layer })) {
      const p = f.properties;
      if (p.kind && p.kind !== 'vessel') continue;
      const id = String(f.id ?? p.mmsi);
      if (byId.has(id) || f.geometry.type !== 'Point') continue;
      const [lon, lat] = f.geometry.coordinates;
      byId.set(id, { id, lon, lat, heading: p.hdg ?? null, label: p.name || `MMSI ${p.mmsi}`, props: { ...p, id } });
    }
    runtime.get(l.id).features = [...byId.values()];
  }
  renderChrome();
}
// Schiffskacheln, die nicht geladen werden konnten (abgebrochen, Limit erreicht), bleiben sonst bis zum nächsten
// Takt (60 s) leer: nach einem Fehler die Kacheln mit neuem Zeitstempel bald noch einmal anfordern.
let tileRetry = 0;
map.on('error', (e) => {
  const l = LAYERS.find((x) => x.tiles && srcId(x) === e.sourceId);
  if (!l || !active.has(l.id)) return;
  clearTimeout(tileRetry);
  tileRetry = setTimeout(() => {
    const rt = runtime.get(l.id);
    rt.tilesAt = Date.now();
    map.getSource(srcId(l))?.setTiles([`${l.tiles.url}?t=${rt.tilesAt}`]);
  }, 5000);
});

let idleTimer = 0;
const recount = () => { clearTimeout(idleTimer); idleTimer = setTimeout(countTiles, 400); };
map.on('idle', recount);
map.on('sourcedata', (e) => { if (e.isSourceLoaded && LAYERS.some((l) => l.tiles && srcId(l) === e.sourceId)) recount(); });

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
  // Zuletzt gewählte Wetterkarte wiederherstellen
  if (wx.kind && !wx.steps.length) setWxKind(wx.kind);
  renderWxBar();
}
if (map.isStyleLoaded()) start(); else map.once('style.load', start);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
