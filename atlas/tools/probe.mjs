// Prüft alle geplanten Quellen ohne Registrierung: erreichbar? JSON? CORS? Wie groß?
// Start (Pi oder lokal, braucht Internet): node tools/probe.mjs [--json]
// Ergebnis entscheidet, welche Ebenen gebaut werden. TCP-Quellen (Kystverket-AIS) prüft --tcp zusätzlich.
import { connect } from 'node:net';

const ORIGIN = 'https://livekarten.example';
const SOURCES = [
  ['Flugzeuge', 'adsb.lol', 'https://api.adsb.lol/v2/point/51/10/250'],
  ['Flugzeuge', 'airplanes.live', 'https://api.airplanes.live/v2/point/51/10/250'],
  ['Flugzeuge', 'OpenSky (anonym)', 'https://opensky-network.org/api/states/all?lamin=50&lomin=9&lamax=52&lomax=11'],
  ['Schiffe', 'Digitraffic AIS', 'https://meri.digitraffic.fi/api/ais/v1/locations'],
  ['Kameras', 'TfL JamCams', 'https://api.tfl.gov.uk/Place/Type/JamCam'],
  ['Kameras', 'NYC DOT', 'https://webcams.nyctmc.org/api/cameras'],
  ['Kameras', 'Caltrans D4', 'https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json'],
  ['Kameras', 'Digitraffic Wetterkameras', 'https://tie.digitraffic.fi/api/weathercam/v1/stations'],
  ['Kameras', 'Autobahn GmbH (A1)', 'https://verkehr.autobahn.de/o/autobahn/A1/services/webcam'],
  ['Lage', 'GDELT GEO 2.0', 'https://api.gdeltproject.org/api/v2/geo/geo?query=protest&format=geojson&timespan=24h'],
  ['Lage', 'GDELT Ereignisdateien', 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt'],
  ['Katastrophen', 'GDACS', 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP'],
  ['Katastrophen', 'NASA EONET', 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20'],
  ['Katastrophen', 'USGS Erdbeben', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'],
  ['Wetter', 'RainViewer', 'https://api.rainviewer.com/public/weather-maps.json'],
  ['Wetter', 'Open-Meteo', 'https://api.open-meteo.com/v1/forecast?latitude=51&longitude=10&current=temperature_2m'],
  ['Weltraum', 'CelesTrak', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json'],
  ['Weltraum', 'wheretheiss.at', 'https://api.wheretheiss.at/v1/satellites/25544'],
  ['Züge', 'Digitraffic Bahn', 'https://rata.digitraffic.fi/api/v1/train-locations/latest'],
  ['Grundkarte', 'OpenFreeMap', 'https://tiles.openfreemap.org/styles/liberty']
];
const TCP = [['Schiffe', 'Kystverket AIS', '153.44.253.27', 5631]];

async function probeHttp([layer, name, url]) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      headers: { origin: ORIGIN, accept: 'application/json', 'user-agent': 'LiveKarten-Probe/1.0' },
      signal: AbortSignal.timeout(20_000)
    });
    const text = await res.text();
    let shape = '–';
    try {
      const j = JSON.parse(text);
      shape = Array.isArray(j) ? `Array[${j.length}]` : `{${Object.keys(j).slice(0, 6).join(', ')}}`;
    } catch { shape = text.slice(0, 40).replace(/\s+/g, ' '); }
    return {
      layer, name, ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0),
      kb: Math.round(text.length / 1024), cors: res.headers.get('access-control-allow-origin') ?? 'nein',
      type: (res.headers.get('content-type') || '').split(';')[0], shape
    };
  } catch (e) {
    return { layer, name, ok: false, status: 0, ms: Math.round(performance.now() - t0), error: e.cause?.code || e.message };
  }
}

function probeTcp([layer, name, host, port]) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const sock = connect({ host, port, timeout: 15_000 });
    let data = '';
    const done = (r) => { sock.destroy(); resolve({ layer, name, ms: Math.round(performance.now() - t0), ...r }); };
    sock.on('data', (d) => { data += d; if (data.length > 2000) done({ ok: true, status: 'TCP', shape: data.split('\n')[0].slice(0, 60) }); });
    sock.on('timeout', () => done({ ok: data.length > 0, status: 'TCP', error: data ? undefined : 'keine Daten in 15 s' }));
    sock.on('error', (e) => done({ ok: false, status: 0, error: e.code || e.message }));
  });
}

const results = await Promise.all(SOURCES.map(probeHttp));
if (process.argv.includes('--tcp')) results.push(...(await Promise.all(TCP.map(probeTcp))));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const head = `${r.ok ? 'OK  ' : 'FEHL'} ${r.layer.padEnd(12)} ${r.name.padEnd(26)}`;
    console.log(r.ok || r.status
      ? `${head} ${String(r.status).padEnd(4)} ${String(r.ms).padStart(5)} ms ${String(r.kb ?? '').padStart(6)} KB  CORS: ${(r.cors ?? '').padEnd(5)} ${r.shape ?? r.error ?? ''}`
      : `${head} ${r.error}`);
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad} von ${results.length} Quellen erreichbar.`);
}
