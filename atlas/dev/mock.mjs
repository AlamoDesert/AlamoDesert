// Erfundene Antworten im Format der echten Quellen. Positionen wandern mit der Zeit, damit die Aktualisierung sichtbar ist.
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function aircraft(lat, lon) {
  const r = rand(Math.round((lat + 90) * 1000 + lon + 180));
  const t = Date.now() / 1000;
  const ac = [];
  for (let i = 0; i < 25; i++) {
    const track = Math.floor(r() * 360);
    const speed = 250 + r() * 250; // Knoten
    const move = ((t % 3600) * speed) / 3600 / 60; // Grad (grob)
    const rad = (track * Math.PI) / 180;
    const ground = i === 0;
    ac.push({
      hex: (0x3c0000 + Math.floor(r() * 0xffff)).toString(16),
      flight: `TST${100 + i} `,
      r: `D-T${String.fromCharCode(65 + i)}XX`,
      t: ['A320', 'B738', 'A21N', 'E190'][i % 4],
      lat: lat + (r() - 0.5) * 4 + (ground ? 0 : Math.cos(rad) * move * 0.2),
      lon: lon + (r() - 0.5) * 4 + (ground ? 0 : Math.sin(rad) * move * 0.2),
      alt_baro: ground ? 'ground' : Math.floor(r() * 38000),
      gs: ground ? 0 : Math.round(speed),
      track,
      squawk: '1000'
    });
  }
  return { ac, now: Date.now(), total: ac.length };
}

function quakes() {
  const r = rand(42);
  const features = [];
  for (let i = 0; i < 40; i++) {
    const mag = Math.round(r() * 70) / 10;
    features.push({
      type: 'Feature', id: `mock${i}`,
      geometry: { type: 'Point', coordinates: [r() * 360 - 180, r() * 140 - 70, Math.round(r() * 300)] },
      properties: { mag, place: `Testort ${i}`, time: Date.now() - Math.floor(r() * 86400000), url: 'https://earthquake.usgs.gov', tsunami: 0 }
    });
  }
  return { type: 'FeatureCollection', features };
}

export async function mockFetch(url) {
  const u = new URL(url);
  const point = /\/v2\/point\/(-?[\d.]+)\/(-?[\d.]+)\//.exec(u.pathname);
  if (point) return json(aircraft(Number(point[1]), Number(point[2])));
  if (u.host === 'earthquake.usgs.gov') return json(quakes());
  return new Response('not found', { status: 404 });
}
