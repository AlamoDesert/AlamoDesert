// Erfundene Antworten im Format der echten Quellen. Positionen wandern mit der Zeit, damit die Aktualisierung sichtbar ist.
// Testbild vom eigenen Dev-Server (App-Symbol), damit die Detailkarte ohne Internet ein Bild zeigt.
const IMG = 'http://localhost:8890/icons/icon-512.png';
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

// Warnpolygone grob über Deutschland (Rechtecke), ein Gebiet doppelt gemeldet.
function dwdWarnings() {
  const box = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
  const mk = (id, event, severity, color, coords) => ({
    type: 'Feature', id: `mock.${id}`, geometry: { type: 'MultiPolygon', coordinates: [coords] },
    properties: { IDENTIFIER: id, EVENT: event, HEADLINE: `Amtliche WARNUNG vor ${event}`, DESCRIPTION: `Es tritt ${event.toLowerCase()} auf (Testdaten).`, INSTRUCTION: 'Hinweis auf: Testdaten.', SEVERITY: severity, ONSET: new Date(Date.now() - 3600e3).toISOString(), EXPIRES: new Date(Date.now() + 8 * 3600e3).toISOString(), EC_AREA_COLOR: color }
  });
  return { type: 'FeatureCollection', features: [
    mk('mock-frost', 'FROST', 'Minor', '255 235 59', box(8.1234, 49.5, 10.2, 51.2)),
    mk('mock-frost', 'FROST', 'Minor', '255 235 59', box(11, 48.2, 12.5, 49.3)),
    mk('mock-wind', 'ORKANBÖEN', 'Severe', '244 67 54', box(6.5, 53.2, 9.8, 54.4))
  ] };
}

// Polarlicht-Band: nördlich und südlich, Längen wie bei NOAA 0..359.
function aurora() {
  const r = rand(7);
  const coordinates = [];
  for (let lon = 0; lon < 360; lon += 2) {
    for (let lat = 58; lat <= 72; lat += 2) coordinates.push([lon, lat, Math.round(Math.max(0, 14 - Math.abs(lat - 66) * 2 + r() * 6))]);
    for (let lat = -72; lat <= -58; lat += 4) coordinates.push([lon, lat, Math.round(Math.max(0, 10 - Math.abs(lat + 66) * 1.5 + r() * 4))]);
  }
  return { 'Observation Time': new Date().toISOString(), 'Forecast Time': new Date(Date.now() + 1800e3).toISOString(), 'Data Format': '[Longitude, Latitude, Aurora]', coordinates };
}

function gdacs(type) {
  const ev = (id, name, alert, country, lon, lat, text) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { eventtype: type, eventid: id, name, alertlevel: alert, country, fromdate: '2026-11-01T06:00:00', todate: '2026-11-08T06:00:00', iscurrent: 'true', Class: 'Point_Centroid', severitydata: { severity: 1, severitytext: text, severityunit: '' } }
  });
  const data = {
    TC: [ev(9001, 'Tropical Cyclone TESTA-26', 'Orange', 'Philippinen', 128.4, 14.2, 'Typhoon (maximale Windgeschwindigkeit 150 km/h)'), ev(9002, 'Tropical Cyclone TESTB-26', 'Green', 'Madagaskar', 52.1, -18.6, 'Tropischer Sturm (90 km/h)')],
    FL: [ev(9101, 'Flood in Bangladesch', 'Red', 'Bangladesch', 90.4, 23.8, 'Magnitude 2'), ev(9102, 'Flood in Ecuador', 'Green', 'Ecuador', -79.9, -2.1, 'Magnitude 0')],
    DR: [ev(9201, 'Drought in Kenia', 'Orange', 'Kenia', 37.9, 0.5, 'Mittlere Auswirkung auf Landwirtschaft')],
    WF: [ev(9301, 'Wildfire in Kalifornien', 'Orange', 'USA', -120.5, 38.2, '4200 Hektar')]
  };
  return { type: 'FeatureCollection', features: data[type] ?? [] };
}

function eonet() {
  const e = (id, title, cat, coords, extra = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords },
    properties: { id, title, description: null, link: `https://eonet.gsfc.nasa.gov/api/v3/events/${id}`, closed: null, date: new Date(Date.now() - 86400e3).toISOString(), categories: [{ id: cat }], sources: [{ id: 'TEST', url: 'https://example.org/eonet' }], ...extra } });
  return { type: 'FeatureCollection', features: [
    e('EONET_T1', 'Wildfire Testtal, Kalifornien', 'wildfires', [-120.1, 38.5], { magnitudeValue: 982, magnitudeUnit: 'acres' }),
    e('EONET_T2', 'Tropical Storm Test', 'severeStorms', [-60.2, 17.4]),
    e('EONET_T3', 'Testvulkan, Island', 'volcanoes', [-19.0, 63.6])
  ] };
}

function pegel() {
  const r = rand(11);
  const states = ['normal', 'low', 'high', 'unknown', 'normal', 'commented'];
  const rivers = [['RHEIN', 7.6, 50.4], ['ELBE', 11.9, 52.1], ['DONAU', 11.5, 48.7], ['WESER', 9.1, 52.3], ['MAIN', 9.6, 49.9]];
  return Array.from({ length: 20 }, (_, i) => {
    const [w, lon, lat] = rivers[i % rivers.length];
    return {
      uuid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, number: String(1000 + i), shortname: `PEGEL${i}`, longname: `TESTPEGEL ${i}`,
      km: Math.round(r() * 5000) / 10, agency: 'TEST', longitude: lon + (r() - 0.5) * 2, latitude: lat + (r() - 0.5) * 1.5, water: { shortname: w, longname: w },
      timeseries: [{ shortname: 'W', longname: 'WASSERSTAND ROHDATEN', unit: 'cm', currentMeasurement: { timestamp: new Date().toISOString(), value: Math.round(60 + r() * 400), stateMnwMhw: states[i % states.length] } }]
    };
  });
}

function odl() {
  const r = rand(23);
  const features = Array.from({ length: 30 }, (_, i) => {
    const cosmic = 0.035 + r() * 0.02;
    const terr = 0.03 + r() * 0.06;
    return {
      type: 'Feature', geometry: { type: 'Point', coordinates: [6 + r() * 9, 47.5 + r() * 7] },
      properties: { id: `DEZ${String(1000 + i)}`, plz: String(10000 + Math.floor(r() * 80000)), name: `Testmessstelle ${i}`, site_status: i === 29 ? 2 : 1, height_above_sea: Math.round(r() * 800),
        end_measure: new Date().toISOString(), value: Math.round((cosmic + terr) * 1000) / 1000, value_cosmic: Math.round(cosmic * 1000) / 1000, value_terrestrial: Math.round(terr * 1000) / 1000, unit: 'µSv/h' }
    };
  });
  return { type: 'FeatureCollection', features };
}

export async function mockFetch(url) {
  const u = new URL(url);
  const point = /\/v2\/point\/(-?[\d.]+)\/(-?[\d.]+)\//.exec(u.pathname);
  if (point) return json(aircraft(Number(point[1]), Number(point[2])));
  if (u.host === 'earthquake.usgs.gov') return json(quakes());
  if (u.host === 'api.tfl.gov.uk') return json(Array.from({ length: 60 }, (_, i) => ({
    id: `JamCams_${i}`, commonName: `Testkreuzung ${i}`, lat: 51.45 + (i % 10) * 0.012, lon: -0.2 + Math.floor(i / 10) * 0.05,
    additionalProperties: [{ key: 'available', value: 'true' }, { key: 'imageUrl', value: `${IMG}?cam=${i}` }, { key: 'videoUrl', value: 'https://example.org/v.mp4' }]
  })));
  if (u.host === 'webcams.nyctmc.org') return json([{ id: 'n1', name: 'Broadway @ 42 St', latitude: 40.756, longitude: -73.986, area: 'Manhattan', isOnline: 'true', imageUrl: IMG }]);
  if (u.host === 'cwwp2.dot.ca.gov') return json({ data: [] });
  if (u.host === 'tie.digitraffic.fi') return json({ type: 'FeatureCollection', features: [] });
  if (u.host === 'maps.dwd.de') return json(dwdWarnings());
  if (u.host === 'services.swpc.noaa.gov') return json(aurora());
  if (u.host === 'www.gdacs.org') {
    const t = u.searchParams.get('eventtype');
    return t === 'VO' ? new Response('{"status":404}', { status: 404 }) : json(gdacs(t));
  }
  if (u.host === 'eonet.gsfc.nasa.gov') return json(eonet());
  if (u.host === 'www.pegelonline.wsv.de') return json(pegel());
  if (u.host === 'www.imis.bfs.de') return json(odl());
  return new Response('not found', { status: 404 });
}
