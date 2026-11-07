/* Häfen für die Restroute der Schiffe: public/data/ports.json = [[UN/LOCODE, Name, lon, lat], …].
   Quelle: npm-Paket @geoapify/un-locode (MIT) – UN/LOCODE mit nachgetragenen Koordinaten (Geoapify-Geokodierung)
   für Orte, denen die offizielle Liste keine mitgibt (z. B. Danzig, Southampton, Bremen). Nur Orte mit Funktion
   „Hafen“ (Index 0 der Funktionsliste) und Koordinaten.
   Aufruf: npm pack @geoapify/un-locode && tar xzf geoapify-un-locode-*.tgz && node tools/ports.mjs package/dist/json-data */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Aufruf: node tools/ports.mjs <…/dist/json-data>'); process.exit(1); }
const out = [];
const ok = (c) => c && Number.isFinite(c.lat) && Number.isFinite(c.lon);
for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json')).sort()) {
  const rows = JSON.parse(await readFile(join(dir, f), 'utf8'));
  // Häfen ohne Koordinaten (z. B. DEWHV Wilhelmshaven): Koordinaten eines gleichnamigen Ortes im selben Land nehmen
  const byName = new Map();
  for (const r of rows) if (ok(r.coordinates)) byName.set(r.nameWoDiacritics || r.name, r.coordinates);
  for (const r of rows) {
    if (!Array.isArray(r.function) || !r.function.includes(0) || r.change === 'X') continue;
    const name = r.nameWoDiacritics || r.name;
    const c = ok(r.coordinates) ? r.coordinates : byName.get(name);
    if (!ok(c)) continue;
    out.push([`${r.country}${r.location}`, name, Math.round(c.lon * 1000) / 1000, Math.round(c.lat * 1000) / 1000]);
  }
}
out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
await writeFile(new URL('../public/data/ports.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length} Häfen geschrieben`);
