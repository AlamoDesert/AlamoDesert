/* Live Karten – Quellen-Register. Reine Logik ohne Netz: baut Upstream-URLs, prüft Parameter, normalisiert Antworten.
   Jede Quelle liefert einheitliche Features, damit der Client jede Ebene gleich behandeln kann. */

/** Werte sind meist Text/Zahl; Detailquellen (Route, Weg) liefern auch Listen. */
export type Props = Record<string, string | number | null | unknown[]>;

export interface Feature {
  id: string;
  lon: number;
  lat: number;
  heading: number | null;
  label: string;
  props: Props;
  /** Flächen (Warngebiete): GeoJSON-Geometrie in WGS84 (lon/lat), auf 3 Nachkommastellen gerundet. lon/lat = Stellvertreterpunkt. */
  geometry?: { type: string; coordinates: unknown };
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
  /** true: urls() sind Teile, die alle zugleich geholt werden (statt Ausweichquellen); parse bekommt eine Liste, Fehlendes als null. */
  parts?: boolean;
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
        squawk: str(a.squawk),
        // Sekunden seit der Positionsmeldung: die App rechnet damit die Position bis „jetzt“ weiter
        age_s: num(a.seen_pos)
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

/** foto-webcam.eu: { cams: [{ id, name, title, offline, hidden, imgurl, link, latitude, longitude, captureInterval }] } – meist Alpen und Süddeutschland, Bild alle 10 min. */
export function parseFotoWebcam(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.cams)) throw new Error('Unerwartetes Format: cams fehlt');
  const out: Feature[] = [];
  for (const c of json.cams) {
    if (!isRecord(c) || c.offline === true || c.hidden === true) continue;
    const id = str(c.id);
    const lat = toNum(c.latitude);
    const lon = toNum(c.longitude);
    if (!id || !/^[\w-]+$/.test(id) || !validPos(lat, lon)) continue;
    out.push(cam('fw', id, lat, lon as number, str(c.title) ?? str(c.name) ?? id, `https://www.foto-webcam.eu/webcam/${id}/current/1200.jpg`, {
      area: str(c.name), page: httpsUrl(c.link)
    }));
  }
  return out;
}

/** Anbieter → Liste-URL. Caltrans veröffentlicht pro Bezirk (1–12) eine eigene Datei. */
export const CAM_PROVIDERS: Record<string, { url: string; parse: (j: unknown, key: string) => Feature[] }> = {
  tfl: { url: 'https://api.tfl.gov.uk/Place/Type/JamCam', parse: parseTfl },
  nyc: { url: 'https://webcams.nyctmc.org/api/cameras', parse: parseNyc },
  fi: { url: 'https://tie.digitraffic.fi/api/weathercam/v1/stations', parse: parseDigitraffic },
  fw: { url: 'https://www.foto-webcam.eu/webcam/include/metadata.php', parse: parseFotoWebcam },
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => {
    const d = i + 1;
    const dd = String(d).padStart(2, '0');
    return [`caltrans-${d}`, { url: `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${dd}.json`, parse: (j: unknown) => parseCaltrans(j, String(d)) }];
  }))
};

/* ---------- Detailabfragen beim Antippen ---------- */

const HEX = /^[0-9a-f]{6}$/;
const CALLSIGN = /^[A-Z0-9]{2,8}$/;

/** [adsbdb Flugzeug, adsbdb Rufzeichen-Route, planespotters Foto] → ein Feature mit Typ, Halter, Route und Foto. */
export function parseAircraftInfo(parts: unknown, key: string): Feature[] {
  const [ac, cs, ps] = Array.isArray(parts) ? parts : [];
  const a = isRecord(ac) && isRecord(ac.response) && isRecord(ac.response.aircraft) ? ac.response.aircraft : {};
  const r = isRecord(cs) && isRecord(cs.response) && isRecord(cs.response.flightroute) ? cs.response.flightroute : null;
  const airport = (x: unknown) => {
    if (!isRecord(x)) return null;
    const lat = num(x.latitude), lon = num(x.longitude);
    return { iata: str(x.iata_code), icao: str(x.icao_code), name: str(x.name), city: str(x.municipality), country: str(x.country_iso_name), lat, lon };
  };
  const photo = isRecord(ps) && Array.isArray(ps.photos) && isRecord(ps.photos[0]) ? ps.photos[0] : null;
  const thumb = photo && isRecord(photo.thumbnail_large) ? httpsUrl(photo.thumbnail_large.src) : null;
  const [hex] = key.split(',');
  return [{
    id: hex, lon: 0, lat: 0, heading: null, label: hex,
    props: {
      type: str(a.type), manufacturer: str(a.manufacturer), owner: str(a.registered_owner), country: str(a.registered_owner_country_name),
      reg: str(a.registration),
      airline: r && isRecord(r.airline) ? str(r.airline.name) : null,
      origin: r ? airport(r.origin) as unknown as string : null,
      destination: r ? airport(r.destination) as unknown as string : null,
      photo: thumb ?? httpsUrl(a.url_photo),
      photo_by: thumb ? str(photo!.photographer) : httpsUrl(a.url_photo) ? 'airport-data.com' : null,
      photo_link: thumb ? httpsUrl(photo!.link) : null
    }
  }];
}

/** readsb-Trace (globe.adsb.lol): { timestamp, trace: [[sek, lat, lon, höhe|"ground", ...]] } → Weg als [lon, lat, höhe_ft]. */
export function parseTrace(json: unknown, key: string): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.trace)) throw new Error('Unerwartetes Format: trace fehlt');
  const pts: [number, number, number | null][] = [];
  for (const t of json.trace) {
    if (!Array.isArray(t)) continue;
    const lat = num(t[1]), lon = num(t[2]);
    if (lat === null || lon === null) continue;
    pts.push([Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5, t[3] === 'ground' ? 0 : num(t[3])]);
  }
  // Der Tages-Trace enthält auch frühere Flüge: nur ab dem letzten Bodenkontakt vor dem Ende zeigen.
  let from = 0;
  for (let i = pts.length - 2; i >= 0; i--) if (pts[i][2] === 0 && pts[i + 1][2] !== 0) { from = i; break; }
  const flight = pts.slice(from);
  // Höchstens ~600 Punkte: reicht für eine glatte Linie, hält die Antwort klein.
  const step = Math.max(1, Math.ceil(flight.length / 600));
  const path = flight.filter((_, i) => i % step === 0 || i === flight.length - 1);
  return [{ id: key, lon: 0, lat: 0, heading: null, label: key, props: { path, start: num(json.timestamp) } }];
}

/** Wikidata-Suche nach IMO-Nummer (haswbstatement:P458) mit Seitenbild → Foto von Wikimedia Commons. */
export function parseShipPhoto(json: unknown, key: string): Feature[] {
  const pages = isRecord(json) && isRecord(json.query) && isRecord(json.query.pages) ? Object.values(json.query.pages) : [];
  const page = pages.find((x) => isRecord(x) && str(x.pageimage)) as Record<string, unknown> | undefined;
  const file = page ? str(page.pageimage) : null;
  return [{ id: key, lon: 0, lat: 0, heading: null, label: key, props: {
    photo: file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640` : null,
    photo_by: file ? 'Wikimedia Commons' : null,
    photo_link: page && str(page.title) ? `https://www.wikidata.org/wiki/${str(page.title)}` : null
  } }];
}

/** Rundet alle Zahlen in verschachtelten Koordinatenlisten auf 3 Nachkommastellen (≈ 100 m) – hält die Antworten klein. */
function roundCoords(c: unknown): unknown {
  if (typeof c === 'number') return Math.round(c * 1000) / 1000;
  return Array.isArray(c) ? c.map(roundCoords) : c;
}

/** Stellvertreterpunkt einer Fläche: Mittel der Eckpunkte des ersten Rings (ohne den doppelten Schlusspunkt). */
function areaPoint(type: string, coords: unknown): [number, number] | null {
  let ring: unknown = null;
  if (type === 'Polygon' && Array.isArray(coords)) ring = coords[0];
  else if (type === 'MultiPolygon' && Array.isArray(coords) && Array.isArray(coords[0])) ring = coords[0][0];
  if (!Array.isArray(ring) || !ring.length) return null;
  const pts = ring.filter((p): p is number[] => Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (!pts.length) return null;
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000];
}

/** DWD-Wetterwarnungen (WFS, GeoJSON): eine Fläche je Warnung; EC_AREA_COLOR "255 235 59" → "#ffeb3b". */
export function parseDwdWarnings(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.features)) throw new Error('Unerwartetes Format: features fehlt');
  const out: Feature[] = [];
  const seen = new Map<string, number>();
  json.features.forEach((f, index) => {
    if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties)) return;
    const type = str(f.geometry.type);
    if (type !== 'Polygon' && type !== 'MultiPolygon') return;
    const mid = areaPoint(type, f.geometry.coordinates);
    if (!mid) return;
    const p = f.properties;
    // Dieselbe Meldung gilt für viele Gebiete und steht dann mehrfach da → Nummer anhängen.
    const base = str(p.IDENTIFIER) ?? str(f.id) ?? `w${index}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const rgb = (str(p.EC_AREA_COLOR) ?? '').split(/\s+/).map(Number);
    const color = rgb.length === 3 && rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
      ? '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') : null;
    out.push({
      id: n === 0 ? base : `${base}#${n}`,
      lon: mid[0], lat: mid[1], heading: null,
      label: str(p.HEADLINE) ?? str(p.EVENT) ?? 'Warnung',
      props: {
        event: str(p.EVENT),
        headline: str(p.HEADLINE),
        description: str(p.DESCRIPTION),
        instruction: str(p.INSTRUCTION),
        severity: str(p.SEVERITY),
        onset: str(p.ONSET),
        expires: str(p.EXPIRES),
        color,
        area: str(p.AREADESC)
      },
      geometry: { type, coordinates: roundCoords(f.geometry.coordinates) }
    });
  });
  return out;
}

/** NOAA OVATION Aurora: { "Forecast Time", coordinates: [[lon 0..359, lat, Wahrscheinlichkeit %]] }. Nur Werte ab AURORA_MIN %
    (ab 3 % wären es ~10.000 Punkte, über 1 MB). */
export const AURORA_MIN = 8;

export function parseAurora(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.coordinates)) throw new Error('Unerwartetes Format: coordinates fehlt');
  const forecast = str(json['Forecast Time']);
  const out: Feature[] = [];
  for (const c of json.coordinates) {
    if (!Array.isArray(c)) continue;
    const l = num(c[0]);
    const lat = num(c[1]);
    const v = num(c[2]);
    if (l === null || lat === null || v === null || v < AURORA_MIN) continue;
    const lon = l > 180 ? l - 360 : l; // 0..359 → -180..180
    out.push({ id: `${lon},${lat}`, lon, lat, heading: null, label: `${v} %`, props: { p: v, forecast } });
  }
  return out;
}

/** GDACS-Ereignisse (je Ereignisart eine Teilabfrage TC, FL, DR, WF, VO). Nur der Mittelpunkt je Ereignis und nur laufende. */
export function parseGdacs(parts: unknown): Feature[] {
  if (!Array.isArray(parts)) throw new Error('Unerwartetes Format: Teile fehlen');
  const out: Feature[] = [];
  for (const part of parts) {
    if (!isRecord(part) || !Array.isArray(part.features)) continue; // Teil fehlt (z. B. VO ohne Ereignisse = 404)
    for (const f of part.features) {
      if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties)) continue;
      const p = f.properties;
      if (p.Class !== 'Point_Centroid' || p.iscurrent === 'false') continue;
      const c = f.geometry.coordinates;
      const lon = Array.isArray(c) ? num(c[0]) : null;
      const lat = Array.isArray(c) ? num(c[1]) : null;
      const type = str(p.eventtype);
      const eventid = num(p.eventid) ?? str(p.eventid);
      if (lon === null || lat === null || !type || eventid === null) continue;
      // severitydata ist ein Objekt (laut Doku früher ein Python-Text "{'severitytext': '…'}") – beides lesen.
      let severity: string | null = null;
      if (isRecord(p.severitydata)) severity = str(p.severitydata.severitytext);
      else if (typeof p.severitydata === 'string') severity = /['"]severitytext['"]\s*:\s*['"]([^'"]*)['"]/.exec(p.severitydata)?.[1]?.trim() || null;
      const name = str(p.name) ?? str(p.eventname) ?? `${type} ${eventid}`;
      out.push({
        id: `${type}-${eventid}`, lon, lat, heading: null, label: name,
        props: {
          type, name,
          alert: str(p.alertlevel),
          country: str(p.country),
          from: str(p.fromdate),
          to: str(p.todate),
          severity,
          link: `https://www.gdacs.org/report.aspx?eventid=${eventid}&eventtype=${type}`
        }
      });
    }
  }
  return out;
}

const EONET_CATEGORIES = ['wildfires', 'severeStorms', 'volcanoes'];

/** NASA EONET (GeoJSON, offene Ereignisse): Punkte, bei Linien die letzte Koordinate = jüngste Position. Nur Brände, Stürme, Vulkane. */
export function parseEonet(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.features)) throw new Error('Unerwartetes Format: features fehlt');
  const out: Feature[] = [];
  for (const f of json.features) {
    if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties)) continue;
    const p = f.properties;
    const cat = Array.isArray(p.categories) && isRecord(p.categories[0]) ? str(p.categories[0].id) : null;
    if (!cat || !EONET_CATEGORIES.includes(cat)) continue;
    let c: unknown = f.geometry.coordinates;
    if (f.geometry.type === 'LineString' && Array.isArray(c)) c = c[c.length - 1];
    else if (f.geometry.type !== 'Point') continue;
    const lon = Array.isArray(c) ? num(c[0]) : null;
    const lat = Array.isArray(c) ? num(c[1]) : null;
    const id = str(p.id);
    const title = str(p.title);
    if (lon === null || lat === null || !id || !title) continue;
    const src = Array.isArray(p.sources) && isRecord(p.sources[0]) ? str(p.sources[0].url) : null;
    out.push({
      id, lon, lat, heading: null, label: title,
      props: {
        title, category: cat,
        date: str(p.date),
        magnitude: num(p.magnitudeValue),
        unit: str(p.magnitudeUnit),
        link: src ?? str(p.link)
      }
    });
  }
  return out;
}

/** Pegelonline (WSV): Liste der Stationen mit Zeitreihe W (Wasserstand in cm) und aktuellem Messwert. */
export function parsePegel(json: unknown): Feature[] {
  if (!Array.isArray(json)) throw new Error('Unerwartetes Format: Liste erwartet');
  const out: Feature[] = [];
  for (const s of json) {
    if (!isRecord(s) || !Array.isArray(s.timeseries)) continue;
    const lon = num(s.longitude);
    const lat = num(s.latitude);
    const id = str(s.uuid);
    if (lon === null || lat === null || !id) continue;
    const w = s.timeseries.find((t) => isRecord(t) && t.shortname === 'W');
    const m = isRecord(w) && isRecord(w.currentMeasurement) ? w.currentMeasurement : null;
    const value = m ? num(m.value) : null;
    if (!m || value === null || !isRecord(w)) continue;
    const name = str(s.longname) ?? str(s.shortname) ?? id;
    const water = isRecord(s.water) ? str(s.water.longname) : null;
    out.push({
      id, lon, lat, heading: null,
      label: water ? `${name} · ${water}` : name,
      props: {
        name, water, value,
        unit: str(w.unit) ?? 'cm',
        state: str(m.stateMnwMhw),
        time: str(m.timestamp),
        number: str(s.number),
        agency: str(s.agency),
        km: num(s.km)
      }
    });
  }
  return out;
}

/** BfS ODL-Messnetz (WFS, GeoJSON): Ortsdosisleistung der letzten Stunde; nur Messstellen in Betrieb mit Messwert. */
export function parseOdl(json: unknown): Feature[] {
  if (!isRecord(json) || !Array.isArray(json.features)) throw new Error('Unerwartetes Format: features fehlt');
  const out: Feature[] = [];
  for (const f of json.features) {
    if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties)) continue;
    const p = f.properties;
    const c = f.geometry.coordinates;
    const lon = Array.isArray(c) ? num(c[0]) : null;
    const lat = Array.isArray(c) ? num(c[1]) : null;
    const id = str(p.id);
    const value = num(p.value);
    if (p.site_status !== 1 || lon === null || lat === null || !id || value === null) continue;
    const name = str(p.name) ?? id;
    out.push({
      id, lon, lat, heading: null,
      label: `${name} · ${value} µSv/h`,
      props: {
        name,
        plz: str(p.plz),
        value,
        cosmic: num(p.value_cosmic),
        terrestrial: num(p.value_terrestrial),
        unit: str(p.unit) ?? 'µSv/h',
        end: str(p.end_measure),
        height: num(p.height_above_sea)
      }
    });
  }
  return out;
}

export const SOURCES: Record<string, Source> = {
  aircraft: {
    id: 'aircraft',
    ttl: 3600, // Halter, Foto und Route ändern sich im Lauf eines Fluges nicht
    parts: true,
    key(params) {
      const hex = (params.get('hex') || '').toLowerCase();
      const cs = (params.get('cs') || '').toUpperCase().trim();
      if (!HEX.test(hex)) throw new ParamError('hex muss eine 24-Bit-ICAO-Adresse sein (6 Hex-Zeichen)');
      if (cs && !CALLSIGN.test(cs)) throw new ParamError('cs ist kein gültiges Rufzeichen');
      return cs ? `${hex},${cs}` : hex;
    },
    urls(key) {
      const [hex, cs] = key.split(',');
      return [
        `https://api.adsbdb.com/v0/aircraft/${hex}`,
        cs ? `https://api.adsbdb.com/v0/callsign/${cs}` : 'https://api.adsbdb.com/v0/callsign/-',
        `https://api.planespotters.net/pub/photos/hex/${hex}`
      ];
    },
    parse: parseAircraftInfo
  },
  track: {
    id: 'track',
    ttl: 30,
    key(params) {
      const hex = (params.get('hex') || '').toLowerCase();
      if (!HEX.test(hex)) throw new ParamError('hex muss eine 24-Bit-ICAO-Adresse sein (6 Hex-Zeichen)');
      return hex;
    },
    urls(hex) { return [`https://globe.adsb.lol/data/traces/${hex.slice(-2)}/trace_full_${hex}.json`]; },
    parse: parseTrace
  },
  shipphoto: {
    id: 'shipphoto',
    ttl: 86400,
    key(params) {
      const imo = params.get('imo') || '';
      if (!/^[1-9]\d{6}$/.test(imo)) throw new ParamError('imo muss eine siebenstellige IMO-Nummer sein');
      return imo;
    },
    urls(imo) {
      return [`https://www.wikidata.org/w/api.php?action=query&format=json&generator=search&gsrsearch=haswbstatement:P458=${imo}&prop=pageimages&piprop=name`];
    },
    parse: parseShipPhoto
  },
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
  },
  warn: {
    id: 'warn',
    ttl: 300,
    key() { return 'all'; },
    urls() { return ['https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=dwd:Warnungen_Gemeinden_vereinigt&outputFormat=application/json']; },
    parse: parseDwdWarnings
  },
  aurora: {
    id: 'aurora',
    ttl: 600,
    key() { return 'all'; },
    urls() { return ['https://services.swpc.noaa.gov/json/ovation_aurora_latest.json']; },
    parse: parseAurora
  },
  gdacs: {
    id: 'gdacs',
    ttl: 900,
    parts: true, // nur eine Ereignisart je Abfrage; fällt eine aus (VO: 404 ohne Ereignisse), bleiben die übrigen
    key() { return 'all'; },
    urls() {
      return ['TC', 'FL', 'DR', 'WF', 'VO'].map((t) => `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=${t}`);
    },
    parse: parseGdacs
  },
  eonet: {
    id: 'eonet',
    ttl: 900,
    key() { return 'all'; },
    // Die Kategorie-Auswahl filtert schon bei NASA (Eisberge allein sind > 400 Punkte); der Parser prüft zur Sicherheit nochmals.
    urls() { return ['https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=30&category=wildfires,severeStorms,volcanoes']; },
    parse: parseEonet
  },
  pegel: {
    id: 'pegel',
    ttl: 300,
    key() { return 'all'; },
    urls() { return ['https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?includeTimeseries=true&includeCurrentMeasurement=true&timeseries=W']; },
    parse: parsePegel
  },
  odl: {
    id: 'odl',
    ttl: 900,
    key() { return 'all'; },
    urls() { return ['https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=opendata:odlinfo_odl_1h_latest&outputFormat=application/json']; },
    parse: parseOdl
  }
};
