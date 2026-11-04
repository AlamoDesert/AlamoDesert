// Prüft die Livestream-Liste (public/data/livestreams.json): läuft der Stream gerade, darf er eingebettet werden?
// Start: node tools/livestreams.mjs [--write]
// --write entfernt Streams, die es nicht mehr gibt oder die nicht eingebettet werden dürfen, und setzt das Prüfdatum.
// Offline-Streams bleiben drin (viele Webcams starten nachts oder bei Wartung neu), werden aber gemeldet.
// YouTube vergibt nach einem Neustart oft eine neue Video-ID → gemeldete Streams beim Betreiber neu heraussuchen
// (mit channelId spielt die App den aktuellen Stream des Kanals, die alte ID schadet dann nicht).
// In der Cloud-Umgebung sind die Anbieter gesperrt → auf dem Pi ausführen.
import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../public/data/livestreams.json', import.meta.url);
const write = process.argv.includes('--write');
const data = JSON.parse(await readFile(file, 'utf8'));
const HEADERS = { 'accept-language': 'de-DE', 'user-agent': 'Mozilla/5.0 (LiveKarten-Pruefung)', cookie: 'SOCS=CAI' };
const get = (url) => fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });

const CHECKS = {
  async yt(p) {
    const oembed = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${p.video}`)}`);
    // 401 = Einbetten verboten, 404 = Video weg (im Kanal-Modus läuft evtl. schon ein neuer Stream)
    if (!oembed.ok && !p.channelId) return { keep: false, why: oembed.status === 401 ? 'Einbetten nicht erlaubt' : `nicht gefunden (HTTP ${oembed.status})` };
    let video = p.video;
    if (p.channelId) {
      // /live verweist per canonical-Link auf den aktuellen Stream des Kanals
      const live = await (await get(`https://www.youtube.com/channel/${p.channelId}/live`)).text();
      video = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/.exec(live)?.[1];
      if (!video) return { keep: true, live: false, why: 'Kanal sendet gerade nicht' };
    }
    const page = await (await get(`https://www.youtube.com/watch?v=${video}`)).text();
    return { keep: true, live: page.includes('"isLiveNow":true'), why: video !== p.video ? `läuft jetzt unter ${video}` : '' };
  },
  async embed(p) {
    const res = await get(p.embed);
    if (!res.ok) return { keep: false, why: `Player HTTP ${res.status}` };
    const html = await res.text();
    if (new URL(p.embed).hostname === 'g0.ipcamlive.com') {
      if (html.includes('Camera not found')) return { keep: false, why: 'Kamera bei ipcamlive gelöscht' };
      if (/var domainlockenabled\s*=\s*1/.test(html)) return { keep: false, why: 'nur noch auf der Seite des Betreibers erlaubt' };
      return { keep: true, live: /var available\s*=\s*1/.test(html) };
    }
    return { keep: true, live: true };
  },
  async hls(p) {
    const res = await get(p.hls);
    const ok = res.ok && (await res.text()).includes('#EXTM3U');
    return { keep: true, live: ok, why: ok ? '' : `Stream antwortet nicht (HTTP ${res.status})` };
  }
};

const keep = [];
let offline = 0;
for (const f of data.features) {
  let r;
  try { r = await CHECKS[f.props.kind](f.props); } catch (e) { r = { keep: true, live: false, why: `Fehler: ${e.message}` }; }
  if (r.keep) keep.push(f);
  if (!r.live) offline++;
  const why = r.why || (r.live ? '' : 'gerade nicht live');
  console.log(`${r.keep ? (r.live ? 'LIVE' : 'AUS ') : 'WEG '} ${f.props.kind.padEnd(5)} ${f.label}${why ? `  – ${why}` : ''}`);
}
console.log(`\n${data.features.length - offline} von ${data.features.length} live, ${data.features.length - keep.length} zu entfernen.`);

if (write) {
  const out = { ...data, at: new Date().toISOString(), features: keep };
  const head = JSON.stringify({ source: out.source, at: out.at, stale: false }).slice(0, -1);
  await writeFile(file, `${head}, "features": [\n${keep.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`);
  console.log(`Gespeichert: ${keep.length} Streams.`);
}
