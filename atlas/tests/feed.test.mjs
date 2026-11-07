import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProxy } from '../netlify/functions/feed/core.mts';
import { parseReadsb, cellCenter, CELL, parseTrace, parseAircraftInfo, parseFotoWebcam, parseShipPhoto, parseDwdWarnings, parseAurora, AURORA_MIN, parsePegel } from '../netlify/functions/feed/sources.mts';

const okJson = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const READSB = {
  ac: [
    { hex: '3C6444', flight: 'DLH4AB ', r: 'D-AIBA', t: 'A319', lat: 50.1, lon: 8.6, alt_baro: 35000, gs: 452.3, track: 271.4, squawk: '1000' },
    { hex: '3c65a1', lat: 50.03, lon: 8.57, alt_baro: 'ground', gs: 3 },
    { hex: 'nopos', flight: 'X' }, // ohne Position → verworfen
    'Müll'
  ]
};

function setup(responder) {
  let t = 1_000_000;
  const calls = [];
  const proxy = createProxy({
    fetch: async (url) => { calls.push(url); return responder(url, calls.length); },
    now: () => t
  });
  const get = async (path) => {
    const r = await proxy(new Request(`http://x${path}`));
    return { status: r.status, headers: r.headers, body: await r.json() };
  };
  return { get, calls, tick: (ms) => { t += ms; } };
}

test('parseReadsb normalisiert und verwirft Einträge ohne Position', () => {
  const f = parseReadsb(READSB);
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], {
    id: '3c6444', lon: 8.6, lat: 50.1, heading: 271.4, label: 'DLH4AB',
    props: { callsign: 'DLH4AB', reg: 'D-AIBA', type: 'A319', alt_ft: 35000, ground: 0, speed_kt: 452.3, squawk: '1000', age_s: null }
  });
  assert.equal(f[1].props.ground, 1);
  assert.equal(f[1].props.alt_ft, 0);
  assert.equal(f[1].label, '3C65A1');
  assert.throws(() => parseReadsb({ foo: 1 }), /ac fehlt/);
});

test('Zellmittelpunkte liegen auf dem Gitter', () => {
  assert.equal(CELL, 4);
  assert.equal(cellCenter(51.3), 50);
  assert.equal(cellCenter(-0.1), -2);
  assert.equal(cellCenter(10), 10);
});

test('Parameterprüfung: nur Gitterzellen, bekannte Quellen', async () => {
  const { get, calls } = setup(() => okJson(READSB));
  assert.equal((await get('/api/feed/flights')).status, 400);
  assert.equal((await get('/api/feed/flights?cell=51,10')).status, 400);
  assert.equal((await get('/api/feed/flights?cell=50,10.5')).status, 400);
  assert.equal((await get('/api/feed/flights?cell=94,10')).status, 400);
  assert.equal((await get('/api/feed/nix')).status, 404);
  assert.equal((await get('/api/andere')).status, 404);
  assert.equal(calls.length, 0, 'ungültige Anfragen erreichen die Quelle nicht');
});

test('Cache: eine Upstream-Abfrage pro Zelle und TTL, CDN-Header gesetzt', async () => {
  const { get, calls, tick } = setup(() => okJson(READSB));
  const a = await get('/api/feed/flights?cell=50,10');
  assert.equal(a.status, 200);
  assert.equal(a.body.features.length, 2);
  assert.equal(a.body.stale, false);
  assert.match(a.headers.get('netlify-cdn-cache-control'), /s-maxage=10/);
  assert.equal(calls[0], 'https://api.adsb.lol/v2/point/50/10/250');
  await get('/api/feed/flights?cell=50,10');
  assert.equal(calls.length, 1);
  tick(10_001);
  await get('/api/feed/flights?cell=50,10');
  assert.equal(calls.length, 2);
});

test('Gleichzeitige Anfragen teilen sich eine Upstream-Abfrage', async () => {
  const { get, calls } = setup(() => okJson(READSB));
  await Promise.all([1, 2, 3, 4].map(() => get('/api/feed/flights?cell=50,10')));
  assert.equal(calls.length, 1);
});

test('Ausweichquelle, wenn die erste scheitert', async () => {
  const { get, calls } = setup((url) => (url.includes('adsb.lol') ? new Response('x', { status: 503 }) : okJson(READSB)));
  const r = await get('/api/feed/flights?cell=50,10');
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /airplanes\.live/);
});

test('Alle Quellen weg: alte Daten als stale, ohne Daten 502', async () => {
  let up = true;
  const { get, tick } = setup(() => (up ? okJson(READSB) : Promise.reject(new TypeError('fetch failed'))));
  await get('/api/feed/flights?cell=50,10');
  up = false;
  tick(20_000);
  const r = await get('/api/feed/flights?cell=50,10');
  assert.equal(r.status, 200);
  assert.equal(r.body.stale, true);
  assert.equal(r.headers.get('netlify-cdn-cache-control'), null, 'alte Daten nicht im CDN festhalten');
  const miss = await get('/api/feed/flights?cell=-2,-2');
  assert.equal(miss.status, 502);
  assert.match(miss.body.error, /adsb\.lol.*airplanes\.live/);
});

test('Unerwartetes Format zählt als Fehler', async () => {
  const { get } = setup(() => okJson({ html: 'Wartung' }));
  assert.equal((await get('/api/feed/aurora')).status, 502);
});

test('Kameras: TfL, NYC, Caltrans und Digitraffic werden einheitlich', async () => {
  const { parseTfl, parseNyc, parseCaltrans, parseDigitraffic } = await import('../netlify/functions/feed/sources.mts');
  const tfl = parseTfl([
    { id: 'JamCams_1', commonName: 'A ', lat: 51.5, lon: -0.1, additionalProperties: [{ key: 'imageUrl', value: 'https://s3/x.jpg' }, { key: 'available', value: 'true' }] },
    { id: 'JamCams_2', lat: 51.5, lon: -0.1, additionalProperties: [{ key: 'imageUrl', value: 'https://s3/y.jpg' }, { key: 'available', value: 'false' }] },
    { id: 'JamCams_3', lat: 51.5, lon: -0.1, additionalProperties: [] }
  ]);
  assert.equal(tfl.length, 1);
  assert.equal(tfl[0].id, 'tfl:JamCams_1');
  assert.equal(tfl[0].props.name, 'A');
  assert.equal(tfl[0].props.image, 'https://s3/x.jpg');

  const nyc = parseNyc([{ id: 'u1', name: 'B', latitude: '40.7', longitude: '-73.9', isOnline: 'true', area: 'Queens' }, { id: 'u2', latitude: 0, longitude: 0 }]);
  assert.equal(nyc.length, 1);
  assert.equal(nyc[0].lat, 40.7);
  assert.equal(nyc[0].props.image, 'https://webcams.nyctmc.org/api/cameras/u1/image');

  const ca = parseCaltrans({ data: [
    { cctv: { index: '7', inService: 'true', location: { latitude: '37.8', longitude: '-122.4', locationName: 'Bay Bridge', county: 'SF', route: 'I-80' },
      imageData: { streamingVideoURL: 'https://v/x.m3u8', static: { currentImageURL: 'http://cwwp2.dot.ca.gov/a.jpg' } } } },
    { cctv: { index: '8', inService: 'false', location: { latitude: '37', longitude: '-122' }, imageData: { static: { currentImageURL: 'https://x' } } } }
  ] }, '4');
  assert.equal(ca.length, 1);
  assert.equal(ca[0].id, 'caltrans:4-7');
  assert.equal(ca[0].props.image, 'https://cwwp2.dot.ca.gov/a.jpg', 'http wird auf https hochgestuft');
  assert.equal(ca[0].props.area, 'Kalifornien · SF · I-80');

  const fi = parseDigitraffic({ features: [
    { id: 'C01', geometry: { coordinates: [24.9, 60.2, 10] }, properties: { id: 'C01', name: 'Helsinki', presets: [{ id: 'C0100101', inCollection: true }] } },
    { id: 'C02', geometry: { coordinates: [25, 61] }, properties: { id: 'C02', presets: [] } }
  ] });
  assert.equal(fi.length, 1);
  assert.equal(fi[0].props.image, 'https://weathercam.digitraffic.fi/C0100101.jpg');
});

test('Kameras: nur bekannte Anbieter, Parser bekommt den Anbieter', async () => {
  const { get, calls } = setup(() => okJson({ data: [] }));
  assert.equal((await get('/api/feed/cams')).status, 400);
  assert.equal((await get('/api/feed/cams?p=evil')).status, 400);
  assert.equal((await get('/api/feed/cams?p=caltrans-13')).status, 400);
  const r = await get('/api/feed/cams?p=caltrans-4');
  assert.equal(r.status, 200);
  assert.equal(calls[0], 'https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json');
  assert.match(r.headers.get('netlify-cdn-cache-control'), /s-maxage=600/);
});

test('Livestream-Liste: gültige Quellen, eindeutig, alle in Deutschland', async () => {
  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(new URL('../public/data/livestreams.json', import.meta.url), 'utf8'));
  assert.equal(data.source, 'live');
  assert.ok(!Number.isNaN(Date.parse(data.at)));
  assert.ok(data.features.length >= 100);
  const ids = new Set();
  const embedHosts = ['g0.ipcamlive.com', 'v.angelcam.com', 'player.livespotting.com'];
  for (const f of data.features) {
    const p = f.props;
    assert.ok(!ids.has(f.id), `doppelt: ${f.label}`);
    ids.add(f.id);
    assert.ok(f.lon > 5.8 && f.lon < 15.1 && f.lat > 47.2 && f.lat < 55.1, `außerhalb Deutschlands: ${f.label}`);
    assert.ok(f.label && p.name === f.label && p.channel, f.label);
    if (p.kind === 'yt') {
      assert.match(p.video, /^[\w-]{11}$/, f.label);
      assert.equal(f.id, `yt:${p.video}`);
      if (p.channelId) assert.match(p.channelId, /^UC[\w-]{22}$/, f.label);
    } else if (p.kind === 'embed') {
      assert.ok(embedHosts.includes(new URL(p.embed).hostname), f.label);
      assert.match(p.embed, /^https:\/\//);
    } else if (p.kind === 'hls') {
      assert.match(p.hls, /^https:\/\/.+\.m3u8(\?|$)/, f.label);
    } else assert.fail(`unbekannte Art: ${f.label}`);
    if (p.site) assert.match(p.site, /^https:\/\//, f.label);
  }
});

test('Flugweg: nur ab dem letzten Start, höchstens ~600 Punkte', () => {
  const trace = [[0, 50, 8, 'ground'], [10, 50.1, 8.1, 3000], [20, 51, 9, 'ground'], [30, 51, 9.01, 'ground'], [40, 51.1, 9.1, 2000], [50, 52, 10, 30000]];
  const p = parseTrace({ timestamp: 1, trace }, 'abc123')[0].props.path;
  assert.deepEqual(p.map((x) => x[1]), [51, 51.1, 52]);
  const long = parseTrace({ trace: Array.from({ length: 5000 }, (_, i) => [i, 50 + i / 1e4, 8, 30000]) }, 'x')[0].props.path;
  assert.ok(long.length <= 601 && long.length > 500);
});

test('Flugzeug-Infos: Foto, Halter und Route; fehlende Teile stören nicht', () => {
  const ac = { response: { aircraft: { type: 'A319 112', registration: 'D-AIBD', registered_owner: 'Lufthansa', url_photo: 'http://x/y.jpg' } } };
  const cs = { response: { flightroute: { airline: { name: 'Lufthansa' }, origin: { iata_code: 'FRA', latitude: 50.03, longitude: 8.57, municipality: 'Frankfurt' }, destination: { iata_code: 'JFK', latitude: 40.6, longitude: -73.8 } } } };
  const ps = { photos: [{ thumbnail_large: { src: 'https://t.plnspttrs.net/1.jpg' }, photographer: 'Max', link: 'https://www.planespotters.net/photo/1' }] };
  const p = parseAircraftInfo([ac, cs, ps], '3c6444,DLH400')[0].props;
  assert.equal(p.photo, 'https://t.plnspttrs.net/1.jpg');
  assert.equal(p.photo_by, 'Max');
  assert.equal(p.origin.iata, 'FRA');
  assert.equal(p.destination.lon, -73.8);
  const q = parseAircraftInfo([ac, null, null], '3c6444')[0].props;
  assert.equal(q.photo, 'https://x/y.jpg'); // http → https
  assert.equal(q.origin, null);
});

test('foto-webcam.eu und Schiffsfotos', () => {
  const fw = parseFotoWebcam({ cams: [
    { id: 'zugspitze', title: 'Zugspitze', name: 'Zugspitze', latitude: 47.42, longitude: 10.98, link: 'https://www.foto-webcam.eu/webcam/zugspitze/' },
    { id: 'aus', latitude: 47, longitude: 11, offline: true },
    { id: '../böse', latitude: 47, longitude: 11 }
  ] });
  assert.equal(fw.length, 1);
  assert.equal(fw[0].props.image, 'https://www.foto-webcam.eu/webcam/zugspitze/current/1200.jpg');
  const ph = parseShipPhoto({ query: { pages: { 1: { title: 'Q3024816', pageimage: 'Viking_Grace Ruissalo.jpg' } } } }, '9606900')[0].props;
  assert.equal(ph.photo, 'https://commons.wikimedia.org/wiki/Special:FilePath/Viking_Grace%20Ruissalo.jpg?width=640');
  assert.equal(parseShipPhoto({}, '1')[0].props.photo, null);
});

test('Detailabfragen prüfen ihre Parameter', async () => {
  const { get } = setup(() => okJson({}));
  assert.equal((await get('/api/feed/aircraft?hex=zzz')).status, 400);
  assert.equal((await get('/api/feed/aircraft?hex=3c6444&cs=..')).status, 400);
  assert.equal((await get('/api/feed/track?hex=3c64')).status, 400);
  assert.equal((await get('/api/feed/shipphoto?imo=123')).status, 400);
});

test('parseDwdWarnings: Fläche gerundet, Farbe, doppelte Kennungen nummeriert', () => {
  const poly = { type: 'Polygon', coordinates: [[[8.123456, 50.0], [8.5, 50.0], [8.5, 50.4], [8.123456, 50.0]]] };
  const f = parseDwdWarnings({ type: 'FeatureCollection', features: [
    { geometry: { type: 'MultiPolygon', coordinates: [poly.coordinates] }, properties: { IDENTIFIER: 'A1', EVENT: 'FROST', HEADLINE: 'Amtliche WARNUNG vor FROST', DESCRIPTION: 'Frost', INSTRUCTION: 'Schutz', SEVERITY: 'Minor', ONSET: '2026-11-06T20:00:00Z', EXPIRES: '2026-11-07T09:00:00Z', EC_AREA_COLOR: '255 235 59', AREADESC: 'Kreis X' } },
    { geometry: poly, properties: { IDENTIFIER: 'A1', EVENT: 'FROST', HEADLINE: 'Zweites Gebiet', SEVERITY: 'Severe', EC_AREA_COLOR: 'kaputt' } },
    { geometry: { type: 'Point', coordinates: [1, 2] }, properties: { IDENTIFIER: 'P' } },
    'Müll'
  ] });
  assert.equal(f.length, 2);
  assert.deepEqual(f.map((x) => x.id), ['A1', 'A1#1']);
  assert.equal(f[0].label, 'Amtliche WARNUNG vor FROST');
  assert.equal(f[0].props.color, '#ffeb3b');
  assert.equal(f[0].props.area, 'Kreis X');
  assert.equal(f[0].props.severity, 'Minor');
  assert.equal(f[1].props.color, null);
  assert.equal(f[1].props.instruction, null);
  assert.equal(f[0].geometry.type, 'MultiPolygon');
  assert.deepEqual(f[0].geometry.coordinates[0][0][0], [8.123, 50]);
  // Stellvertreterpunkt: Mittel der drei Eckpunkte (Schlusspunkt zählt nicht doppelt)
  assert.equal(f[1].lon, 8.374);
  assert.equal(f[1].lat, 50.133);
  assert.throws(() => parseDwdWarnings({}), /features fehlt/);
});

test('parseAurora: nur ab AURORA_MIN %, Länge nach -180..180', () => {
  const f = parseAurora({ 'Forecast Time': '2026-11-06T18:13:00Z', coordinates: [[0, 65, 9], [190, 70, 8], [359, 60, 7], [10, 61, 'x'], [350, 62, 30], 'Müll'] });
  assert.equal(AURORA_MIN, 8);
  assert.deepEqual(f.map((x) => x.id), ['0,65', '-170,70', '-10,62']);
  assert.equal(f[1].lon, -170);
  assert.equal(f[2].label, '30 %');
  assert.deepEqual(f[0].props, { p: 9, forecast: '2026-11-06T18:13:00Z' });
  assert.throws(() => parseAurora([]), /coordinates fehlt/);
});

test('parsePegel: nur Stationen mit Position und aktuellem Wasserstand', () => {
  const st = (uuid, over = {}) => ({ uuid, number: '1', longname: `PEGEL ${uuid}`, km: 1.7, agency: 'VERDEN', longitude: 10, latitude: 52, water: { longname: 'ALLER' },
    timeseries: [{ shortname: 'W', unit: 'cm', currentMeasurement: { timestamp: '2026-11-06T18:00:00+01:00', value: 120, stateMnwMhw: 'normal' } }], ...over });
  const f = parsePegel([st('a'), st('b', { latitude: undefined }), st('c', { timeseries: [{ shortname: 'W' }] }), st('d', { timeseries: [{ shortname: 'Q', currentMeasurement: { value: 3 } }] }), st('e', { water: undefined }), 'Müll']);
  assert.deepEqual(f.map((x) => x.id), ['a', 'e']);
  assert.equal(f[0].label, 'PEGEL a · ALLER');
  assert.equal(f[1].label, 'PEGEL e');
  assert.deepEqual(f[0].props, { name: 'PEGEL a', water: 'ALLER', value: 120, unit: 'cm', state: 'normal', time: '2026-11-06T18:00:00+01:00', number: '1', agency: 'VERDEN', km: 1.7 });
  assert.throws(() => parsePegel({}), /Liste erwartet/);
});


test('Flugsuche: Rufzeichen und Kennzeichen zugleich, Treffer zusammengeführt, nur gültige Eingaben', async () => {
  const { get, calls } = setup((url) => okJson(url.includes('/callsign/') ? READSB : { ac: [READSB.ac[0]] }));
  assert.equal((await get('/api/feed/find?q=a')).status, 400);
  assert.equal((await get('/api/feed/find?q=DLH%2F1')).status, 400);
  assert.equal(calls.length, 0);
  const r = await get('/api/feed/find?q=dlh4ab');
  assert.equal(r.status, 200);
  assert.deepEqual(calls, ['https://api.adsb.lol/v2/callsign/DLH4AB', 'https://api.adsb.lol/v2/reg/DLH4AB']);
  assert.equal(r.body.features.length, 2, 'doppeltes Flugzeug nur einmal');
});
