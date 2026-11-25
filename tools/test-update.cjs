// Prüft das Format der Update-Dateien (mac/update-format.js): gültig, verändert, fremder Schlüssel, falsche Dateien, Version.
// Aufruf: node tools/test-update.cjs   (ohne Schlüssel – erzeugt für den Test ein Wegwerf-Schlüsselpaar)
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs"), path = require("node:path");
const upd = require("../mac/update-format.js");
let fails = 0;
const check = (ok, name) => { console.log(`${ok ? "ok  " : "FEHLER"} ${name}`); if (!ok) fails++; };
const pair = () => { const k = crypto.generateKeyPairSync("ed25519"); return { priv: k.privateKey.export({ type: "pkcs8", format: "pem" }), pub: k.publicKey.export({ type: "spki", format: "pem" }) }; };
const k1 = pair(), k2 = pair();
const files = { "index.html": Buffer.from("<!doctype html><p>neu</p>"), "checkin.html": Buffer.from("<!doctype html>") };

const text = upd.create({ version: "1.21.1", files }, k1.priv);
const r = upd.verify(text, k1.pub);
check(r.ok && r.version === "1.21.1" && r.files["index.html"].toString() === "<!doctype html><p>neu</p>", "gültige Datei wird angenommen");
const t = JSON.parse(text); t.files["index.html"] = Buffer.from("<p>böse</p>").toString("base64");
check(!upd.verify(JSON.stringify(t), k1.pub).ok, "veränderter Inhalt wird abgelehnt");
const v = JSON.parse(text); v.version = "9.9.9";
check(!upd.verify(JSON.stringify(v), k1.pub).ok, "veränderte Version wird abgelehnt");
check(!upd.verify(text, k2.pub).ok, "fremder Schlüssel wird abgelehnt");
check(!upd.verify("{}", k1.pub).ok && !upd.verify("kein json", k1.pub).ok, "Unsinn wird abgelehnt");
let threw = false; try { upd.create({ version: "1.21.1", files: { "main.js": Buffer.from("x") } }, k1.priv); } catch { threw = true; }
check(threw, "nur index.html/checkin.html erlaubt");
check(!upd.verify(upd.create({ version: "1.21.1", minShell: upd.SHELL + 1, files }, k1.priv), k1.pub).ok, "Update für neuere Hülle wird abgelehnt");
check(upd.cmpVersion("1.21.0", "1.20.9") > 0 && upd.cmpVersion("1.9.0", "1.10.0") < 0 && upd.cmpVersion("1.2.3", "1.2.3") === 0, "Versionsvergleich");
const pubInMain = fs.readFileSync(path.join(__dirname, "../mac/main.js"), "utf8").match(/UPDATE_PUBKEY = "([^"]+)"/);
check(!!pubInMain && crypto.createPublicKey(pubInMain[1].replace(/\\n/g, "\n")).asymmetricKeyType === "ed25519", "öffentlicher Schlüssel in main.js lesbar");
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(fails ? 1 : 0);
