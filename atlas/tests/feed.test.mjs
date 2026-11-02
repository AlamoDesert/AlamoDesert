import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProxy } from '../netlify/functions/feed/core.mts';
import { parseReadsb, parseUsgs, cellCenter, CELL } from '../netlify/functions/feed/sources.mts';

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
    props: { callsign: 'DLH4AB', reg: 'D-AIBA', type: 'A319', alt_ft: 35000, ground: 0, speed_kt: 452.3, squawk: '1000' }
  });
  assert.equal(f[1].props.ground, 1);
  assert.equal(f[1].props.alt_ft, 0);
  assert.equal(f[1].label, '3C65A1');
  assert.throws(() => parseReadsb({ foo: 1 }), /ac fehlt/);
});

test('parseUsgs liest Magnitude, Tiefe und Link', () => {
  const f = parseUsgs({ type: 'FeatureCollection', features: [
    { id: 'us1', geometry: { coordinates: [142.1, 38.2, 10.5] }, properties: { mag: 5.04, place: 'Japan', time: 1, url: 'https://e.x/1' } },
    { id: 'bad', geometry: { coordinates: [] }, properties: {} }
  ] });
  assert.equal(f.length, 1);
  assert.equal(f[0].label, 'M 5.0 · Japan');
  assert.equal(f[0].props.depth_km, 10.5);
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
  assert.equal((await get('/api/feed/quakes')).status, 502);
});
