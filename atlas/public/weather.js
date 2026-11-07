/* Live Karten – Wetterkarte mit Zeitleiste und 16-Tage-Vorhersage für einen Ort.
   Karten: DWD-WMS – Radarkomposit Deutschland (1 km, letzte 2 h + Kurzfristvorhersage 2 h), ICON-EU (Europa,
   stündlich ~3 Tage), ICON (weltweit bis ~7 Tage). Die App holt pro Zeitpunkt EIN Bild in Bildschirmauflösung für den
   sichtbaren Ausschnitt (scharf statt hochskalierter Kacheln, flüssig per Vorausladen). Ort: Open-Meteo, 16 Tage.
   Alle Quellen ohne Schlüssel, CORS offen – der Browser lädt direkt, ohne Proxy. */

const DWD = 'https://maps.dwd.de/geoserver/dwd';
const HOUR = 3_600_000;
const MIN = 60_000;

/** Wetterkarten-Arten: Reihenfolge der Quellen = Reihenfolge auf der Zeitleiste. */
export const KINDS = {
  rain: {
    name: 'Niederschlag',
    short: 'Regen',
    opacity: 0.8,
    layers: [
      // Radar: gemessen bis jetzt, danach Kurzfristvorhersage (Nowcast) bis +2 h; alle 10 min.
      { wms: 'Radar_wn-product_1x1km_ger', model: 'Radar', what: 'Radar Deutschland, 1 km', radar: true, back: 2 * HOUR, stepMin: 10 },
      // ICON-EU: Niederschlag der jeweils letzten Stunde (Europa, ~3 Tage); danach ICON weltweit (6-h-Summen, alle 3 h).
      { wms: 'Icon-eu_reg00625_fd_sl_TOTPREC01H', model: 'ICON-EU', what: 'Niederschlag der letzten Stunde' },
      { wms: 'Icon_reg025_fd_sl_TOTPREC06H', model: 'ICON', what: 'Niederschlag der letzten 6 Stunden', every: 3 }
    ]
  },
  temp: {
    name: 'Temperatur',
    short: 'Temperatur',
    opacity: 0.55,
    layers: [{ wms: 'Icon_reg025_fd_sl_T2M', model: 'ICON', what: 'Lufttemperatur in 2 m' }]
  }
};

export const legendUrl = (layer) => `${DWD}/wms?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=dwd:${layer}`;

const R = 6378137;
const mercX = (lon) => (R * lon * Math.PI) / 180;
const mercY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Ein WMS-Bild für einen Ausschnitt (lon/lat-Grenzen) in Pixelgröße w×h, Web-Mercator. */
export function imageUrl(layer, time, { w, s, e, n }, width, height, ref = null) {
  const bbox = [mercX(w), mercY(s), mercX(e), mercY(n)].map((v) => v.toFixed(0)).join(',');
  return `${DWD}/wms?service=WMS&version=1.1.1&request=GetMap&layers=dwd:${layer}&styles=&format=image/png&transparent=true`
    + `&srs=EPSG:3857&width=${width}&height=${height}&bbox=${bbox}&time=${encodeURIComponent(new Date(time).toISOString())}`
    + (ref ? `&DIM_REFERENCE_TIME=${encodeURIComponent(ref)}` : '');
}

/** Zeitangaben eines WMS-Layers: "start/ende/PT1H" (Intervall) oder Liste von Zeitpunkten → ms-Zeitstempel. */
export function parseTimes(text) {
  const out = [];
  for (const part of String(text || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const iv = part.split('/');
    if (iv.length === 3) {
      const start = Date.parse(iv[0]);
      const end = Date.parse(iv[1]);
      const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iv[2]);
      const step = m ? ((Number(m[1]) || 0) * 60 + (Number(m[2]) || 0)) * MIN : 0;
      if (!Number.isFinite(start) || !Number.isFinite(end) || step <= 0) continue;
      for (let t = start; t <= end && out.length < 2000; t += step) out.push(t);
    } else {
      const t = Date.parse(part);
      if (Number.isFinite(t)) out.push(t);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

const capsCache = new Map(); // Layer → { at, info }

/** Modellläufe: Der DWD kündigt einen neuen Lauf (REFERENCE_TIME) an, bevor alle Zeitpunkte gerechnet sind – dann
    liefert er für die Vorhersage nur Fehlermeldungen. Deshalb mit einem 8×8-Bild prüfen, ob der neueste Lauf den
    Zeitpunkt `probe` schon hat; sonst den vorherigen Lauf nehmen (per DIM_REFERENCE_TIME). */
async function pickRun(layer, refs, probe) {
  for (const ref of refs.slice(-2).reverse()) {
    const url = imageUrl(layer, probe, { w: 9, s: 50, e: 10, n: 51 }, 8, 8, ref);
    try {
      const res = await fetch(url);
      if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) return ref;
    } catch { /* nächster Lauf */ }
  }
  return refs.at(-2) || refs.at(-1) || null;
}

async function layerInfo(layer, now = Date.now()) {
  const hit = capsCache.get(layer);
  if (hit && Date.now() - hit.at < 10 * MIN) return hit.info;
  // Capabilities nur für diesen Layer (~12 KB statt ~1 MB für den ganzen Dienst)
  const res = await fetch(`${DWD}/${layer}/ows?service=WMS&version=1.3.0&request=GetCapabilities`);
  if (!res.ok) throw new Error(`DWD: HTTP ${res.status}`);
  const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
  const dims = [...xml.getElementsByTagName('Dimension')];
  const times = parseTimes(dims.find((d) => d.getAttribute('name') === 'time')?.textContent);
  if (!times.length) throw new Error('DWD: keine Zeitangaben');
  const refs = parseTimes(dims.find((d) => /^reference_time$/i.test(d.getAttribute('name') || ''))?.textContent).map((t) => new Date(t).toISOString());
  // Prüfzeitpunkt: zwei Tage voraus (bzw. das Ende), auf dem Raster der Zeitangaben
  const probe = times.find((t) => t >= now + 48 * HOUR) ?? times.at(-1);
  const ref = refs.length ? await pickRun(layer, refs, probe) : null;
  const info = { times, ref };
  capsCache.set(layer, { at: Date.now(), info });
  return info;
}

/** Schritte der Zeitleiste aus den Zeitangaben der Layer: [{ t, layer, ref, src, what }] in zeitlicher Reihenfolge.
    `timesByLayer[layer]` ist eine Liste von Zeitpunkten oder { times, ref } (ref = gewählter Modelllauf). */
export function stepsFrom(kind, timesByLayer, now = Date.now()) {
  const steps = [];
  const fromHour = Math.floor(now / HOUR) * HOUR;
  let after = -Infinity;
  for (const l of KINDS[kind].layers) {
    const entry = timesByLayer[l.wms];
    if (!entry) continue;
    const times = Array.isArray(entry) ? entry : entry.times;
    const ref = Array.isArray(entry) ? null : entry.ref;
    const from = l.back ? now - l.back : fromHour;
    for (const t of times) {
      if (t <= after || t < from) continue;
      if (l.every && new Date(t).getUTCHours() % l.every) continue;
      if (l.stepMin && Math.round(t / MIN) % l.stepMin) continue;
      const src = l.radar ? (t <= now ? 'Radar' : 'Radar-Vorhersage') : l.model;
      steps.push({ t, layer: l.wms, ref, src, what: l.what });
    }
    if (steps.length) after = steps.at(-1).t;
  }
  return steps;
}

/** `only`: nur die ersten n Quellen (z. B. erst das Radar zeigen, die Vorhersage kommt nach). */
export async function buildSteps(kind, now = Date.now(), only = Infinity) {
  const timesByLayer = {};
  const errors = [];
  await Promise.all(KINDS[kind].layers.slice(0, only).map(async (l) => {
    try { timesByLayer[l.wms] = await layerInfo(l.wms, now); } catch (e) { errors.push(e.message); }
  }));
  const steps = stepsFrom(kind, timesByLayer, now);
  if (!steps.length) throw new Error(errors[0] || 'Keine Wetterdaten');
  return steps;
}

/** Index des Schritts, der „jetzt“ am nächsten liegt; gibt es ein Radarbild, das neueste (gemessen schlägt berechnet). */
export function nowIndex(steps, now = Date.now()) {
  const radar = steps.findLastIndex((x) => x.src === 'Radar');
  if (radar >= 0 && now - steps[radar].t < 30 * 60_000) return radar;
  let best = 0;
  for (let i = 0; i < steps.length; i++) if (Math.abs(steps[i].t - now) < Math.abs(steps[best].t - now)) best = i;
  return best;
}

const DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const DATE = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });
const TIME = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** „Heute 14:00“, „Morgen 03:00“, „Sa 8.11. 12:00“ plus Abstand zu jetzt. */
export function stepLabel(t, now = Date.now()) {
  const d = new Date(t);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 86_400_000);
  const day = days === 0 ? 'Heute' : days === 1 ? 'Morgen' : days === -1 ? 'Gestern' : `${DAY.format(d)} ${DATE.format(d)}`;
  const diff = Math.round((t - now) / 60_000);
  const rel = Math.abs(diff) < 30 ? 'jetzt' : diff < 0 ? `vor ${diff > -90 ? `${-diff} min` : `${Math.round(-diff / 60)} h`}`
    : diff < 48 * 60 ? `in ${Math.round(diff / 60)} h` : `in ${Math.round(diff / 1440)} Tagen`;
  return { day, time: TIME.format(d), rel };
}

/** Tagesmarken für die Zeitleiste: Position (0..1) jeder Mitternacht zwischen erstem und letztem Schritt (Zeitachse). */
export function dayTicks(steps) {
  if (steps.length < 2) return [];
  const t0 = steps[0].t, t1 = steps.at(-1).t;
  const out = [];
  const d = new Date(t0); d.setHours(24, 0, 0, 0);
  for (; d.getTime() < t1; d.setDate(d.getDate() + 1)) out.push({ pos: (d.getTime() - t0) / (t1 - t0), label: DAY.format(d) });
  return out;
}

/** Schritt, der einem Zeitpunkt am nächsten liegt. */
export function nearestStep(steps, t) {
  let best = 0;
  for (let i = 1; i < steps.length; i++) if (Math.abs(steps[i].t - t) < Math.abs(steps[best].t - t)) best = i;
  return best;
}

/* ---------- Wetter an einem Ort: Open-Meteo, 16 Tage ---------- */

const WMO = {
  0: 'klar', 1: 'überwiegend klar', 2: 'teils bewölkt', 3: 'bedeckt', 45: 'Nebel', 48: 'Reifnebel',
  51: 'leichter Niesel', 53: 'Niesel', 55: 'starker Niesel', 56: 'gefrierender Niesel', 57: 'gefrierender Niesel',
  61: 'leichter Regen', 63: 'Regen', 65: 'starker Regen', 66: 'gefrierender Regen', 67: 'gefrierender Regen',
  71: 'leichter Schnee', 73: 'Schnee', 75: 'starker Schnee', 77: 'Schneegriesel',
  80: 'Regenschauer', 81: 'Regenschauer', 82: 'heftige Schauer', 85: 'Schneeschauer', 86: 'Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel'
};

export async function forecast(lon, lat) {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lon.toFixed(3), timezone: 'auto', forecast_days: '16',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (res.status === 429) throw new Error('Tageslimit bei Open-Meteo erreicht, später noch einmal versuchen');
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  const j = await res.json();
  const d = j?.daily;
  if (!d || !Array.isArray(d.time)) throw new Error('Open-Meteo: Unerwartetes Format');
  return d.time.map((day, i) => ({
    day,
    code: d.weather_code?.[i],
    max: d.temperature_2m_max?.[i],
    min: d.temperature_2m_min?.[i],
    rain: d.precipitation_sum?.[i],
    prob: d.precipitation_probability_max?.[i],
    wind: d.wind_speed_10m_max?.[i]
  }));
}

const n0 = (v) => (typeof v === 'number' ? Math.round(v) : '–');
const n1 = (v) => (typeof v === 'number' ? v.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '–');

/** Tabelle: zwei Wochen-Zusammenfassungen, darunter jeder Tag. */
export function forecastHtml(days) {
  const week = (list, title) => {
    if (!list.length) return '';
    const avg = (k) => list.reduce((s, x) => s + (x[k] ?? 0), 0) / list.length;
    const sum = list.reduce((s, x) => s + (x.rain ?? 0), 0);
    const wet = list.filter((x) => (x.rain ?? 0) >= 1).length;
    return `<div class="wk"><b>${title}</b><span>${n0(avg('min'))}° bis ${n0(avg('max'))}°</span><span>${n1(sum)} mm · ${wet} Regentag${wet === 1 ? '' : 'e'}</span></div>`;
  };
  const rows = days.map((x) => {
    const d = new Date(`${x.day}T12:00:00`);
    return `<tr><th>${DAY.format(d)} ${DATE.format(d)}</th><td class="wx-t">${WMO[x.code] || '–'}</td>`
      + `<td class="num"><b>${n0(x.max)}°</b> / ${n0(x.min)}°</td><td class="num">${n1(x.rain)} mm</td><td class="num">${n0(x.wind)} km/h</td></tr>`;
  }).join('');
  return `<div class="weeks">${week(days.slice(0, 7), 'Diese Woche')}${week(days.slice(7, 14), 'Nächste Woche')}</div>`
    + `<div class="fc-wrap"><table class="fc"><thead><tr><th>Tag</th><th>Wetter</th><th class="num">Max / Min</th><th class="num">Regen</th><th class="num">Wind</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
