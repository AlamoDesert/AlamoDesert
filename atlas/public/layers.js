/* Live Karten – Ebenen. Jede Ebene beschreibt, welche Abfragen sie für den aktuellen Ausschnitt braucht,
   wie oft sie aktualisiert und wie sie sich auf der Karte zeigt. Neue Quellen: Eintrag hier + Quelle in sources.mts. */

// Muss zu CELL in netlify/functions/feed/sources.mts passen.
const CELL = 4;
// Bis FULL_CELLS Zellen wird der ganze Ausschnitt alle 10 s geladen; weiter herausgezoomt die MAX_CELLS Zellen
// um die Kartenmitte, seltener – sonst zu viele Abfragen bei den freien Quellen.
const FULL_CELLS = 16;
const MAX_CELLS = 48;

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
const fmt = (n, d = 0) => (typeof n === 'number' ? n.toLocaleString('de-DE', { maximumFractionDigits: d }) : '–');

function row(label, value) {
  return value === null || value === undefined || value === '' ? '' : `<dt>${esc(label)}</dt><dd>${value}</dd>`;
}

/** Zellmittelpunkte (4°-Gitter), die den Kartenausschnitt abdecken, die Mitte zuerst; höchstens MAX_CELLS.
    `partial` = Ausschnitt größer, nur die Zellen um die Mitte. */
export function cellsFor(bounds) {
  const south = Math.max(-88, bounds.getSouth());
  const north = Math.min(88, bounds.getNorth());
  let west = bounds.getWest();
  let east = bounds.getEast();
  if (east - west >= 360) { west = -180; east = 180; }
  const midLat = (south + north) / 2, midLon = (west + east) / 2;
  const cells = new Map();
  for (let la = Math.floor(south / CELL) * CELL; la < north; la += CELL) {
    for (let lo = Math.floor(west / CELL) * CELL; lo < east; lo += CELL) {
      const lon = ((((lo + CELL / 2) + 180) % 360) + 360) % 360 - 180; // über die Datumsgrenze hinweg normalisieren
      const key = `${la + CELL / 2},${lon}`;
      // Abstand zur Mitte in Grad, Längengrade mit dem Breitengrad gestaucht
      const d = Math.hypot(la + CELL / 2 - midLat, (lo + CELL / 2 - midLon) * Math.cos((la + CELL / 2) * Math.PI / 180));
      if (!cells.has(key) || cells.get(key) > d) cells.set(key, d);
    }
  }
  const sorted = [...cells].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  return { cells: sorted.slice(0, MAX_CELLS), partial: sorted.length > MAX_CELLS, full: sorted.length <= FULL_CELLS };
}

/** Flugzeug-Symbol als SDF-Bild (einfärbbar über icon-color), Nase zeigt nach oben = Norden. */
function planeImage(size = 48) {
  const c = document.createElement('canvas'); // OffscreenCanvas fehlt in Safari < 16.4
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 24, size / 24);
  g.fillStyle = '#fff';
  g.fill(new Path2D('M12 1.5c.9 0 1.5 1 1.5 2.2v5.6l8 4.6v2.2l-8-2.4v4.6l2.4 1.8v1.8L12 21l-3.9.9v-1.8l2.4-1.8v-4.6l-8 2.4v-2.2l8-4.6V3.7c0-1.2.6-2.2 1.5-2.2z'));
  return g.getImageData(0, 0, size, size);
}

/** AIS-Schiffstyp → Klartext. */
function shipKind(t) {
  if (typeof t !== 'number') return null;
  const named = { 30: 'Fischerei', 31: 'Schlepper', 32: 'Schlepper', 33: 'Baggerschiff', 34: 'Taucherschiff', 35: 'Militär', 36: 'Segelboot', 37: 'Sportboot',
    50: 'Lotse', 51: 'Rettung', 52: 'Schlepper', 53: 'Hafenschiff', 55: 'Behörde', 58: 'Krankentransport' };
  if (named[t]) return named[t];
  return { 2: 'Bodeneffektfahrzeug', 4: 'Schnellfähre', 6: 'Passagierschiff', 7: 'Frachtschiff', 8: 'Tanker' }[Math.floor(t / 10)] || null;
}

/** Schiffssymbol als SDF-Bild, Bug zeigt nach oben = Norden. */
function shipImage(size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 24, size / 24);
  g.fillStyle = '#fff';
  g.fill(new Path2D('M12 2.5c2.2 2.4 3.4 5 3.4 8.2v9.3c0 .9-.7 1.5-1.5 1.5h-3.8c-.8 0-1.5-.6-1.5-1.5v-9.3c0-3.2 1.2-5.8 3.4-8.2z'));
  return g.getImageData(0, 0, size, size);
}

/** Kamera-Anbieter mit Abdeckung [West, Süd, Ost, Nord]; abgefragt wird nur, was im Ausschnitt liegt. */
const CA = [-124.6, 32.4, -114.0, 42.1];
const CAM_PROVIDERS = [
  { p: 'tfl', bbox: [-0.65, 51.25, 0.4, 51.72], name: 'TfL JamCams', refresh: 60 },
  { p: 'nyc', bbox: [-74.3, 40.45, -73.65, 40.95], name: 'NYC DOT', refresh: 10 },
  { p: 'fi', bbox: [19.0, 59.5, 31.7, 70.2], name: 'Digitraffic', refresh: 120 },
  { p: 'fw', bbox: [5.5, 44.0, 17.5, 55.2], name: 'foto-webcam.eu', refresh: 600 },
  ...Array.from({ length: 12 }, (_, i) => ({ p: `caltrans-${i + 1}`, bbox: CA, name: 'Caltrans', refresh: 30 }))
];
const CAM_INFO = Object.fromEntries(CAM_PROVIDERS.map((c) => [c.p.replace(/-\d+$/, ''), c]));

function intersects(bounds, [w, s, e, n]) {
  if (bounds.getEast() - bounds.getWest() >= 360) return bounds.getSouth() <= n && bounds.getNorth() >= s;
  return bounds.getWest() <= e && bounds.getEast() >= w && bounds.getSouth() <= n && bounds.getNorth() >= s;
}

/** YouTube-Kennung (11 Zeichen); alles andere landet nie in einer Adresse. */
const ytId = (v) => (typeof v === 'string' && /^[\w-]{11}$/.test(v) ? v : null);
/** Eingebettete Player nur von bekannten Anbietern, die das Einbetten ausdrücklich anbieten. */
export const EMBED_HOSTS = ['g0.ipcamlive.com', 'v.angelcam.com', 'player.livespotting.com'];
const embedUrl = (u) => {
  if (!safeUrl(u)) return null;
  try { return EMBED_HOSTS.includes(new URL(u).hostname) ? u : null; } catch { return null; }
};
const hlsUrl = (u) => (safeUrl(u) && /\.m3u8(\?|$)/.test(u) ? u : null);


/* ---------- Nachladen beim Antippen: Foto, Route, Weg ---------- */

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Großkreis-Entfernung in km. */
export function distKm([lon1, lat1], [lon2, lat2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Punkte entlang des Großkreises (so sehen Flugrouten auf der Karte richtig aus). */
export function greatCircle(a, b, n = 48) {
  const [l1, p1, l2, p2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const d = distKm(a, b) / R;
  if (d < 1e-6) return [a, b];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return out;
}

/** Zielpunkt bei Kurs und Strecke (für den voraussichtlichen Kurs der Schiffe). */
function ahead([lon, lat], courseDeg, km) {
  const d = km / R, c = rad(courseDeg), p = rad(lat);
  const p2 = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(c));
  const l2 = rad(lon) + Math.atan2(Math.sin(c) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(p2));
  return [deg(l2), deg(p2)];
}

const line = (coords, role) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { role } });
const spot = (coords, role, label) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: { role, label } });

function photoHtml(src, by, link, source) {
  if (!safeUrl(src)) return '<p class="noimg">Kein Foto vorhanden</p>';
  const credit = `${by ? `© ${esc(by)}` : ''}${source ? ` · ${esc(source)}` : ''}`;
  return `<figure class="photo"><img src="${esc(src)}" alt="Foto" referrerpolicy="no-referrer" loading="lazy">`
    + `<figcaption>${safeUrl(link) ? `<a href="${esc(link)}" target="_blank" rel="noopener">${credit}</a>` : credit}</figcaption></figure>`;
}

const airportName = (a) => (a ? `${esc(a.iata || a.icao || '')}${a.city || a.name ? ` · ${esc(a.city || a.name)}` : ''}` : null);

/** Abspielknopf: der Player lädt erst nach dem Antippen – vorher erfährt der Anbieter nichts vom Besuch. */
function playButton(attr, value, via) {
  return `<button class="player" ${attr}="${esc(value)}" aria-label="Livestream abspielen"><span class="play" aria-hidden="true">▶</span>`
    + `<span>Abspielen<small>${esc(via)}</small></span></button>`;
}

/** Farben wie Argos: Video magenta, Standbild blau, Akzent türkis. */
export const COLORS = { live: '#f0506e', image: '#5b9cf5', accent: '#4cc3d9' };

/** Gruppen und Punkte im HUD-Stil: dunkle Gruppe mit farbigem Ring, Punkt mit Leuchthof. */
function pointLayers(map, src, color, { radius = [5, 5, 14, 8] } = {}) {
  map.addLayer({
    id: `${src}-cluster`, type: 'circle', source: src, filter: ['has', 'point_count'],
    paint: {
      'circle-color': color,
      'circle-opacity': 0.22,
      'circle-radius': ['step', ['get', 'point_count'], 13, 10, 16, 50, 20, 500, 26],
      'circle-stroke-color': color,
      'circle-stroke-width': 2
    }
  });
  // Zahl in der Gruppe braucht Schriften aus dem Kartenstil; der Ersatzstil hat keine.
  if (map.getStyle()?.glyphs) {
    map.addLayer({
      id: `${src}-count`, type: 'symbol', source: src, filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11.5, 'text-allow-overlap': true, 'text-font': ['Noto Sans Bold'] },
      paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.6)', 'text-halo-width': 1 }
    });
  }
  map.addLayer({
    id: `${src}-glow`, type: 'circle', source: src, filter: ['!', ['has', 'point_count']],
    paint: { 'circle-color': color, 'circle-radius': ['interpolate', ['linear'], ['zoom'], radius[0], radius[1] * 2.4, radius[2], radius[3] * 2.4], 'circle-blur': 1, 'circle-opacity': 0.22 }
  });
  map.addLayer({
    id: `${src}-pt`, type: 'circle', source: src, filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': color,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], ...radius],
      'circle-stroke-color': 'rgba(255,255,255,.9)',
      'circle-stroke-width': 1.2
    }
  });
}

/** Menüs im Dock: Ebenen mit `group: '<id>'` erscheinen im Panel des Menüs und lassen sich dort einzeln schalten. */
export const DOCK_GROUPS = {
  wx: {
    id: 'wx',
    name: 'Wetter',
    short: 'Wetter',
    color: '#7fb4ff',
    icon: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.2 4.2 0 0 0 7 18z"/>'
  }
};

const when = (v) => {
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : null;
};


/** Punkte mit Farbe aus einer Eigenschaft (match), z. B. Pegel nach Wasserstand. */
function dotLayer(map, src, color, radius = [2, 3.5, 8, 7]) {
  map.addLayer({
    id: `${src}-pt`, type: 'circle', source: src,
    paint: {
      'circle-color': color,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], ...radius],
      'circle-stroke-color': 'rgba(0,0,0,.55)',
      'circle-stroke-width': 1
    }
  });
}

const PEGEL_STATE = { low: ['Niedrigwasser', '#ffd23b'], normal: ['normal', '#4dabf7'], high: ['Hochwasser', '#e03131'] };
const SEVERITY = { Minor: ['Wetterwarnung', 'acc'], Moderate: ['Markantes Wetter', 'warn'], Severe: ['Unwetter', 'live'], Extreme: ['Extremes Unwetter', 'live'] };

export const LAYERS = [
  {
    id: 'live',
    group: 'cams', // läuft im Dock unter „Kameras“
    name: 'Kameras · Video',
    short: 'Live',
    color: COLORS.live,
    icon: '<path d="M3.5 7.5h11v9h-11z"/><path d="M14.5 10.5 20.5 7v10l-6-3.5"/>',
    desc: 'Live-Videos aus Deutschland (YouTube, Webcams)',
    attribution: 'Livestreams: <a href="https://www.youtube.com" target="_blank" rel="noopener">YouTube</a> · <a href="https://www.ipcamlive.com" target="_blank" rel="noopener">IPCamLive</a> · <a href="https://www.angelcam.com" target="_blank" rel="noopener">Angelcam</a> · Verzeichnis <a href="https://worldcam.eu" target="_blank" rel="noopener">worldcam.eu</a> · Rechte bei den jeweiligen Betreibern',
    // Feste, auf dem Pi geprüfte Liste (tools/livestreams.mjs); kein Proxy nötig.
    url: 'data/livestreams.json',
    fixed: true,
    refresh: 3_600_000,
    minzoom: 0,
    viewport: false,
    sourceOptions: { cluster: true, clusterRadius: 36, clusterMaxZoom: 9 },
    requests() { return { queries: [''] }; },
    install(map, src) { pointLayers(map, src, COLORS.live); },
    detail(p) {
      const yt = p.kind === 'yt' ? ytId(p.video) : null;
      const embed = p.kind === 'embed' ? embedUrl(p.embed) : null;
      const hls = p.kind === 'hls' ? hlsUrl(p.hls) : null;
      const site = safeUrl(p.site);
      const player = yt ? playButton('data-yt', yt, 'lädt den Player von YouTube')
        : embed ? playButton('data-embed', embed, `lädt den Player von ${p.channel || 'Anbieter'}`)
          : hls ? playButton('data-hls', hls, `Video direkt von ${p.channel || 'Anbieter'}`)
            : '<p class="noimg">Kein Video verfügbar</p>';
      const links = [
        yt ? `<a class="ext" href="https://www.youtube.com/watch?v=${yt}" target="_blank" rel="noopener">Auf YouTube öffnen ›</a>` : '',
        site ? `<a class="ext" href="${esc(site)}" target="_blank" rel="noopener">Seite des Betreibers ›</a>` : '',
        hls ? `<a class="ext" href="${esc(hls)}" target="_blank" rel="noopener">Stream öffnen ›</a>` : ''
      ].join('');
      return {
        title: esc(p.name),
        kicker: `Livestream · ${esc(p.channel || '')}`,
        chip: { text: 'Live', cls: 'live' },
        fav: true,
        body: player
          + `<dl>${row('Betreiber', esc(p.channel))}${row('Quelle', esc({ yt: 'YouTube-Livestream', embed: 'Webcam-Player des Betreibers', hls: 'Direkter Videostream' }[p.kind] || null))}</dl>`
          + (links ? `<div class="links">${links}</div>` : '')
      };
    }
  },
  {
    id: 'cams',
    name: 'Kameras · Standbild',
    short: 'Kameras',
    color: COLORS.image,
    icon: '<path d="M4 8.5h3.2l1.8-2.5h6l1.8 2.5H20v10H4z"/><circle cx="12" cy="13.3" r="3.2"/>',
    desc: 'Alpen und Süddeutschland, London, New York, Kalifornien, Finnland',
    attribution: 'Kameras: <a href="https://tfl.gov.uk" target="_blank" rel="noopener">TfL</a> · <a href="https://webcams.nyctmc.org" target="_blank" rel="noopener">NYC DOT</a> · <a href="https://cwwp2.dot.ca.gov" target="_blank" rel="noopener">Caltrans</a> · <a href="https://www.digitraffic.fi" target="_blank" rel="noopener">Fintraffic / Digitraffic</a> (CC BY 4.0) · <a href="https://www.foto-webcam.eu" target="_blank" rel="noopener">foto-webcam.eu</a>',
    refresh: 600_000,
    minzoom: 2,
    viewport: true,
    sourceOptions: { cluster: true, clusterRadius: 42, clusterMaxZoom: 12 },
    requests(map) {
      if (map.getZoom() < this.minzoom) return { hint: 'Zum Anzeigen näher heranzoomen' };
      const b = map.getBounds();
      const hits = CAM_PROVIDERS.filter((c) => intersects(b, c.bbox));
      if (!hits.length) return { hint: 'Hier keine freien Kameras – Alpen/Süddeutschland, London, New York, Kalifornien oder Finnland' };
      return { queries: hits.map((c) => `p=${c.p}`) };
    },
    install(map, src) { pointLayers(map, src, COLORS.image, { radius: [6, 4, 14, 7] }); },
    detail(p) {
      const image = safeUrl(p.image);
      const video = safeUrl(p.video);
      const info = CAM_INFO[p.provider] || { name: p.provider, refresh: 30 };
      const every = info.refresh >= 120 ? `alle ${info.refresh / 60} min` : `alle ${info.refresh} s`;
      return {
        title: esc(p.name),
        kicker: `Verkehrskamera · ${esc(info.name)}`,
        chip: { text: `Bild · ${info.refresh >= 120 ? `${info.refresh / 60} min` : `${info.refresh} s`}`, cls: 'img' },
        fav: true,
        body: (image
          ? `<img class="cam" alt="Kamerabild ${esc(p.name)}" data-src="${esc(image)}" data-refresh="${info.refresh}" referrerpolicy="no-referrer">`
          : '<p class="noimg">Kein Bild verfügbar</p>')
          + `<dl>${row('Ort', esc(p.area))}${row('Quelle', esc(info.name))}${row('Aktualisierung', every)}</dl>`
          + `<div class="links">${image ? `<a class="ext" href="${esc(image)}" target="_blank" rel="noopener">Bild öffnen ›</a>` : ''}`
          + `${safeUrl(p.page) ? `<a class="ext" href="${esc(p.page)}" target="_blank" rel="noopener">Seite der Webcam ›</a>` : ''}`
          + `${video ? `<a class="ext" href="${esc(video)}" target="_blank" rel="noopener">Video ›</a>` : ''}</div>`
      };
    }
  },
  {
    id: 'flights',
    compact: true,
    /** Für die flüssige Darstellung: Geschwindigkeit (km/h), Kurs und Zeitpunkt der Position. */
    motion(f, at) {
      const p = f.props;
      if (p.ground || typeof p.speed_kt !== 'number' || typeof f.heading !== 'number') return null;
      return { kmh: p.speed_kt * 1.852, course: f.heading, t0: at - (typeof p.age_s === 'number' ? p.age_s * 1000 : 0), max: 90_000 };
    },
    name: 'Flugzeuge',
    short: 'Flüge',
    color: COLORS.accent,
    icon: '<path d="M12 2.5c.8 0 1.3.9 1.3 2v5.2l7.2 4.2v2l-7.2-2.2v4.1l2.2 1.6v1.6L12 20.2l-3.5.8v-1.6l2.2-1.6v-4.1l-7.2 2.2v-2l7.2-4.2V4.5c0-1.1.5-2 1.3-2z"/>',
    attribution: 'Flugdaten: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a> (ODbL) / <a href="https://airplanes.live" target="_blank" rel="noopener">airplanes.live</a>',
    desc: 'ADS-B-Positionen, alle 10 s',
    refresh: 10_000,
    minzoom: 3,
    viewport: true,
    requests(map) {
      if (map.getZoom() < this.minzoom) return { hint: 'Zum Anzeigen näher heranzoomen' };
      const { cells, partial, full } = cellsFor(map.getBounds());
      return {
        queries: cells.map((c) => `cell=${c}`),
        every: full ? this.refresh : 30_000,
        note: partial ? 'nur um die Kartenmitte – für alles näher heranzoomen' : null
      };
    },
    install(map, src) {
      if (!map.hasImage('lk-plane')) map.addImage('lk-plane', planeImage(), { sdf: true, pixelRatio: 2 });
      map.addLayer({
        id: `${src}-sym`, type: 'symbol', source: src,
        layout: {
          'icon-image': 'lk-plane',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 5, 0.55, 10, 0.9],
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          // Farbe nach Höhe: Boden grau, tief gelb, Reiseflughöhe türkis.
          'icon-color': ['case', ['==', ['get', 'ground'], 1], '#6b7884',
            ['interpolate', ['linear'], ['coalesce', ['get', 'alt_ft'], 0], 0, '#ffd23b', 10000, '#7fe3c4', 25000, '#19d6e8', 40000, '#7fb4ff']],
          'icon-halo-color': 'rgba(0,0,0,.7)',
          'icon-halo-width': 1
        }
      });
    },
    detail(p) {
      const m = typeof p.alt_ft === 'number' ? Math.round(p.alt_ft * 0.3048) : null;
      const kmh = typeof p.speed_kt === 'number' ? Math.round(p.speed_kt * 1.852) : null;
      return {
        title: esc(p.callsign || p.reg || p.id.toUpperCase()),
        kicker: `Flugzeug${p.type ? ` · ${esc(p.type)}` : ''}`,
        summary: p.ground ? 'am Boden' : [p.alt_ft === null ? null : `${fmt(p.alt_ft)} ft`, p.speed_kt === null ? null : `${fmt(p.speed_kt * 1.852)} km/h`].filter(Boolean).join(' · '),
        chip: { text: p.squawk && /^7[5-7]00$/.test(p.squawk) ? `Notfall ${esc(p.squawk)}` : 'ADS-B', cls: p.squawk && /^7[5-7]00$/.test(p.squawk) ? 'live' : 'acc' },
        body: '<div class="more">Lädt Foto und Route …</div>'
          + `<dl>${row('Kennzeichen', esc(p.reg))}${row('Typ', esc(p.type))}`
          + row('Höhe', p.ground ? 'am Boden' : p.alt_ft === null ? null : `${fmt(p.alt_ft)} ft · ${fmt(m)} m`)
          + row('Geschwindigkeit', p.speed_kt === null ? null : `${fmt(p.speed_kt)} kn · ${fmt(kmh)} km/h`)
          + row('Kurs', p.heading === null ? null : `${fmt(p.heading)}°`)
          + row('Squawk', esc(p.squawk)) + row('ICAO-Adresse', esc(p.id.toUpperCase())) + '</dl>'
          + `<a class="ext" href="https://globe.adsb.lol/?icao=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Flugverlauf auf adsb.lol ›</a>`
      };
    },
    /** Beim Antippen: Foto und Halter (planespotters/adsbdb), geplante Route, bisheriger Weg. Alle 30 s neu, solange offen. */
    async more(p, pos, get) {
      const cs = /^[A-Z0-9]{2,8}$/.test(p.callsign || '') ? p.callsign : '';
      const [info, trace] = await Promise.allSettled([
        get(`/api/feed/aircraft?hex=${encodeURIComponent(p.id)}${cs ? `&cs=${cs}` : ''}`),
        get(`/api/feed/track?hex=${encodeURIComponent(p.id)}`)
      ]);
      const a = info.status === 'fulfilled' ? info.value.features[0].props : {};
      const path = trace.status === 'fulfilled' ? trace.value.features[0].props.path : [];
      const feats = [];
      if (path.length > 1) feats.push(line([...path.map((x) => [x[0], x[1]]), pos], 'track'));
      // Route aus der Datenbank nur zeigen, wenn die Position dazu passt (Rufzeichen werden manchmal anders genutzt).
      const o = a.origin, d = a.destination;
      let plausible = false;
      if (o?.lat != null && d?.lat != null) {
        const op = [o.lon, o.lat], dp = [d.lon, d.lat];
        plausible = distKm(op, pos) + distKm(pos, dp) <= distKm(op, dp) * 1.25 + 150;
        if (plausible) {
          feats.push(line(greatCircle(pos, dp), 'route'));
          feats.push(spot(op, 'airport', o.iata || o.icao), spot(dp, 'airport', d.iata || d.icao));
        }
      }
      const rows = row('Airline', esc(a.airline)) + row('Halter', esc(a.owner)) + row('Hersteller', esc(a.manufacturer))
        + (o || d ? row(plausible ? 'Route' : 'Route (laut Datenbank, unsicher)', `${airportName(o) || '?'} → ${airportName(d) || '?'}`) : '')
        + (plausible ? row('Noch bis Ziel', `${fmt(distKm(pos, [d.lon, d.lat]))} km`) : '')
        + (path.length > 1 ? row('Weg seit Start', `${fmt(path.reduce((s, x, i) => (i ? s + distKm(path[i - 1], x) : 0), 0))} km`) : '');
      return {
        summary: o || d
          ? `${airportName(o) || '?'} → ${airportName(d) || '?'}${plausible ? ` · noch ${fmt(distKm(pos, [d.lon, d.lat]))} km Luftlinie` : ' (laut Datenbank, unsicher)'}`
          : path.length > 1 ? `Route unbekannt · ${fmt(path.reduce((s, x, i) => (i ? s + distKm(path[i - 1], x) : 0), 0))} km seit Start` : null,
        html: photoHtml(a.photo, a.photo_by, a.photo_link, a.photo_link?.includes('planespotters') ? 'planespotters.net' : null) + (rows ? `<dl>${rows}</dl>` : ''),
        overlay: feats,
        every: 30_000
      };
    }
  },
  {
    id: 'ships',
    compact: true,
    name: 'Schiffe',
    short: 'Schiffe',
    color: '#7fe3c4',
    icon: '<path d="M4 14.5h16l-2.2 4.5H6.2z"/><path d="M7 14.5V9.5h8l2 5"/><path d="M10 9.5V6.5h3v3"/>',
    attribution: 'Schiffe: <a href="https://openwaters.io/ais/#license" target="_blank" rel="noopener">Open Waters AIS</a> (AISHub, aisstream.io, BarentsWatch/Kystverket NLOD u. a.) · Fotos <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a>/Commons · Seewege <a href="https://github.com/eurostat/searoute" target="_blank" rel="noopener">Eurostat searoute</a> (EUPL-1.2) · Häfen UN/LOCODE',
    desc: 'AIS weltweit, wo Empfänger in der Nähe sind',
    // Vektorkacheln direkt von Open Waters (frei für private Nutzung, CORS offen): lädt nur den sichtbaren Ausschnitt,
    // auch bei Zehntausenden Schiffen. Neu laden = Kacheln mit neuem Zeitstempel anfordern.
    tiles: { url: 'https://ais.openwaters.io/v1/vessels/tiles/{z}/{x}/{y}', layer: 'vessels', maxzoom: 14 },
    refresh: 60_000,
    minzoom: 0,
    viewport: true, // Ausschnitt-Liste beim Verschieben neu holen
    requests() { return { queries: [] }; },
    /** Ab dieser Zoomstufe die genaue Liste des Ausschnitts (bewegt sich flüssig), darunter die Kacheln (Übersicht). */
    live: {
      minzoom: 7,
      refresh: 15_000,
      maxArea: 100, // Quadratgrad, Grenze von Open Waters ohne Schlüssel
      url: ([w, s, e, n]) => `https://ais.openwaters.io/v1/vessels?bbox=${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)}&max_age=30m`,
      parse(fc) {
        const now = Date.now();
        return (fc.features || []).filter((f) => f.properties?.kind === 'vessel' && f.geometry?.type === 'Point').map((f) => {
          const p = f.properties;
          const seen = Date.parse(p.seen) || now;
          const hdg = typeof p.heading === 'number' && p.heading < 360 ? p.heading : typeof p.cog === 'number' && p.cog < 360 ? p.cog : null;
          const [lon, lat] = f.geometry.coordinates;
          return { id: String(p.mmsi), lon, lat, heading: hdg, label: p.name || `MMSI ${p.mmsi}`,
            props: { mmsi: p.mmsi, name: p.name ?? null, type: p.type ?? null, sog: p.sog ?? null, cog: p.cog ?? null, hdg, flag: p.flag ?? null,
              length: p.length ?? null, beam: p.beam ?? null, kind: 'vessel', destination: p.destination ?? null, seen, age_s: Math.round((now - seen) / 1000) } };
        });
      }
    },
    motion(f) {
      const p = f.props;
      if (typeof p.sog !== 'number' || p.sog < 0.5 || p.sog > 60 || typeof p.cog !== 'number' || p.cog >= 360) return null;
      return { kmh: p.sog * 1.852, course: p.cog, t0: p.seen, max: 15 * 60_000 };
    },
    install(map, src) {
      if (!map.hasImage('lk-ship')) map.addImage('lk-ship', shipImage(), { sdf: true, pixelRatio: 2 });
      const type = ['coalesce', ['get', 'type'], 0];
      const look = {
        layout: {
          'icon-image': 'lk-ship',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.38, 8, 0.6, 12, 0.9],
          'icon-rotate': ['coalesce', ['get', 'hdg'], ['get', 'cog'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          // Farbe nach AIS-Typ: Fracht grün, Tanker orange, Passagiere pink, Fischerei gelb, Sport/Segeln blau, Rest grau.
          'icon-color': ['case',
            ['all', ['>=', type, 70], ['<', type, 80]], '#7fe3c4',
            ['all', ['>=', type, 80], ['<', type, 90]], '#ffb02e',
            ['any', ['all', ['>=', type, 60], ['<', type, 70]], ['all', ['>=', type, 40], ['<', type, 50]]], '#ff7a9c',
            ['==', type, 30], '#ffd23b',
            ['any', ['==', type, 36], ['==', type, 37]], '#7fb4ff',
            ['any', ['==', type, 31], ['==', type, 32], ['==', type, 52], ['==', type, 50]], '#a5c8ff',
            ['==', type, 51], '#ff3b6b',
            '#8aa0a8'],
          // Liegende Schiffe und alte Meldungen blasser
          'icon-opacity': ['case', ['>', ['coalesce', ['get', 'age_s'], 0], 1800], 0.35, ['<', ['coalesce', ['get', 'sog'], 0], 0.5], 0.6, 1],
          'icon-halo-color': 'rgba(0,0,0,.7)',
          'icon-halo-width': 1
        }
      };
      map.addLayer({ id: `${src}-sym`, type: 'symbol', source: src, 'source-layer': 'vessels', filter: ['==', ['get', 'kind'], 'vessel'], ...look });
      map.addLayer({ id: `${src}-live-sym`, type: 'symbol', source: `${src}-live`, ...look });
    },
    detail(p) {
      const moving = typeof p.sog === 'number' && p.sog >= 0.5;
      const kind = shipKind(p.type);
      return {
        title: esc(p.name || `MMSI ${p.mmsi}`),
        kicker: `Schiff${kind ? ` · ${esc(kind)}` : ''}${p.flag ? ` · ${esc(p.flag)}` : ''}`,
        summary: [esc(kind), moving ? `${fmt(p.sog, 1)} kn` : 'liegt'].filter(Boolean).join(' · '),
        chip: { text: moving ? `${fmt(p.sog, 1)} kn` : 'liegt', cls: moving ? 'acc' : 'warn' },
        fav: false,
        body: '<div class="more">Lädt Foto, Ziel und Route …</div>'
          + `<dl>${row('Typ', esc(kind))}${row('Länge', typeof p.length === 'number' && p.length ? `${fmt(p.length)} m${p.beam ? ` × ${fmt(p.beam)} m` : ''}` : null)}`
          + row('Fahrt', moving ? `${fmt(p.sog, 1)} kn · ${fmt(p.sog * 1.852, 0)} km/h` : 'liegt / ankert')
          + row('Kurs', typeof p.cog === 'number' && p.cog < 360 ? `${fmt(p.cog)}°` : null)
          + row('Flagge', esc(p.flag)) + row('MMSI', esc(p.mmsi))
          + row('Letzte Meldung', typeof p.age_s === 'number' ? (p.age_s < 90 ? `vor ${fmt(p.age_s)} s` : `vor ${fmt(p.age_s / 60)} min`) : null) + '</dl>'
          + `<a class="ext" href="https://openwaters.io/ais/" target="_blank" rel="noopener">Open Waters AIS ›</a>`
      };
    },
    /** Beim Antippen: Stammdaten und Weg der letzten Stunden (Open Waters), Foto über die IMO-Nummer (Wikidata), Kurs der nächsten Stunde. */
    async more(p, pos, get) {
      const mmsi = encodeURIComponent(p.mmsi);
      const [info, track] = await Promise.allSettled([
        get(`https://ais.openwaters.io/v1/vessels/${mmsi}`),
        get(`https://ais.openwaters.io/v1/vessels/${mmsi}/track`)
      ]);
      const v = info.status === 'fulfilled' ? info.value.properties || {} : {};
      const now = info.status === 'fulfilled' && info.value.geometry?.coordinates ? info.value.geometry.coordinates : pos;
      const path = track.status === 'fulfilled' && Array.isArray(track.value.geometry?.coordinates) ? track.value.geometry.coordinates : [];
      const feats = [];
      if (path.length > 1) feats.push(line([...path, now], 'track'));
      const sog = typeof v.sog === 'number' ? v.sog : p.sog;
      const cog = typeof v.cog === 'number' ? v.cog : p.cog;
      // Geplante restliche Route: Seeweg zum AIS-Zielhafen (Netz von Eurostat), sonst nur der Kurs der nächsten Stunde.
      let sea = null, port = null;
      if (v.destination) {
        try {
          const { findPort, seaRoute } = await import('./searoute.js');
          port = await findPort(v.destination, now);
          if (port && distKm(now, [port.lon, port.lat]) > 2) sea = await seaRoute(now, [port.lon, port.lat]);
        } catch { sea = null; }
      }
      if (sea) {
        feats.push(line(sea.path, 'route'), spot([port.lon, port.lat], 'airport', port.name));
      } else if (typeof sog === 'number' && sog >= 0.5 && typeof cog === 'number' && cog < 360) {
        feats.push(line([now, ahead(now, cog, sog * 1.852)], 'route'));
      }
      let photo = '';
      if (v.imo) {
        try {
          const ph = (await get(`/api/feed/shipphoto?imo=${encodeURIComponent(v.imo)}`)).features[0].props;
          photo = photoHtml(ph.photo, ph.photo_by, ph.photo_link, null);
        } catch { photo = ''; }
      }
      const rows = row('Ziel (AIS)', esc(v.destination)) + row('Ankunft (ETA)', esc(v.eta)) + row('In der Nähe von', esc(v.near))
        + row('Tiefgang', typeof v.draught === 'number' && v.draught ? `${fmt(v.draught, 1)} m` : null)
        + row('Rufzeichen', esc(v.callsign)) + row('IMO', v.imo ? esc(v.imo) : null)
        + (sea ? row('Route (berechnet)', `${esc(port.name)} (${esc(port.code)}) · ${fmt(sea.km)} km${typeof sog === 'number' && sog >= 0.5 ? ` · ca. ${fmt(sea.km / (sog * 1.852), 1)} h` : ''}`) : '')
        + (path.length > 1 ? row('Weg (letzte Stunden)', `${fmt(path.reduce((s, x, i) => (i ? s + distKm(path[i - 1], x) : 0), 0), 1)} km`) : '');
      const note = feats.length ? `<p class="hint-line">Durchgezogen = bisheriger Weg · gestrichelt = ${sea ? 'berechneter Seeweg zum AIS-Ziel (Schätzung, keine Navigation)' : 'Kurs der nächsten Stunde'}</p>` : '';
      const km = path.length > 1 ? path.reduce((s, x, i) => (i ? s + distKm(path[i - 1], x) : 0), 0) : 0;
      const summary = sea
        ? `→ ${esc(port.name)} · noch ${fmt(sea.km)} km${typeof sog === 'number' && sog >= 0.5 ? ` · ca. ${fmt(sea.km / (sog * 1.852), 1)} h` : ''}${km ? ` · ${fmt(km, 1)} km gefahren` : ''}`
        : [v.destination ? `Ziel ${esc(v.destination)}` : 'Ziel unbekannt', v.eta ? `ETA ${esc(v.eta)}` : null, km ? `${fmt(km, 1)} km gefahren` : null].filter(Boolean).join(' · ');
      return { html: photo + (rows ? `<dl>${rows}</dl>` : '') + note, overlay: feats, summary, every: 60_000 };
    }
  },
  /* ---------- Wetter ---------- */
  {
    id: 'warn',
    group: 'wx',
    name: 'Unwetterwarnungen (DE)',
    short: 'Warnung',
    color: '#ffb02e',
    attribution: 'Warnungen: <a href="https://www.dwd.de" target="_blank" rel="noopener">Deutscher Wetterdienst</a>',
    desc: 'Amtliche Warnungen des DWD für Deutschland',
    refresh: 300_000,
    minzoom: 0,
    viewport: false,
    requests() { return { queries: [''] }; },
    install(map, src, before) {
      map.addLayer({ id: `${src}-fill`, type: 'fill', source: src, paint: { 'fill-color': ['coalesce', ['get', 'color'], '#ffb02e'], 'fill-opacity': 0.32 } }, before);
      map.addLayer({ id: `${src}-line`, type: 'line', source: src, paint: { 'line-color': ['coalesce', ['get', 'color'], '#ffb02e'], 'line-width': 1, 'line-opacity': 0.8 } }, before);
    },
    detail(p) {
      const [sev, cls] = SEVERITY[p.severity] || ['Warnung', 'warn'];
      return {
        title: esc(p.headline || p.event),
        kicker: `${sev} · DWD`,
        chip: { text: esc(p.event || sev), cls },
        body: (p.description ? `<p class="txt">${esc(p.description)}</p>` : '')
          + (p.instruction ? `<p class="txt">${esc(p.instruction)}</p>` : '')
          + `<dl>${row('Gebiet', esc(p.area))}${row('Ab', esc(when(p.onset)))}${row('Bis', esc(when(p.expires)))}</dl>`
          + '<a class="ext" href="https://www.dwd.de/DE/wetter/warnungen_gemeinden/warnWetter_node.html" target="_blank" rel="noopener">Alle Warnungen beim DWD ›</a>'
      };
    }
  },
  {
    id: 'aurora',
    group: 'wx',
    off: true,
    nocount: true,
    noclick: true,
    name: 'Polarlicht',
    short: 'Polarlicht',
    color: '#39ff88',
    attribution: 'Polarlicht: <a href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast" target="_blank" rel="noopener">NOAA SWPC</a> (OVATION)',
    desc: 'Wahrscheinlichkeit der nächsten 30–90 min',
    refresh: 600_000,
    minzoom: 0,
    viewport: false,
    requests() { return { queries: [''] }; },
    install(map, src, before) {
      map.addLayer({
        id: `${src}-heat`, type: 'heatmap', source: src,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'p'], 8, 0.15, 50, 1],
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 3, 3, 14, 6, 90],
          'heatmap-intensity': 0.8,
          'heatmap-opacity': 0.75,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(57,255,136,0)', 0.2, 'rgba(57,255,136,.35)', 0.5, '#39ff88', 0.8, '#d6ff3b', 1, '#ff5cf0']
        }
      }, before);
    }
  },
  {
    id: 'pegel',
    group: 'wx',
    off: true,
    name: 'Pegelstände (DE)',
    short: 'Pegel',
    color: '#4dabf7',
    attribution: 'Pegel: <a href="https://www.pegelonline.wsv.de" target="_blank" rel="noopener">PEGELONLINE</a> (WSV, DL-DE/Zero 2.0)',
    desc: 'Wasserstände an Bundeswasserstraßen, alle 15 min',
    refresh: 300_000,
    minzoom: 0,
    viewport: false,
    requests() { return { queries: [''] }; },
    install(map, src) {
      dotLayer(map, src, ['match', ['get', 'state'], 'high', '#e03131', 'low', '#ffd23b', 'normal', '#4dabf7', '#6b7884'], [4, 2.5, 10, 7]);
    },
    detail(p) {
      const [state] = PEGEL_STATE[p.state] || ['keine Einstufung'];
      return {
        title: esc(p.name),
        kicker: `Pegel · ${esc(p.water)}`,
        chip: { text: esc(state), cls: p.state === 'high' ? 'live' : p.state === 'low' ? 'warn' : 'acc' },
        body: `<dl>${row('Wasserstand', typeof p.value === 'number' ? `${fmt(p.value)} ${esc(p.unit || 'cm')}` : null)}${row('Gemessen', esc(when(p.time)))}`
          + `${row('Gewässer', esc(p.water))}${row('Flusskilometer', typeof p.km === 'number' ? fmt(p.km, 1) : null)}${row('Amt', esc(p.agency))}</dl>`
          + (p.number ? `<a class="ext" href="https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=${encodeURIComponent(p.number)}" target="_blank" rel="noopener">Ganglinie bei PEGELONLINE ›</a>` : '')
      };
    }
  }
];
