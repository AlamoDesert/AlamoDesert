// Erzeugt aus app/app.js + app/app.css:
//   index.html                                   – eigenständige Seite (Mac lokal, claude.ai-Artifact), Schriften eingebettet
//   checkin.html                                 – Check-ins aus app/checkin.html, Schriften eingebettet
//   pdfjs/, vendor/                              – pdf.js und SheetJS als lokale Kopie für die Webversion (nicht committet)
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

// Schriften (Barlow, Barlow Condensed; SIL Open Font License 1.1, Lizenztexte in app/fonts/) als data:-URI eingebettet:
// keine Abrufe bei Google, und die Webversion (claude.ai lädt Stylesheets nur von Google Fonts) braucht keine Zusatzdateien.
// @font-face muss im Dokument stehen, nicht im Shadow-Root – dort ignorieren Browser es.
const FONTS = [
  ["Barlow", 400, "barlow-latin-400-normal.woff2"],
  ["Barlow", 500, "barlow-latin-500-normal.woff2"],
  ["Barlow", 600, "barlow-latin-600-normal.woff2"],
  ["Barlow Condensed", 600, "barlow-condensed-latin-600-normal.woff2"],
  ["Barlow Condensed", 700, "barlow-condensed-latin-700-normal.woff2"],
];
const fontCss = "/* Barlow, Barlow Condensed – Copyright 2017 The Barlow Project Authors (https://github.com/jpt/barlow), SIL Open Font License 1.1 (https://openfontlicense.org) */\n" +
  FONTS.map(([family, weight, file]) => {
    const b64 = readFileSync(join(repo, "app/fonts", file)).toString("base64");
    return `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url(data:font/woff2;base64,${b64}) format("woff2") }`;
  }).join("\n");

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Rezeption Schichtcheck</title>
<!-- GENERIERT von tools/build.mjs aus app/app.js und app/app.css – nicht direkt bearbeiten. -->
<style>
${fontCss}
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
// Check-in-Erstattung: eigene Seite neben index.html (Reiter „Check-ins“ lädt sie im iframe), Schriften eingesetzt.
const FONT_MARK = /^<!-- RZ-FONTS:.*-->$/m;
const checkinSrc = readFileSync(join(repo, "app/checkin.html"), "utf8");
if (!FONT_MARK.test(checkinSrc)) throw new Error("app/checkin.html: Markierung <!-- RZ-FONTS: … --> fehlt");
writeFileSync(join(repo, "checkin.html"), checkinSrc.replace(FONT_MARK, () => `<style>\n${fontCss}\n</style>`));
console.log("checkin.html geschrieben (Schriften eingebettet)");
// SheetJS für die Check-ins: lokale Kopie in vendor/ neben checkin.html (Webversion veröffentlicht sie mit; nicht committet).
const xlsxSrc = join(repo, "mac/node_modules/xlsx/dist/xlsx.full.min.js");
if (existsSync(xlsxSrc)) {
  mkdirSync(join(repo, "vendor"), { recursive: true });
  copyFileSync(xlsxSrc, join(repo, "vendor/xlsx.full.min.js"));
  console.log("vendor/xlsx.full.min.js geschrieben");
} else console.log("xlsx fehlt (cd mac && npm install) – vendor/ übersprungen");
// pdf.js für die Webversion (claude.ai lädt fremde Skripte nicht zuverlässig): Kopie in pdfjs/ neben index.html.
// Rohe Steuerzeichen (nur in String-/Regex-Literalen) werden zu \uXXXX – gleiche Bedeutung, aber veröffentlichbar.
// Legacy-Fassung: läuft auch in älterem Safari (iPad < iPadOS 17.4 kennt z. B. Promise.withResolvers nicht).
const pdfSrc = join(repo, "mac/node_modules/pdfjs-dist/legacy/build");
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
