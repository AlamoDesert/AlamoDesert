// Prüft die Livestream-Liste (public/data/livestreams.json): läuft der Stream gerade, darf er eingebettet werden?
// Start: node tools/livestreams.mjs [--write]
// --write entfernt Streams, die nicht mehr existieren oder nicht eingebettet werden dürfen, und setzt das Prüfdatum.
// Offline-Streams bleiben drin (viele Webcams starten nachts oder bei Wartung neu), werden aber gemeldet.
// YouTube vergibt nach einem Neustart oft eine neue Video-ID → gemeldete Streams beim Betreiber neu heraussuchen.
// In der Cloud-Umgebung ist YouTube gesperrt → auf dem Pi ausführen.
import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../public/data/livestreams.json', import.meta.url);
const write = process.argv.includes('--write');
const data = JSON.parse(await readFile(file, 'utf8'));
const HEADERS = { 'accept-language': 'de-DE', 'user-agent': 'Mozilla/5.0 (LiveKarten-Pruefung)' };

async function check(id) {
  const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  // 401 = Einbetten verboten, 404 = Video weg
  if (!oembed.ok) return { keep: false, why: oembed.status === 401 ? 'Einbetten nicht erlaubt' : `nicht gefunden (HTTP ${oembed.status})` };
  const page = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) })).text();
  const live = page.includes('"isLiveNow":true');
  return { keep: true, live, why: live ? '' : 'gerade nicht live' };
}

const keep = [];
let offline = 0;
for (const f of data.features) {
  let r;
  try { r = await check(f.props.video); } catch (e) { r = { keep: true, live: false, why: `Fehler: ${e.message}` }; }
  if (r.keep) keep.push(f);
  if (!r.live) offline++;
  console.log(`${r.keep ? (r.live ? 'LIVE' : 'AUS ') : 'WEG '} ${f.props.video}  ${f.label}${r.why ? `  – ${r.why}` : ''}`);
}
console.log(`\n${data.features.length - offline} von ${data.features.length} live, ${data.features.length - keep.length} zu entfernen.`);

if (write) {
  const out = { ...data, at: new Date().toISOString(), features: keep };
  const head = JSON.stringify({ source: out.source, at: out.at, stale: false }).slice(0, -1);
  await writeFile(file, `${head}, "features": [\n${keep.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`);
  console.log(`Gespeichert: ${keep.length} Streams.`);
}
