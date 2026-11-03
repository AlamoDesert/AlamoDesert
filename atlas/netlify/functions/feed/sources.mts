/* Live Karten – Quellen-Register. Reine Logik ohne Netz: baut Upstream-URLs, prüft Parameter, normalisiert Antworten.
   Jede Quelle liefert einheitliche Features, damit der Client jede Ebene gleich behandeln kann. */

export type Props = Record<string, string | number | null>;

export interface Feature {
  id: string;
  lon: number;
  lat: number;
  heading: number | null;
  label: string;
  props: Props;
}

export interface Source {
  id: string;
  /** Sekunden, die ein Ergebnis im Cache gilt (CDN und Arbeitsspeicher). */
  ttl: number;
  /** Prüft die Abfrageparameter und liefert einen stabilen Cache-Schlüssel, oder wirft ParamError. */
  key(params: URLSearchParams): string;
  /** Upstream-URLs in Reihenfolge: bei Fehler folgt die nächste. */
  urls(key: string): string[];
  /** Normalisiert die Antwort; key ist der Schlüssel aus key() (z. B. der Kamera-Anbieter). */
  parse(json: unknown, key: string): Feature[];
}

export class ParamError extends Error {}

/* ---------- Gitter für Flugzeuge ----------
   adsb.lol und airplanes.live liefern nur Umkreise (max. 250 NM ≈ 4,17°). Feste Zellen statt freier Ausschnitte:
   alle Besucher fragen dieselben Zellen ab, der Cache greift, die Quellen sehen eine Anfrage pro Zelle und TTL. */
export const CELL = 4;
export const CELL_RADIUS_NM = 250; // Halbe Zelldiagonale 2,83° < 4,17° → Zelle vollständig abgedeckt.

export function cellCenter(v: number): number {
  return Math.floor(v / CELL) * CELL + CELL / 2;
}

function parseCell(raw: string | null): [number, number] {
  if (!raw) throw new ParamError('Parameter cell fehlt (lat,lon)');
  const m = /^(-?\d{1,3}),(-?\d{1,3})$/.exec(raw);
  if (!m) throw new ParamError('cell muss "lat,lon" in ganzen Grad sein');
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  const onGrid = (v: number) => Number.isInteger((v - CELL / 2) / CELL);
  if (!onGrid(lat) || !onGrid(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new ParamError(`cell liegt nicht auf dem ${CELL}°-Gitter`);
  }
  return [lat, lon];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** readsb-JSON (adsb.lol, airplanes.live): { ac: [{ hex, flight, lat, lon, alt_baro, gs, track, t, r }] } */
export function parseReadsb(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.ac)) throw new Error('Unerwartetes Format: ac fehlt');
  const out: Feature[] = [];
  for (const a of json.ac) {
    if (!isRecord(a)) continue;
    const hex = str(a.hex);
    const lat = num(a.lat);
    const lon = num(a.lon);
    if (!hex || lat === null || lon === null) continue;
    const callsign = str(a.flight);
    // alt_baro ist eine Zahl in Fuß oder der Text "ground".
    const alt = a.alt_baro === 'ground' ? 0 : num(a.alt_baro);
    out.push({
      id: hex.toLowerCase(),
      lon, lat,
      heading: num(a.track) ?? num(a.true_heading),
      label: callsign ?? hex.toUpperCase(),
      props: {
        callsign,
        reg: str(a.r),
        type: str(a.t),
        alt_ft: alt,
        ground: a.alt_baro === 'ground' ? 1 : 0,
        speed_kt: num(a.gs),
        squawk: str(a.squawk)
      }
    });
  }
  return out;
}

/** USGS GeoJSON-Feed: FeatureCollection mit [lon, lat, tiefe] und properties.mag/place/time/url. */
export function parseUsgs(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.features)) throw new Error('Unerwartetes Format: features fehlt');
  const out: Feature[] = [];
  for (const f of json.features) {
    if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties)) continue;
    const c = f.geometry.coordinates;
    if (!Array.isArray(c)) continue;
    const lon = num(c[0]);
    const lat = num(c[1]);
    const id = str(f.id);
    if (lon === null || lat === null || !id) continue;
    const p = f.properties;
    const mag = num(p.mag);
    out.push({
      id, lon, lat, heading: null,
      label: `M ${mag === null ? '?' : mag.toFixed(1)} · ${str(p.place) ?? 'unbekannt'}`,
      props: {
        mag,
        depth_km: num(c[2]),
        place: str(p.place),
        time: num(p.time),
        url: str(p.url),
        tsunami: num(p.tsunami)
      }
    });
  }
  return out;
}

/* ---------- Verkehrskameras ----------
   Ein Anbieter = eine Abfrage (Liste aller Kameras, Bilder lädt der Browser direkt beim Anbieter).
   Formate nach Dokumentation der Anbieter; tools/probe.mjs prüft sie gegen die echten Antworten. */

const toNum = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
/** Nur https-Bild-URLs weitergeben (gemischte Inhalte blockiert der Browser); http wird hochgestuft. */
const httpsUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  if (s.startsWith('https://')) return s;
  if (s.startsWith('http://')) return `https://${s.slice(7)}`;
  return null;
};
const validPos = (lat: number | null, lon: number | null): lat is number =>
  lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

function cam(provider: string, id: string, lat: number, lon: number, name: string, image: string, extra: Props = {}): Feature {
  return { id: `${provider}:${id}`, lon, lat, heading: null, label: name, props: { provider, name, image, video: null, area: null, ...extra } };
}

/** TfL JamCams: [{ id, commonName, lat, lon, additionalProperties: [{ key: 'imageUrl'|'videoUrl'|'available', value }] }] */
export function parseTfl(json: unknown): Feature[] {
  if (!Array.isArray(json)) throw new Error('Unerwartetes Format: Liste erwartet');
  const out: Feature[] = [];
  for (const c of json) {
    if (!isRecord(c)) continue;
    const add = new Map<string, unknown>();
    if (Array.isArray(c.additionalProperties)) {
      for (const p of c.additionalProperties) if (isRecord(p) && typeof p.key === 'string') add.set(p.key, p.value);
    }
    const lat = num(c.lat);
    const lon = num(c.lon);
    const id = str(c.id);
    const image = httpsUrl(add.get('imageUrl'));
    if (!id || !image || !validPos(lat, lon) || add.get('available') === 'false') continue;
    out.push(cam('tfl', id, lat, lon as number, str(c.commonName) ?? id, image, { video: httpsUrl(add.get('videoUrl')), area: 'London' }));
  }
  return out;
}

/** NYC DOT: [{ id, name, latitude, longitude, area, isOnline, imageUrl }] */
export function parseNyc(json: unknown): Feature[] {
  if (!Array.isArray(json)) throw new Error('Unerwartetes Format: Liste erwartet');
  const out: Feature[] = [];
  for (const c of json) {
    if (!isRecord(c)) continue;
    const lat = toNum(c.latitude);
    const lon = toNum(c.longitude);
    const id = str(c.id);
    if (!id || !validPos(lat, lon) || String(c.isOnline) === 'false') continue;
    const image = httpsUrl(c.imageUrl) ?? `https://webcams.nyctmc.org/api/cameras/${encodeURIComponent(id)}/image`;
    out.push(cam('nyc', id, lat, lon as number, str(c.name) ?? id, image, { area: str(c.area) ? `New York · ${str(c.area)}` : 'New York' }));
  }
  return out;
}

/** Caltrans CCTV: { data: [{ cctv: { index, location: { latitude, longitude, locationName, route, county }, inService, imageData: { streamingVideoURL, static: { currentImageURL } } } }] } */
export function parseCaltrans(json: unknown, district: string): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.data)) throw new Error('Unerwartetes Format: data fehlt');
  const out: Feature[] = [];
  for (const row of json.data) {
    const c = isRecord(row) && isRecord(row.cctv) ? row.cctv : null;
    if (!c || !isRecord(c.location) || !isRecord(c.imageData)) continue;
    const loc = c.location;
    const lat = toNum(loc.latitude);
    const lon = toNum(loc.longitude);
    const still = isRecord(c.imageData.static) ? c.imageData.static : {};
    const image = httpsUrl(still.currentImageURL);
    const id = str(c.index) ?? (typeof c.index === 'number' ? String(c.index) : null);
    if (!id || !image || !validPos(lat, lon) || c.inService === 'false') continue;
    const route = str(loc.route);
    out.push(cam('caltrans', `${district}-${id}`, lat, lon as number, str(loc.locationName) ?? id, image, {
      video: httpsUrl(c.imageData.streamingVideoURL),
      area: ['Kalifornien', str(loc.county), route].filter(Boolean).join(' · ')
    }));
  }
  return out;
}

/** Digitraffic Wetterkameras (Finnland): GeoJSON, properties.presets[].id → https://weathercam.digitraffic.fi/<preset>.jpg */
export function parseDigitraffic(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.features)) throw new Error('Unerwartetes Format: features fehlt');
  const out: Feature[] = [];
  for (const f of json.features) {
    if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties) || !Array.isArray(f.geometry.coordinates)) continue;
    const lon = num(f.geometry.coordinates[0]);
    const lat = num(f.geometry.coordinates[1]);
    const p = f.properties;
    const id = str(p.id) ?? str(f.id);
    const presets = Array.isArray(p.presets) ? p.presets.filter((x) => isRecord(x) && x.inCollection !== false && str(x.id)) : [];
    if (!id || !presets.length || !validPos(lat, lon) || p.collectionStatus === 'REMOVED_PERMANENTLY') continue;
    const preset = str((presets[0] as Record<string, unknown>).id) as string;
    out.push(cam('fi', id, lat, lon as number, str(p.name) ?? id, `https://weathercam.digitraffic.fi/${encodeURIComponent(preset)}.jpg`, { area: 'Finnland' }));
  }
  return out;
}

/** Anbieter → Liste-URL. Caltrans veröffentlicht pro Bezirk (1–12) eine eigene Datei. */
export const CAM_PROVIDERS: Record<string, { url: string; parse: (j: unknown, key: string) => Feature[] }> = {
  tfl: { url: 'https://api.tfl.gov.uk/Place/Type/JamCam', parse: parseTfl },
  nyc: { url: 'https://webcams.nyctmc.org/api/cameras', parse: parseNyc },
  fi: { url: 'https://tie.digitraffic.fi/api/weathercam/v1/stations', parse: parseDigitraffic },
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => {
    const d = i + 1;
    const dd = String(d).padStart(2, '0');
    return [`caltrans-${d}`, { url: `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${dd}.json`, parse: (j: unknown) => parseCaltrans(j, String(d)) }];
  }))
};

export const SOURCES: Record<string, Source> = {
  flights: {
    id: 'flights',
    ttl: 10,
    key(params) {
      const [lat, lon] = parseCell(params.get('cell'));
      return `${lat},${lon}`;
    },
    urls(key) {
      const [lat, lon] = key.split(',');
      return [
        `https://api.adsb.lol/v2/point/${lat}/${lon}/${CELL_RADIUS_NM}`,
        `https://api.airplanes.live/v2/point/${lat}/${lon}/${CELL_RADIUS_NM}`
      ];
    },
    parse: parseReadsb
  },
  quakes: {
    id: 'quakes',
    ttl: 60,
    key() { return 'day'; },
    urls() { return ['https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson']; },
    parse: parseUsgs
  },
  cams: {
    id: 'cams',
    ttl: 600, // Kamerastandorte ändern sich selten; die Bilder lädt der Browser selbst
    key(params) {
      const p = params.get('p');
      if (!p || !Object.hasOwn(CAM_PROVIDERS, p)) throw new ParamError(`p muss einer von ${Object.keys(CAM_PROVIDERS).join(', ')} sein`);
      return p;
    },
    urls(key) { return [CAM_PROVIDERS[key].url]; },
    parse(json, key) { return CAM_PROVIDERS[key].parse(json, key); }
  }
};
