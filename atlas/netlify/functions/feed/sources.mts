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
  parse(json: unknown): Feature[];
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
  }
};
