// Erzeugt eine unterschriebene Update-Datei für die Mac-App (Verwaltung › App-Update › Update-Datei einspielen).
// Aufruf: RZ_UPDATE_KEY=/pfad/rezeption-update-key.pem node tools/make-update.mjs
// Ergebnis: mac/dist/Rezeption-<version>.rzupdate (Version aus mac/package.json, nicht committet).
// Enthält nur index.html und checkin.html; Hülle, pdf.js und SheetJS kommen aus der installierten App.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const upd = require(join(repo, "mac/update-format.js"));

const keyPath = process.env.RZ_UPDATE_KEY || process.argv[2];
if (!keyPath || !existsSync(keyPath)) {
  console.error("Privater Update-Schlüssel fehlt: RZ_UPDATE_KEY=/pfad/rezeption-update-key.pem setzen.");
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(join(repo, "mac/package.json"), "utf8"));

execFileSync(process.execPath, [join(repo, "tools/build.mjs")], { stdio: "inherit" });
const files = { "index.html": readFileSync(join(repo, "index.html")), "checkin.html": readFileSync(join(repo, "checkin.html")) };
const text = upd.create({ version, files }, readFileSync(keyPath, "utf8"));

// Gegenprobe mit dem öffentlichen Schlüssel aus main.js – sonst würde die App die Datei ablehnen.
const pub = readFileSync(join(repo, "mac/main.js"), "utf8").match(/UPDATE_PUBKEY = "([^"]+)"/);
if (!pub) { console.error("UPDATE_PUBKEY in mac/main.js nicht gefunden"); process.exit(1); }
const check = upd.verify(text, pub[1].replace(/\\n/g, "\n"));
if (!check.ok) { console.error("Gegenprobe fehlgeschlagen:", check.error, "– passt der Schlüssel zu UPDATE_PUBKEY?"); process.exit(1); }

const out = join(repo, "mac/dist", `Rezeption-${version}.rzupdate`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(`fertig: ${out} (${(text.length / 1024 / 1024).toFixed(1)} MB, Version ${version})`);
