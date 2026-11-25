// Prüft alle Eingabefenster der Rezeption auf die typischen Fehler beim Neuzeichnen:
// Enter speichert und schließt, Eingaben überleben Neuzeichnen und PIN-Sperre, kein doppeltes Anlegen.
// Aufruf: node tools/build.mjs && node tools/test-fenster.cjs   (braucht Playwright mit Chromium)
"use strict";
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html" : "text/javascript" }); fs.createReadStream(f).pipe(r);
});
const q = (p, sel) => p.locator("#rz-host " + sel);
function f1(pin) { let h = 0x811c9dc5; for (const ch of "rezeption:" + pin) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return "f1:" + h.toString(16); }
let fails = 0;
const check = (ok, name) => { console.log(`${ok ? "ok  " : "FEHLER"} ${name}`); if (!ok) fails++; };

srv.listen(0, async () => {
  const url = `http://localhost:${srv.address().port}/index.html`;
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(2026, 10, 24, 16, 0, 0) });
  await p.addInitScript((pin) => {
    if (localStorage.getItem("__t")) return; localStorage.setItem("__t", "1");
    localStorage.setItem("rz2cfg", JSON.stringify({ people: [{ id: "pa", name: "Test Anna" }], roster: {}, weekday: {}, base: null, adminPin: pin }));
    localStorage.setItem("rz2:2026-11-23", JSON.stringify({ month: "2026-11", time: { t1: { pid: "pa", role: "frueh", in: "08:00", out: null, pause: null, at: "2026-11-23T08:00:00Z" } } }));
  }, f1("1234"));
  await p.goto(url); await p.waitForTimeout(800);
  const step = async (ms = 5) => { await p.clock.runFor(ms); await p.waitForTimeout(60); };

  // Einchecken: Nachtragen-Grund überlebt Rollenwechsel
  await q(p, '[data-pick="pa"]').click(); await step();
  await q(p, "#ci-staler-0").fill("vergessen"); await q(p, "#ci-staleskip-0").check();
  await q(p, '[data-cirole="spaet"]').click(); await step();
  check(await q(p, "#ci-staler-0").inputValue() === "vergessen" && await q(p, "#ci-staleskip-0").isChecked(), "Einchecken: Nachtragen bleibt beim Rollenwechsel");
  await q(p, '[data-ci="ok"]').click(); await step(300);
  if (await q(p, "#remind [data-hlater]").count()) { await q(p, "#remind [data-hlater]").click(); await step(); }

  // Eigene Erinnerung: Neuzeichnen beim Tippen + Klick, dann Enter
  await q(p, "[data-remadd]").click(); await q(p, "#rp-t").fill("Erste"); await step(31000);
  const bb = await q(p, "#rempop button[type=submit]").boundingBox();
  await p.mouse.move(bb.x + 20, bb.y + 10); await p.mouse.down(); await step(); await p.mouse.up(); await step(300);
  check(await q(p, "#rempop").count() === 0 && await q(p, ".tlrchip.own").count() === 1, "Erinnerung: Speichern trotz Neuzeichnen");
  await q(p, "[data-remadd]").click(); await step();
  check(await q(p, "#rp-t").inputValue() === "", "Erinnerung: zweites Fenster startet leer");
  await q(p, "#rp-t").fill("Zweite"); await q(p, "#rp-t").press("Enter"); await step(300);
  check(await q(p, "#rempop").count() === 0 && await q(p, ".tlrchip.own").count() === 2, "Erinnerung: Enter speichert und schließt");
  check(await q(p, ".tllane .tlrchip.own").count() === 2 && await q(p, "#phase-own").count() === 0, "Erinnerung: eigener Bereich rechts im Tagesablauf");
  await q(p, "[data-remadd]").click(); await q(p, "#rp-t").fill("Dritte"); await q(p, "#rp-at").fill("16:20"); await q(p, "#rp-t").press("Enter"); await step(300);
  // Erinnerung antippen = ändern: Fenster mit Text und Uhrzeit vorbelegt, Speichern ändert dieselbe Erinnerung
  await q(p, '.tlrchip [data-remedit]').filter({ hasText: "Zweite" }).click(); await step(100);
  check((await q(p, "#rp-title").textContent()) === "Erinnerung ändern" && (await q(p, "#rp-t").inputValue()) === "Zweite", "Erinnerung: Antippen öffnet „Erinnerung ändern“ mit Text");
  await q(p, "#rp-t").fill("Zweite geändert"); await q(p, "#rp-at").fill("17:40"); await q(p, "#rp-t").press("Enter"); await step(300);
  check(await q(p, ".tlrchip.own").count() === 3 && await q(p, ".tlrchip.own").filter({ hasText: "17:40 Zweite geändert" }).count() === 1 && await q(p, ".tlrchip.own").filter({ hasText: /Zweite$/ }).count() === 0, "Erinnerung: Ändern speichert Text und Uhrzeit, keine neue");
  // Zeitgenau: 16:20 liegt im Abschnitt 16:00–16:30 → Glocke bei ca. zwei Dritteln seiner Höhe, Karte rechts daneben
  const sec = await p.locator("#rz-host .tlrow").filter({ has: p.locator("#phase-start") }).boundingBox();
  const bell = await q(p, '.tlbell[data-at="980"]').boundingBox(), chip = await q(p, ".tlrchip").filter({ hasText: "Dritte" }).boundingBox();
  const rel = bell && sec ? (bell.y + bell.height / 2 - sec.y) / sec.height : -1;
  check(rel > 0.55 && rel < 0.8 && chip && Math.abs((chip.y + chip.height / 2) - (bell.y + bell.height / 2)) < 30 && chip.x > sec.x + sec.width - 300, "Erinnerung: Glocke und Karte stehen auf der Höhe ihrer Uhrzeit (" + rel.toFixed(2) + ")");
  // Trennlinie verschieben: 80 px nach links → Bereich breiter, gespeichert
  const sp = await q(p, ".tlsplit").boundingBox();
  await p.mouse.move(sp.x + 6, sp.y + 40); await p.mouse.down(); await p.mouse.move(sp.x - 74, sp.y + 40, { steps: 4 }); await p.mouse.up(); await step(300);
  const lw = await p.evaluate(() => { const l = JSON.parse(localStorage.getItem("rz2layout") || "{}"); return (l.pa || l._ || {}).remw; });
  check(lw >= 310 && lw <= 350, "Erinnerung: Trennlinie verschiebbar, Breite gespeichert (" + lw + ")");

  // Flexible Zeiten: Beginn aus dem Einchecken, Schluss heute ändern, Sonnenuntergang
  const bTxt = await q(p, ".tlrow.is-bound").first().innerText();
  check(/16:00/.test(bTxt) && /Beginn/.test(bTxt) && /eingecheckt/.test(bTxt), "Tagesablauf: Beginn = Einchecken (16:00) – " + bTxt.replace(/\s+/g, " "));
  check(await q(p, ".jetzt").count() === 0 && await q(p, ".tiles").count() === 0 && await q(p, "#tl-now").count() === 1, "Tagesablauf: keine Jetzt-Leiste, keine Kacheln, Jetzt-Linie da");
  check(await q(p, ".tlsun").count() === 1, "Tagesablauf: Sonnenuntergang als Zeile");
  const rowOf = (id) => p.locator("#rz-host .tlrow").filter({ has: p.locator("#" + id) });
  const g0 = (await rowOf("phase-start").getAttribute("class")) || "";
  check(/is-now/.test(g0) && await q(p, ".stop.is-now:not(.soon) .pill.ok").count() === 1, "Farbe: im Zeitrahmen grün");
  check(await q(p, ".tllater").count() >= 3, "Tagesablauf: spätere Abschnitte als eine Zeile");
  const rb = await rowOf("phase-start").boundingBox(), nb = await q(p, "#tl-now").boundingBox();
  check(rb && nb && nb.y >= rb.y && nb.y <= rb.y + rb.height * 0.3, "Tagesablauf: Uhrzeit läuft im laufenden Abschnitt mit (oben, kurz nach Beginn)");
  await q(p, '[data-adj="spaet:end"]').click(); await step();
  await q(p, '[data-adjq="-30"]').click(); await q(p, "#ad-r").fill("letzte Buchung"); await step(31000);
  await q(p, "#ad-r").press("Enter"); await step(300);
  const adj = await p.evaluate(() => (JSON.parse(localStorage.getItem("rz2:2026-11-24")).adj || {}).spaet);
  check(await q(p, "#adjpop").count() === 0 && adj && adj.end.t === "22:30" && adj.end.reason === "letzte Buchung" && adj.end.by === "pa", "Flexibel: Schluss −30 mit Grund gespeichert");
  const rows = (await q(p, ".tlrow").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim());
  check(rows.some(t => /^22:00 Abschließen/.test(t)) && rows.some(t => /^22:30 Schluss geändert von Test Anna: letzte Buchung/.test(t)), "Flexibel: Abschließen zieht mit – " + rows.join(" | "));

  // Leitung: Aufgabe mit Enter, kein Doppel
  await q(p, '[data-view="admin"]').click(); await q(p, "#pin-in").fill("1234"); await q(p, "#pinform button[type=submit]").click(); await step(800);
  await q(p, '[data-act2="open-plan"]').click(); await step();
  await q(p, "[data-edadd]").first().click(); await q(p, "#ed-new").fill("Testaufgabe"); await q(p, "#ed-new").press("Enter"); await step(300);
  await q(p, "#ed-new").press("Enter"); await step(300);
  const n = await p.evaluate(() => JSON.parse(localStorage.getItem("rz2cfg")).master.plan.frueh.phases.flatMap(x => x.items).filter(i => i.t === "Testaufgabe").length);
  check(await q(p, ".edlist li").filter({ hasText: "Testaufgabe" }).count() === 1 && n === 1 && await q(p, "#ed-new").inputValue() === "", "Aufgaben-Plan: Enter zeigt Aufgabe, leert Feld, kein Doppel");

  // Aufgaben-Fenster: Eingaben überleben PIN-Sperre
  await q(p, "[data-editem]").first().click(); await q(p, "#ep-t").fill("Geändert"); await q(p, "#ep-imp").check();
  for (let i = 0; i < 9; i++) { await p.clock.runFor(60000); await q(p, "#ep-s").type("x"); }
  await step(120000);
  check(await q(p, "#edpop").count() === 1, "Leitung: Tippen hält die Sperre fern");
  await p.clock.runFor(11 * 60000); await q(p, "#edpop button[type=submit]").click(); await step(400);
  await q(p, "#pin-in").fill("1234"); await q(p, "#pinform button[type=submit]").click(); await step(800);
  check(await q(p, "#ep-t").inputValue().catch(() => "") === "Geändert" && await q(p, "#ep-imp").isChecked().catch(() => false), "Leitung: Eingaben überleben die PIN-Abfrage");
  await q(p, "#edpop button[type=submit]").click(); await step(300);

  // Abschnitt: Bezug wählen (nach Beginn → vor Schluss), Uhrzeiten rechnen sich aus dem Schluss
  await q(p, "[data-edphase]").first().click(); await step();
  check(await q(p, "#ep-p-anc").inputValue() === "s" && await q(p, ".edpop .tgrid").isHidden(), "Editor: vorderer Abschnitt hängt an Beginn");
  await q(p, "#ep-p-anc").selectOption("t"); await step();
  check(await q(p, ".edpop .tgrid").isVisible(), "Editor: feste Uhrzeit zeigt Zeitfelder");
  await q(p, "#ep-p-anc").selectOption("e"); await q(p, "#ep-a").selectOption("90"); await q(p, "#ep-b").selectOption("30"); await q(p, "#ep-t").press("Enter"); await step(300);
  const ph = await p.evaluate(() => JSON.parse(localStorage.getItem("rz2cfg")).master.plan.frueh.phases.find(x => x.anc === "e" && x.a === 90));
  check(ph && ph.b === 30 && ph.from === "14:00" && ph.to === "15:00" && await q(p, ".edtoggle").filter({ hasText: "1,5–0,5 Std. vor Schluss" }).count() === 1, "Editor: vor Schluss 1,5–0,5 Std. gespeichert");

  // Sonnenuntergang als Bezug: Abschnitt (30 Min. vorher bis 15 Min. danach) und Aufgaben-Erinnerung (zum Sonnenuntergang)
  await q(p, "[data-edphase]").nth(1).click(); await step();
  await q(p, "#ep-p-anc").selectOption("u"); await step();
  await q(p, "#ep-ua").selectOption("30"); await q(p, "#ep-uad").selectOption("vor"); await q(p, "#ep-ub").selectOption("60"); await q(p, "#ep-ubd").selectOption("nach");
  await q(p, "#edpop button[type=submit]").click(); await step(300);
  const su = await p.evaluate(() => JSON.parse(localStorage.getItem("rz2cfg")).master.plan.frueh.phases.find(x => x.anc === "u"));
  check(su && su.a === -30 && su.b === 60 && await q(p, ".edtoggle").filter({ hasText: "0,5 Std. vor Sonnenuntergang" }).count() === 1, "Editor: Abschnitt am Sonnenuntergang");
  await q(p, "[data-edopen]").first().click(); await step();
  await q(p, "[data-editem]").first().click(); await step();
  await q(p, "#ep-rem").check(); await q(p, "#ep-r-anc").selectOption("u"); await q(p, "#ep-r-um").fill("0");
  await q(p, "#edpop button[type=submit]").click(); await step(300);
  const ri = await p.evaluate(() => JSON.parse(localStorage.getItem("rz2cfg")).master.plan.frueh.phases.flatMap(x => x.items).find(i => i.ra === "u"));
  check(ri && ri.rm === 0 && await q(p, ".badge.rem").filter({ hasText: "zum Sonnenuntergang" }).count() >= 1, "Editor: Erinnerung zum Sonnenuntergang");

  // Abschnitt in die andere Schicht verschieben (und zurück), Abschnitt ausblenden
  const master = () => p.evaluate(() => JSON.parse(localStorage.getItem("rz2cfg")).master.plan);
  await q(p, '[data-edphase="orga"]').click(); await step(); await q(p, "#ep-shift").selectOption("spaet"); await q(p, "#ep-t").press("Enter"); await step(300);
  let mp = await master();
  const movedOk = mp.spaet.phases.some(x => x.id === "orga") && !mp.frueh.phases.some(x => x.id === "orga") && mp.spaet.phases.find(x => x.id === "orga").items.length === 2;
  await q(p, '[data-edshift="spaet"]').click(); await step();
  await q(p, '[data-edphase="orga"]').click(); await step(); await q(p, "#ep-shift").selectOption("frueh"); await q(p, "#ep-t").press("Enter"); await step(300);
  mp = await master();
  check(movedOk && mp.frueh.phases.some(x => x.id === "orga") && !mp.spaet.phases.some(x => x.id === "orga"), "Editor: Abschnitt Früh → Spät und zurück, Aufgaben bleiben");
  await q(p, '[data-edphase="plaetze"]').click(); await step(); await q(p, "#ep-off").check(); await q(p, "#ep-t").press("Enter"); await step(300);
  mp = await master();
  check(mp.spaet.phases.find(x => x.id === "plaetze").off === true && await q(p, ".edphase.off").count() === 1, "Editor: Abschnitt ausgeblendet (bleibt im Plan)");
  await q(p, '[data-edshift="frueh"]').click(); await step();

  // Team: Enter legt an, Feld wird leer
  await q(p, '[data-view="admin"]').click(); await step();
  await q(p, '[data-adminpop="team"]').click(); await q(p, "#newperson").fill("Test Ben"); await q(p, "#newperson").press("Enter"); await step(300);
  check(await p.evaluate(() => localStorage.getItem("rz2cfg").includes("Test Ben")) && await q(p, "#newperson").inputValue() === "", "Team: Enter legt an und leert das Feld");
  await q(p, "[data-adminpop-close]").click(); await step();

  // Monatsstatistik → Tag → „Zurück zur Monatsstatistik“
  const closePops = async () => { for (let i = 0; i < 6 && await q(p, "#remind .overlay").count(); i++) { await q(p, "#remind button").last().click(); await step(200); } };
  await closePops();
  await q(p, '[data-act2="open-month"]').click(); await step(300); await closePops();
  await q(p, ".mcell").first().click(); await step(300);
  const hasBack = await q(p, ".backbar [data-backto]").count() === 1;
  await q(p, "[data-backto]").click(); await step(300);
  check(hasBack && await q(p, "#mprev").count() === 1, "Statistik: Tag öffnen und mit einem Klick zurück");
  if (await q(p, "#today").isVisible()) { await q(p, "#today").click(); await step(); }
  await q(p, '[data-view="admin"]').click(); await step();

  // Arbeitszeiten: Enter im Korrektur-Fenster speichert
  await q(p, '[data-act2="open-times"]').click(); await step(300);
  await q(p, '[data-act2="t-add"]').click(); await q(p, "#te-note").fill("per Enter"); await q(p, "#te-note").press("Enter"); await step(300);
  check(await q(p, "#teform").count() === 0, "Arbeitszeiten: Enter speichert und schließt");

  // Puffer: Schichtstart (ca. 16:00–16:30) wird erst 15 Min. nach dem Ende rot
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("rz2:2026-11-24")); d.rem = {}; localStorage.setItem("rz2:2026-11-24", JSON.stringify(d)); });
  while (await q(p, "#remind [data-stillok], #remind [data-hlater]").count()) { await q(p, "#remind [data-stillok], #remind [data-hlater]").first().click(); await step(); }
  await q(p, '[data-view="schicht"]').click(); await step();
  check(await q(p, ".tllater").filter({ hasText: "Plätze" }).count() === 0 && await q(p, ".tllater").filter({ hasText: "Abbau" }).count() === 1, "Tagesablauf: ausgeblendeter Abschnitt erscheint nicht");
  const tsegState = async () => (await p.locator("#rz-host .tlrow").filter({ has: p.locator("#phase-start") }).getAttribute("class")) || "";
  const nowMs = await p.evaluate(() => Date.now()), at = (h, m) => new Date(2026, 10, 24, h, m).getTime() - nowMs;
  // Farben: grün solange Zeit ist, orange ab 15 Min. vor Ende (knapp) bis zum Puffer, dann rot
  await p.clock.runFor(Math.max(0, at(16, 40))); await step(300);
  const s1 = await tsegState();
  await p.clock.runFor(6 * 60000); await step(300);
  check(/is-soon/.test(s1), "Farbe: knapp orange – " + s1);
  check(/is-late/.test(await tsegState()), "Puffer: rot erst 15 Min. nach der Zeit");
  // Erledigtes klappt zusammen: Schichtstart abhaken → eine grüne Zeile, aufklappen zeigt ihn klein
  for (let i = 0; i < 5 && await q(p, "#remind .overlay").count(); i++) { await q(p, "#remind button").last().click(); await step(200); }
  await q(p, "#phase-start .items button").first().click(); await step(300);
  const dn = await q(p, ".tldone").innerText().catch(() => "");
  await q(p, ".tldone").click().catch(() => {}); await step(200);
  check(/^✓ 1 Abschnitt erledigt/.test(dn) && !/Erinnerung/.test(dn) && await q(p, ".tllane .tlrchip.own.done").count() === 0 && await q(p, "#phase-start").count() === 0 && await q(p, ".tlsmall").filter({ hasText: "Schichtstart" }).count() === 1, "Tagesablauf: Erledigtes zusammengeklappt – " + dn);
  await q(p, ".tlrdone").click(); await step(200);
  const nd = await q(p, ".tllane .tlrchip.own.done").count();
  await q(p, ".tlrdone").click(); await step(200);
  check(nd >= 1 && await q(p, ".tllane .tlrchip.own.done").count() === 0, "Erinnerung: erledigte nur nach Klick auf „erledigte“ sichtbar");

  // Dicht beieinander liegende Erinnerungen: nur eine sichtbare Glocke/Linie mit Anzahl (ab 1.27.1)
  { const vis = await p.evaluate(() => { const tl = document.querySelector("#rz-host").shadowRoot.querySelector(".tl"); const b = [...tl.querySelectorAll(".tlbell")].filter(x => !x.hidden).map(x => parseFloat(x.style.top)).sort((a, c) => a - c); return b.every((y, i) => !i || y - b[i - 1] >= 18) && [...tl.querySelectorAll(".tlconn")].filter(x => !x.hidden).length === b.length; });
    check(vis, "Erinnerungen: dicht beieinander nur eine Glocke und eine Linie"); }
  // Heute ohne rechte Spalte (ab 1.27): Rundgänge im Erinnerungs-Bereich, Pflicht vor Schluss, Übergabe unten rechts
  check(await q(p, "#side-next").count() === 0 && await q(p, ".hdock [data-noteedit]").count() === 1 && await q(p, "#pinbar .pin").count() >= 1 && await q(p, "#tl-confirm").count() === 0, "Heute: keine rechte Spalte, Pflicht als Leiste oben, Übergabe unten rechts");
  const pin0 = q(p, "#pinbar .pin.open .pintap, #pinbar .pin.soon .pintap").first();
  if (await pin0.count()) { await pin0.click(); await step(200); const okN = await q(p, "#pinbar .pin.ok").count(); await q(p, "#pinbar .pin.ok .pintap").first().click(); await step(200);
    check(okN >= 1 && await q(p, "#pinbar .pin.ok").count() === okN - 1 && await q(p, "#pinbar .pinundo").count() === 0, "Heute: Pflicht in der Leiste bestätigen und per Haken zurücknehmen"); }
  const rh0 = q(p, ".tlrchip.rh").first();
  if (await rh0.count()) {
    const name = (await rh0.innerText()).replace(/^\S+\s*/, "").slice(0, 12), at0 = +(await rh0.getAttribute("data-at"));
    await rh0.locator("[data-log]").click(); await step(200);
    const rh1 = q(p, ".tlrchip.rh").filter({ hasText: name });
    check(await rh1.count() === 0 || +(await rh1.first().getAttribute("data-at")) > at0, "Heute: Rundgang abhaken rückt den nächsten Termin nach");
  } else check(false, "Heute: Rundgang-Karte im Erinnerungs-Bereich fehlt");

  // Kopfzeile ab 1.26: Datum unter der Uhr öffnet den eigenen Kalender direkt darunter, anderer Tag = orange mit ↩ Heute
  check(/^\w+, \d\d\.\d\d\.$/.test(await q(p, "#datelabel").innerText()) && await q(p, "#dnmore").isHidden(), "Kopf: Datum mit Wochentag, heute ohne Pfeile");
  await q(p, "#datebtn").click(); await step(100);
  const db = await q(p, "#datebtn").boundingBox(), cb = await q(p, "#calpop").boundingBox();
  check(cb && cb.y >= db.y + db.height - 8 && cb.y < db.y + db.height + 30 && Math.abs(cb.x - db.x) < 40, "Kopf: Kalender öffnet direkt unter dem Datum");
  await q(p, '#calpop [data-calday]').filter({ hasText: /^20$/ }).click(); await step(200);
  check((await q(p, "#datelabel").innerText()).includes("20.11.") && await q(p, "#dnmore").isVisible() && /otherday/.test(await q(p, "header.top").getAttribute("class")) && await q(p, "#calpop").isHidden(), "Kopf: anderer Tag orange mit Pfeilen");
  await q(p, "#today").click(); await step(200);
  check(await q(p, "#dnmore").isHidden() && !(await q(p, "#datelabel").innerText()).includes("20.11."), "Kopf: ↩ Heute zurück");
  await q(p, "#datebtn").click(); await step(100); await p.keyboard.press("Escape"); await step(100);
  check(await q(p, "#calpop").isHidden(), "Kopf: Esc schließt den Kalender");

  // Schriftgröße stufenlos: Regler 130 % vergrößert die Ansicht, Trennlinie ziehen rechnet in CSS-Pixeln, 100 % setzt zurück
  const zf = () => p.evaluate(() => getComputedStyle(document.querySelector("#rz-host").shadowRoot.querySelector(".wrap")).zoom);
  await q(p, "#fontbtn").click(); await step(200);
  check(await q(p, "#fontpop").isVisible(), "Schrift: Fenster mit Regler öffnet");
  await q(p, "#fzrange").fill("130"); await step(200);
  const lay130 = await p.evaluate(() => JSON.parse(localStorage.getItem("rz2layout")));
  check(String(await zf()) === "1.3" && Object.values(lay130).some(l => l.fz === 130) && (await q(p, "#fzval").innerText()) === "130 %", "Schrift: 130 % gespeichert und angewendet – " + await zf());
  await q(p, '#fontpop [data-fzstep="5"]').click(); await step(100);
  check((await q(p, "#fzval").innerText()) === "135 %", "Schrift: A+ geht 5 % weiter");
  await p.keyboard.press("Escape"); await step(100);
  check(!(await q(p, "#fontpop").isVisible()), "Schrift: Escape schließt das Fenster");
  const spl = q(p, '.tlsplit[data-split="remw"]');
  if (await spl.count()) {
    const bb = await spl.boundingBox();
    const tx = bb.x + bb.width / 2 + 120;
    await p.mouse.move(bb.x + bb.width / 2, bb.y + 40); await p.mouse.down(); await p.mouse.move(tx, bb.y + 40, { steps: 4 }); await p.mouse.up(); await step(200);
    const nb = await q(p, '.tlsplit[data-split="remw"]').boundingBox();
    check(Math.abs(nb.x + nb.width / 2 - tx) <= 14, `Schrift: Trennlinie bei 135 % bleibt unter der Maus (${Math.round(nb.x + nb.width / 2)} / ${Math.round(tx)})`);
  }
  await q(p, "#fontbtn").click(); await step(100); await q(p, "#fzreset").click(); await step(100);
  check(String(await zf()) === "1", "Schrift: „Zurück auf 100 %“");
  await p.mouse.click(5, 5); await step(100);
  check(!(await q(p, "#fontpop").isVisible()), "Schrift: Klick daneben schließt das Fenster");

  check(!errs.length, "keine Skriptfehler" + (errs.length ? ": " + errs.join(" | ") : ""));
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
});
