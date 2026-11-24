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
  check(await q(p, "#rempop").count() === 0 && await q(p, "li.ownrem").count() === 1, "Erinnerung: Speichern trotz Neuzeichnen");
  await q(p, "[data-remadd]").click(); await q(p, "#rp-t").fill("Zweite"); await q(p, "#rp-t").press("Enter"); await step(300);
  check(await q(p, "#rempop").count() === 0 && await q(p, "li.ownrem").count() === 2, "Erinnerung: Enter speichert und schließt");

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

  // Team: Enter legt an, Feld wird leer
  await q(p, '[data-view="admin"]').click(); await step();
  await q(p, '[data-adminpop="team"]').click(); await q(p, "#newperson").fill("Test Ben"); await q(p, "#newperson").press("Enter"); await step(300);
  check(await p.evaluate(() => localStorage.getItem("rz2cfg").includes("Test Ben")) && await q(p, "#newperson").inputValue() === "", "Team: Enter legt an und leert das Feld");
  await q(p, "[data-adminpop-close]").click(); await step();

  // Arbeitszeiten: Enter im Korrektur-Fenster speichert
  await q(p, '[data-act2="open-times"]').click(); await step(300);
  await q(p, '[data-act2="t-add"]').click(); await q(p, "#te-note").fill("per Enter"); await q(p, "#te-note").press("Enter"); await step(300);
  check(await q(p, "#teform").count() === 0, "Arbeitszeiten: Enter speichert und schließt");

  check(!errs.length, "keine Skriptfehler" + (errs.length ? ": " + errs.join(" | ") : ""));
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
});
