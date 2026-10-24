// Erzeugt aus app/app.js + app/app.css:
//   index.html                                   – eigenständige Seite (Mac lokal, claude.ai-Artifact)
//   sharepoint/src/webparts/rezeption/app.gen.ts – Modul für das SharePoint-Webpart (falls das Projekt existiert)
// Aufruf: node tools/build.mjs
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const css = readFileSync(join(repo, "app/app.css"), "utf8");
const js = readFileSync(join(repo, "app/app.js"), "utf8");

if (!/export function mount\(/.test(js) || !/export function createSpDb\(/.test(js)) {
  throw new Error("app/app.js muss mount() und createSpDb() exportieren");
}
// Inline-Skript darf kein "</script" enthalten.
if (/<\/script/i.test(js) || /<\/style/i.test(css)) throw new Error("app enthält </script> oder </style>");

const plainJs = js.replace(/^export function /gm, "function ");

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Rezeption Schichtcheck</title>
<!-- GENERIERT von tools/build.mjs aus app/app.js und app/app.css – nicht direkt bearbeiten. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap">
<style>
html, body { margin: 0; background: #eef2f6 }
@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) body { background: #0f1620 } }
html[data-theme="dark"] body { background: #0f1620 }
#rz-host { display: block }
</style>
<div id="rz-host"></div>
<script>
(() => {
"use strict";
const APP_CSS = ${JSON.stringify(css)};
${plainJs}
const host = document.getElementById("rz-host");
const root = host.attachShadow({ mode: "open" });
const style = document.createElement("style");
style.textContent = APP_CSS;
root.appendChild(style);
const container = document.createElement("div");
container.className = "rz-root";
root.appendChild(container);
mount(container, { root, mode: "auto", fitViewport: true, standalone: true, checkinUrl: "checkin.html" });
})();
</script>
`;
writeFileSync(join(repo, "index.html"), html);
console.log("index.html geschrieben (" + html.length + " Zeichen)");
// Check-in-Erstattung: eigene Seite neben index.html (Reiter „Erstattung“ lädt sie im iframe).
copyFileSync(join(repo, "app/checkin.html"), join(repo, "checkin.html"));
console.log("checkin.html kopiert");
// pdf.js für die Webversion (claude.ai lädt fremde Skripte nicht zuverlässig): Kopie in pdfjs/ neben index.html.
// Rohe Steuerzeichen (nur in String-/Regex-Literalen) werden zu \uXXXX – gleiche Bedeutung, aber veröffentlichbar.
const pdfSrc = join(repo, "mac/node_modules/pdfjs-dist/build");
if (existsSync(pdfSrc)) {
  mkdirSync(join(repo, "pdfjs"), { recursive: true });
  for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
    const txt = readFileSync(join(pdfSrc, f), "utf8").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
    writeFileSync(join(repo, "pdfjs", f), txt);
  }
  console.log("pdfjs/ geschrieben");
} else console.log("pdfjs-dist fehlt (cd mac && npm install) – pdfjs/ übersprungen");

const spDir = join(repo, "sharepoint/src/webparts/rezeption");
if (existsSync(spDir)) {
  const ts = `/* eslint-disable */
// @ts-nocheck
// GENERIERT von tools/build.mjs aus app/app.js und app/app.css – nicht direkt bearbeiten.
export const APP_CSS: string = ${JSON.stringify(css)};
${js}`;
  writeFileSync(join(spDir, "app.gen.ts"), ts);
  console.log("sharepoint/src/webparts/rezeption/app.gen.ts geschrieben");
} else {
  console.log("SharePoint-Projekt nicht gefunden – app.gen.ts übersprungen");
}
