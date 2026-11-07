/* Live Karten – Seeweg zum AIS-Zielhafen. Lädt beim ersten Gebrauch das Seewege-Netz (Eurostat „marnet“, 10 km,
   EUPL-1.2) und die Häfen (UN/LOCODE) und sucht im Browser den kürzesten Weg übers Wasser (A*).
   Erzeugt aus den Originaldaten mit tools/seaways.py. Nur zur Anschauung, keine Navigation. */

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
function km(lon1, lat1, lon2, lat2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

let graphP = null;
let portsP = null;

/** seaways.bin: [n, m] (Uint32), n × (lon, lat) als Int32 in Tausendstel Grad, m × (i, j) als Uint32. */
function loadGraph() {
  graphP ||= fetch('data/seaways.bin').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }).then((buf) => {
    const head = new Uint32Array(buf, 0, 2);
    const n = head[0], m = head[1];
    const raw = new Int32Array(buf, 8, n * 2);
    const xy = new Float64Array(n * 2);
    for (let i = 0; i < n * 2; i++) xy[i] = raw[i] / 1000;
    const ed = new Uint32Array(buf, 8 + n * 8, m * 2);
    // Nachbarlisten (CSR) mit Länge in km
    const deg = new Uint32Array(n + 1);
    for (let k = 0; k < m; k++) { deg[ed[2 * k] + 1]++; deg[ed[2 * k + 1] + 1]++; }
    for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
    const nb = new Uint32Array(m * 2), w = new Float32Array(m * 2), fill = deg.slice(0, n);
    for (let k = 0; k < m; k++) {
      const a = ed[2 * k], b = ed[2 * k + 1];
      const d = km(xy[2 * a], xy[2 * a + 1], xy[2 * b], xy[2 * b + 1]);
      nb[fill[a]] = b; w[fill[a]++] = d;
      nb[fill[b]] = a; w[fill[b]++] = d;
    }
    return { n, xy, start: deg, nb, w };
  });
  return graphP;
}

const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9>]+/g, ' ').trim();

function loadPorts() {
  portsP ||= fetch('data/ports.json').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then((list) => {
    const byCode = new Map(), byName = new Map();
    for (const [code, name, lon, lat] of list) {
      const p = { code, name, lon, lat };
      byCode.set(code, p);
      const key = norm(name).replace(/ /g, '');
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(p);
    }
    return { byCode, byName };
  });
  return portsP;
}

/** Häufige englische/abgekürzte Schreibweisen in AIS-Zielen → Name in UN/LOCODE (ohne Leerzeichen). */
const ALIAS = {
  GENOA: 'GENOVA', LEGHORN: 'LIVORNO', NAPLES: 'NAPOLI', VENICE: 'VENEZIA', LISBON: 'LISBOA', ANTWERP: 'ANTWERPEN',
  GOTHENBURG: 'GOTEBORG', COPENHAGEN: 'KOBENHAVN', FUJAIRAH: 'ALFUJAYRAH', BREMENHAVEN: 'BREMERHAVEN', ADAM: 'AMSTERDAM',
  RDAM: 'ROTTERDAM', ROTTERDAMEUROPOORT: 'ROTTERDAM', EUROPOORT: 'ROTTERDAM', FLUSHING: 'VLISSINGEN', HELSINGOR: 'HELSINGOR',
  GDANSKPORT: 'GDANSK', DANZIG: 'GDANSK', STETTIN: 'SZCZECIN', KIELCANAL: 'KIEL', NOK: 'BRUNSBUTTEL', DUNKIRK: 'DUNKERQUE',
  CORUNNA: 'LACORUNA', SEVILLE: 'SEVILLA', ALGIERS: 'ALGER', PIRAEUS: 'PIRAIEUS', MOSCOW: 'MOSKVA'
};
/** Varianten eines Namensschlüssels: Alias und Umlaut-Umschreibungen (WARNEMUENDE → WARNEMUNDE). */
const variants = (k) => [k, ALIAS[k], k.replace(/UE/g, 'U').replace(/OE/g, 'O').replace(/AE/g, 'A')].filter(Boolean);

const GENERIC = new Set(['FOR', 'ORDER', 'ORDERS', 'PILOT', 'PILOTS', 'ANCHORAGE', 'ANCH', 'SEA', 'FISHING', 'FISHERY', 'OFFSHORE', 'TRIAL', 'TRIALS']);

/** AIS-Ziel (Freitext) → Hafen: zuerst UN/LOCODE (z. B. „DEBKE“, „NL RTM“, „NLRTM>DEHAM“), sonst Name; bei mehreren der nächste. */
export async function findPort(destination, [lon, lat]) {
  const { byCode, byName } = await loadPorts();
  const last = norm(destination).split('>').pop().trim();
  if (!last) return null;
  // „ESBCN-ESPMI“ / „DEHAM DEBRV“: mehrere Hafencodes = Route, das Ziel ist der letzte
  const codes = last.split(' ').filter((w) => /^[A-Z]{2}[A-Z0-9]{3}$/.test(w) && byCode.has(w));
  if (codes.length > 1) return byCode.get(codes.at(-1));
  const compact = last.replace(/ /g, '');
  const code = [compact.slice(0, 5), last.split(' ')[0]].find((c) => /^[A-Z]{2}[A-Z0-9]{3}$/.test(c) && byCode.has(c));
  if (code) return byCode.get(code);
  const words = last.split(' ').filter((x) => x && !GENERIC.has(x));
  for (let k = words.length; k >= 1; k--) {
    const key = words.slice(0, k).join('');
    // Abkürzungen wie „ST PETERSBURG“ → „SAINT…/SANKT…“, dazu Aliase und Umlaut-Umschreibungen
    const hits = variants(key).map((x) => byName.get(x)).find((h) => h?.length)
      || (/^ST/.test(key) && (byName.get(`SAINT${key.slice(2)}`) || byName.get(`SANKT${key.slice(2)}`)));
    if (hits?.length) return hits.reduce((a, b) => (km(lon, lat, a.lon, a.lat) <= km(lon, lat, b.lon, b.lat) ? a : b));
  }
  return null;
}

function nearest(g, lon, lat) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < g.n; i++) {
    const dx = (g.xy[2 * i] - lon) * Math.cos(rad(lat)), dy = g.xy[2 * i + 1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, km: km(lon, lat, g.xy[2 * best], g.xy[2 * best + 1]) };
}

/** Kürzester Weg übers Wasser als [lon, lat]-Liste, oder null (zu weit vom Netz, kein Weg). */
export async function seaRoute(from, to) {
  const g = await loadGraph();
  const a = nearest(g, from[0], from[1]), b = nearest(g, to[0], to[1]);
  if (a.i < 0 || b.i < 0 || a.km > 60 || b.km > 80) return null;
  const n = g.n, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const tx = g.xy[2 * b.i], ty = g.xy[2 * b.i + 1];
  const h = (i) => km(g.xy[2 * i], g.xy[2 * i + 1], tx, ty);
  // Binärer Heap über [Schätzung, Knoten]
  const heap = [];
  const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let s = c; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === c) break; [heap[s], heap[c]] = [heap[c], heap[s]]; c = s; } } return top; };
  dist[a.i] = 0;
  push(h(a.i), a.i);
  while (heap.length) {
    const [, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === b.i) break;
    for (let k = g.start[i]; k < g.start[i + 1]; k++) {
      const j = g.nb[k], d = dist[i] + g.w[k];
      if (d < dist[j]) { dist[j] = d; prev[j] = i; push(d + h(j), j); }
    }
  }
  if (!done[b.i]) return null;
  const path = [];
  for (let i = b.i; i >= 0; i = prev[i]) path.push([g.xy[2 * i], g.xy[2 * i + 1]]);
  path.reverse();
  return { path: [from, ...path, to], km: a.km + dist[b.i] + b.km };
}
