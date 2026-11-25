// Update-Dateien (.rzupdate) für die Mac-App: neue Programm-Dateien ohne Neuinstallation.
// Aufbau (JSON): { format, v, version, minShell, created, files: { "index.html": <base64>, … }, sig: <base64> }
// sig = Ed25519 über digest() – nur Dateien mit gültiger Unterschrift des Update-Schlüssels werden geladen.
// Genutzt von main.js (prüfen) und tools/make-update.mjs (erzeugen).
"use strict";
const crypto = require("node:crypto");

const FORMAT = "rezeption-update";
// Dateien, die ein Update ersetzen darf. Alles andere (pdf.js, SheetJS, Lizenztexte) kommt aus der installierten App.
const FILES = ["index.html", "checkin.html"];
// Stand der Hülle (main.js/preload.js). Hochzählen, wenn die Seite eine neue Funktion der Hülle braucht;
// Updates mit höherem minShell lehnt eine ältere Hülle ab (dann einmal neu installieren).
const SHELL = 1;
const MAX_BYTES = 30 * 1024 * 1024;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function digest(u) {
  return Buffer.from(JSON.stringify([FORMAT, u.v, u.version, u.minShell, Object.keys(u.files).sort().map((k) => [k, sha(u.files[k])])]), "utf8");
}
// Versionen vergleichen: <0 älter, 0 gleich, >0 neuer.
function cmpVersion(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
// Prüft Text einer .rzupdate-Datei. Ergebnis: { ok: true, version, minShell, files: { name: Buffer } } oder { ok: false, error }.
function verify(text, publicKeyPem) {
  try {
    if (typeof text !== "string" || text.length > MAX_BYTES) return { ok: false, error: "Datei zu groß oder ungültig" };
    let u;
    try { u = JSON.parse(text); } catch { return { ok: false, error: "Keine Update-Datei (kein gültiges JSON)" }; }
    if (!u || u.format !== FORMAT || u.v !== 1) return { ok: false, error: "Keine Update-Datei der Rezeption" };
    if (!VERSION_RE.test(u.version || "")) return { ok: false, error: "Update ohne gültige Versionsnummer" };
    if (!Number.isInteger(u.minShell) || u.minShell < 1) return { ok: false, error: "Update unvollständig" };
    if (!u.files || typeof u.files !== "object" || !u.files["index.html"]) return { ok: false, error: "Update enthält keine App" };
    for (const [k, b64] of Object.entries(u.files)) {
      if (!FILES.includes(k) || typeof b64 !== "string" || !/^[A-Za-z0-9+/=]+$/.test(b64)) return { ok: false, error: "Update enthält unerlaubte Dateien" };
    }
    if (typeof u.sig !== "string") return { ok: false, error: "Update ist nicht unterschrieben" };
    const good = crypto.verify(null, digest(u), crypto.createPublicKey(publicKeyPem), Buffer.from(u.sig, "base64"));
    if (!good) return { ok: false, error: "Unterschrift ungültig – Datei verändert oder nicht vom Entwickler" };
    if (u.minShell > SHELL) return { ok: false, error: `Dieses Update braucht eine neuere Mac-App – bitte die App einmal neu installieren (Version ${u.version}).` };
    const files = {};
    for (const [k, b64] of Object.entries(u.files)) files[k] = Buffer.from(b64, "base64");
    return { ok: true, version: u.version, minShell: u.minShell, created: typeof u.created === "string" ? u.created : null, files };
  } catch (err) {
    return { ok: false, error: "Update konnte nicht geprüft werden: " + String((err && err.message) || err) };
  }
}
// Erzeugt eine unterschriebene Update-Datei (Text). files = { name: Buffer }.
function create({ version, minShell = SHELL, files }, privateKeyPem) {
  if (!VERSION_RE.test(version)) throw new Error("Ungültige Version: " + version);
  const enc = {};
  for (const k of Object.keys(files).sort()) {
    if (!FILES.includes(k)) throw new Error("Nicht erlaubt im Update: " + k);
    enc[k] = Buffer.from(files[k]).toString("base64");
  }
  const u = { format: FORMAT, v: 1, version, minShell, created: new Date().toISOString(), files: enc };
  u.sig = crypto.sign(null, digest(u), crypto.createPrivateKey(privateKeyPem)).toString("base64");
  return JSON.stringify(u);
}

module.exports = { FORMAT, FILES, SHELL, cmpVersion, verify, create };
