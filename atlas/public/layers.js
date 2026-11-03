/* Live Karten – Ebenen. Jede Ebene beschreibt, welche Abfragen sie für den aktuellen Ausschnitt braucht,
   wie oft sie aktualisiert und wie sie sich auf der Karte zeigt. Neue Quellen: Eintrag hier + Quelle in sources.mts. */

// Muss zu CELL in netlify/functions/feed/sources.mts passen.
const CELL = 4;
const MAX_CELLS = 16;

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
const fmt = (n, d = 0) => (typeof n === 'number' ? n.toLocaleString('de-DE', { maximumFractionDigits: d }) : '–');

function row(label, value) {
  return value === null || value === undefined || value === '' ? '' : `<dt>${esc(label)}</dt><dd>${value}</dd>`;
}

/** Zellmittelpunkte (4°-Gitter), die den Kartenausschnitt abdecken; null, wenn es zu viele wären. */
export function cellsFor(bounds) {
  const south = Math.max(-88, bounds.getSouth());
  const north = Math.min(88, bounds.getNorth());
  let west = bounds.getWest();
  let east = bounds.getEast();
  if (east - west >= 360) { west = -180; east = 180; }
  const cells = new Set();
  for (let la = Math.floor(south / CELL) * CELL; la < north; la += CELL) {
    for (let lo = Math.floor(west / CELL) * CELL; lo < east; lo += CELL) {
      const lon = ((((lo + CELL / 2) + 180) % 360) + 360) % 360 - 180; // über die Datumsgrenze hinweg normalisieren
      cells.add(`${la + CELL / 2},${lon}`);
      if (cells.size > MAX_CELLS) return null;
    }
  }
  return [...cells];
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

/** Kamera-Anbieter mit Abdeckung [West, Süd, Ost, Nord]; abgefragt wird nur, was im Ausschnitt liegt. */
const CA = [-124.6, 32.4, -114.0, 42.1];
const CAM_PROVIDERS = [
  { p: 'tfl', bbox: [-0.65, 51.25, 0.4, 51.72], name: 'TfL JamCams', refresh: 60 },
  { p: 'nyc', bbox: [-74.3, 40.45, -73.65, 40.95], name: 'NYC DOT', refresh: 10 },
  { p: 'fi', bbox: [19.0, 59.5, 31.7, 70.2], name: 'Digitraffic', refresh: 120 },
  ...Array.from({ length: 12 }, (_, i) => ({ p: `caltrans-${i + 1}`, bbox: CA, name: 'Caltrans', refresh: 30 }))
];
const CAM_INFO = Object.fromEntries(CAM_PROVIDERS.map((c) => [c.p.replace(/-\d+$/, ''), c]));

function intersects(bounds, [w, s, e, n]) {
  if (bounds.getEast() - bounds.getWest() >= 360) return bounds.getSouth() <= n && bounds.getNorth() >= s;
  return bounds.getWest() <= e && bounds.getEast() >= w && bounds.getSouth() <= n && bounds.getNorth() >= s;
}

export const LAYERS = [
  {
    id: 'cams',
    name: 'Verkehrskameras',
    desc: 'London, New York, Kalifornien, Finnland',
    attribution: 'Kameras: <a href="https://tfl.gov.uk" target="_blank" rel="noopener">TfL</a> · <a href="https://webcams.nyctmc.org" target="_blank" rel="noopener">NYC DOT</a> · <a href="https://cwwp2.dot.ca.gov" target="_blank" rel="noopener">Caltrans</a> · <a href="https://www.digitraffic.fi" target="_blank" rel="noopener">Fintraffic / Digitraffic</a> (CC BY 4.0)',
    refresh: 600_000,
    minzoom: 2,
    viewport: true,
    sourceOptions: { cluster: true, clusterRadius: 42, clusterMaxZoom: 12 },
    requests(map) {
      if (map.getZoom() < this.minzoom) return { hint: 'Zum Anzeigen näher heranzoomen' };
      const b = map.getBounds();
      const hits = CAM_PROVIDERS.filter((c) => intersects(b, c.bbox));
      if (!hits.length) return { hint: 'Hier keine freien Kameras – London, New York, Kalifornien oder Finnland' };
      return { queries: hits.map((c) => `p=${c.p}`) };
    },
    install(map, src) {
      map.addLayer({
        id: `${src}-cluster`, type: 'circle', source: src, filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0c8599',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 12, 20, 16, 100, 21, 500, 27],
          'circle-stroke-color': 'rgba(255,255,255,.8)',
          'circle-stroke-width': 2
        }
      });
      // Zahl in der Gruppe braucht Schriften aus dem Kartenstil; der Ersatzstil hat keine.
      if (map.getStyle()?.glyphs) {
        map.addLayer({
          id: `${src}-count`, type: 'symbol', source: src, filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-allow-overlap': true },
          paint: { 'text-color': '#fff' }
        });
      }
      map.addLayer({
        id: `${src}-cam`, type: 'circle', source: src, filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#15aabf',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 14, 7],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5
        }
      });
    },
    detail(p) {
      const image = safeUrl(p.image);
      const video = safeUrl(p.video);
      const info = CAM_INFO[p.provider] || { name: p.provider, refresh: 30 };
      return {
        title: esc(p.name),
        body: (image
          ? `<img class="cam" alt="Kamerabild ${esc(p.name)}" data-src="${esc(image)}" data-refresh="${info.refresh}" referrerpolicy="no-referrer">`
          : '<p class="noimg">Kein Bild verfügbar</p>')
          + `<dl>${row('Ort', esc(p.area))}${row('Quelle', esc(info.name))}${row('Aktualisierung', `alle ${info.refresh} s`)}</dl>`
          + `<div class="links">${image ? `<a class="ext" href="${esc(image)}" target="_blank" rel="noopener">Bild öffnen ›</a>` : ''}`
          + `${video ? `<a class="ext" href="${esc(video)}" target="_blank" rel="noopener">Video ›</a>` : ''}</div>`
      };
    }
  },
  {
    id: 'flights',
    name: 'Flugzeuge',
    attribution: 'Flugdaten: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a> (ODbL) / <a href="https://airplanes.live" target="_blank" rel="noopener">airplanes.live</a>',
    desc: 'ADS-B-Positionen, alle 10 s',
    refresh: 10_000,
    minzoom: 5,
    viewport: true,
    requests(map) {
      if (map.getZoom() < this.minzoom) return { hint: 'Zum Anzeigen näher heranzoomen' };
      const cells = cellsFor(map.getBounds());
      if (!cells) return { hint: 'Ausschnitt zu groß – näher heranzoomen' };
      return { queries: cells.map((c) => `cell=${c}`) };
    },
    install(map, src) {
      if (!map.hasImage('lk-plane')) map.addImage('lk-plane', planeImage(), { sdf: true, pixelRatio: 2 });
      map.addLayer({
        id: `${src}-sym`, type: 'symbol', source: src,
        layout: {
          'icon-image': 'lk-plane',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 10, 0.9],
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          // Farbe nach Höhe: Boden grau, tief orange, Reiseflughöhe blau.
          'icon-color': ['case', ['==', ['get', 'ground'], 1], '#8a8f98',
            ['interpolate', ['linear'], ['coalesce', ['get', 'alt_ft'], 0], 0, '#f08c00', 10000, '#e03131', 25000, '#7048e8', 40000, '#1971c2']],
          'icon-halo-color': 'rgba(0,0,0,.55)',
          'icon-halo-width': 1
        }
      });
    },
    detail(p) {
      const m = typeof p.alt_ft === 'number' ? Math.round(p.alt_ft * 0.3048) : null;
      const kmh = typeof p.speed_kt === 'number' ? Math.round(p.speed_kt * 1.852) : null;
      return {
        title: esc(p.callsign || p.reg || p.id.toUpperCase()),
        body: `<dl>${row('Kennzeichen', esc(p.reg))}${row('Typ', esc(p.type))}`
          + row('Höhe', p.ground ? 'am Boden' : p.alt_ft === null ? null : `${fmt(p.alt_ft)} ft · ${fmt(m)} m`)
          + row('Geschwindigkeit', p.speed_kt === null ? null : `${fmt(p.speed_kt)} kn · ${fmt(kmh)} km/h`)
          + row('Kurs', p.heading === null ? null : `${fmt(p.heading)}°`)
          + row('Squawk', esc(p.squawk)) + row('ICAO-Adresse', esc(p.id.toUpperCase())) + '</dl>'
          + `<a class="ext" href="https://globe.adsb.lol/?icao=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Flugverlauf auf adsb.lol ›</a>`
      };
    }
  },
  {
    id: 'quakes',
    name: 'Erdbeben',
    attribution: 'Erdbeben: <a href="https://earthquake.usgs.gov" target="_blank" rel="noopener">USGS</a>',
    desc: 'Letzte 24 Stunden, weltweit',
    refresh: 60_000,
    minzoom: 0,
    viewport: false,
    requests() { return { queries: [''] }; },
    install(map, src) {
      map.addLayer({
        id: `${src}-circle`, type: 'circle', source: src,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'mag'], 0], 0, 2.5, 3, 5, 5, 10, 7, 20],
          'circle-color': ['interpolate', ['linear'], ['coalesce', ['get', 'mag'], 0], 1, '#fab005', 3, '#fd7e14', 5, '#e03131', 7, '#862e9c'],
          'circle-opacity': 0.75,
          'circle-stroke-color': 'rgba(0,0,0,.45)',
          'circle-stroke-width': 1
        }
      });
    },
    detail(p) {
      const url = safeUrl(p.url);
      const when = typeof p.time === 'number' ? new Date(p.time).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : null;
      return {
        title: `Magnitude ${p.mag === null ? '?' : fmt(p.mag, 1)}`,
        body: `<dl>${row('Ort', esc(p.place))}${row('Zeit', esc(when))}${row('Tiefe', p.depth_km === null ? null : `${fmt(p.depth_km, 1)} km`)}`
          + row('Tsunami-Hinweis', p.tsunami ? 'ja' : null) + '</dl>'
          + (url ? `<a class="ext" href="${esc(url)}" target="_blank" rel="noopener">Details bei USGS ›</a>` : '')
      };
    }
  }
];
