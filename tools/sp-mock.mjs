// Nachbau der SharePoint-REST-Endpunkte, die createSpDb() nutzt – zum Testen ohne echten SharePoint.
// Start: node tools/sp-mock.mjs [port]   →   http://localhost:<port>/sites/rez/test.html
// Website: /sites/rez. Speicher nur im Arbeitsspeicher.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || 8899);
const WEB = "/sites/rez";
const DIGEST = "mock-digest";
const lists = new Map();   // Titel -> RootFolder-URL
const folders = new Set();
const files = new Map();   // URL -> { body, v }
let failNext = 0;           // Test-Hilfe: nächste n Schreibzugriffe mit 503 beantworten

const etag = (url, v) => `"{${Buffer.from(url).toString("hex").slice(-12)}},${v}"`;
// Liest Name='Wert' bzw. Funktion('Wert') aus einer REST-Adresse.
const arg = (s, name) => { const m = s.match(new RegExp(name + (name.endsWith("\\(") ? "" : "=") + "'((?:[^']|'')*)'", "i")); return m ? m[1].replace(/''/g, "'") : null; };
const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c).toString("utf8"))); });

createServer(async (req, res) => {
  const raw = req.url;
  const path = decodeURIComponent(raw.split("?")[0]);
  const body = await readBody(req);
  const isWrite = req.method === "POST" && !/contextinfo$/.test(path);
  if (isWrite && req.headers["x-requestdigest"] !== DIGEST) return send(res, 403, { error: "digest" });
  if (isWrite && failNext > 0) { failNext--; return send(res, 503, { error: "test" }); }

  if (path === "/__fail") { failNext = Number(new URL(raw, "http://x").searchParams.get("n") || 1); return send(res, 200, { ok: true }); }
  if (path === "/__dump") return send(res, 200, { lists: [...lists], folders: [...folders], files: [...files].map(([k, v]) => [k, v.v, v.body.length]) });
  if (path === WEB + "/test.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SharePoint-Test</title><style>body{margin:0;font-family:system-ui} .sp-bar{height:48px;background:#03787c;color:#fff;display:flex;align-items:center;padding:0 16px}</style>
<div class="sp-bar">SharePoint (Testnachbau)</div><div id="wp"></div>
<script type="module">
import { mount } from "/app.js";
const css = await (await fetch("/app.css")).text();
const host = document.getElementById("wp");
const root = host.attachShadow({ mode: "open" });
const st = document.createElement("style"); st.textContent = css; root.appendChild(st);
const c = document.createElement("div"); c.className = "rz-root"; root.appendChild(c);
window.__unmount = mount(c, { root, mode: "sharepoint", webAbsoluteUrl: location.origin + "${WEB}", webServerRelativeUrl: "${WEB}", library: "RezeptionDaten", pollMs: 1000, fitViewport: true${process.env.PDFJS_DIR ? ', pdfjsUrl: location.origin + "/pdfjs/pdf.min.mjs"' : ""} });
</script>`);
  }
  // Optional: pdf.js lokal ausliefern (PDFJS_DIR=…/pdfjs-dist/build), sonst lädt die App es vom CDN.
  if (path.startsWith("/pdfjs/") && process.env.PDFJS_DIR) {
    try { res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }); return res.end(readFileSync(join(process.env.PDFJS_DIR, path.slice(7).replace(/\.\./g, "")))); }
    catch { return send(res, 404, { error: "pdfjs" }); }
  }
  if (path === "/app.js" || path === "/app.css") {
    res.writeHead(200, { "Content-Type": path.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8" });
    return res.end(readFileSync(join(repo, "app", path.slice(1))));
  }
  if (!path.startsWith(WEB + "/_api/")) return send(res, 404, { error: "not found" });
  const api = path.slice((WEB + "/_api/").length);

  if (api === "contextinfo" && req.method === "POST") return send(res, 200, { FormDigestValue: DIGEST, FormDigestTimeoutSeconds: 1800 });
  if (/^web\/lists\/GetByTitle\(/i.test(api) && req.method === "GET") {
    const t = arg(api, "GetByTitle\\(");
    if (!lists.has(t)) return send(res, 404, { error: "list" });
    return send(res, 200, { Id: "1", RootFolder: { ServerRelativeUrl: lists.get(t) } });
  }
  if (api === "web/lists" && req.method === "POST") {
    const j = JSON.parse(body || "{}");
    const url = `${WEB}/${j.Title}`;
    lists.set(j.Title, url); folders.add(url);
    return send(res, 201, { d: { Title: j.Title } });
  }
  if (/^web\/folders\/(AddUsingPath|add)\(/i.test(api) && req.method === "POST") {
    const u = arg(api, "DecodedUrl") || arg(api, "add\\(");
    const parent = u.slice(0, u.lastIndexOf("/"));
    if (!folders.has(parent)) return send(res, 404, { error: "parent" });
    folders.add(u);
    return send(res, 200, { ServerRelativeUrl: u });
  }
  let m;
  if ((m = api.match(/^web\/GetFolderByServerRelativePath\((.*)\)\/Files\/AddUsingPath\((.*)\)$/i)) && req.method === "POST") {
    const folder = arg(m[1], "DecodedUrl"), name = arg(m[2], "DecodedUrl");
    if (!folders.has(folder)) return send(res, 404, { error: "folder" });
    const url = `${folder}/${name}`;
    const v = (files.get(url)?.v || 0) + 1;
    files.set(url, { body, v });
    return send(res, 200, { Name: name, ETag: etag(url, v) });
  }
  if ((m = api.match(/^web\/GetFolderByServerRelativePath\((.*)\)\/Files$/i)) && req.method === "GET") {
    const folder = arg(m[1], "DecodedUrl");
    if (!folders.has(folder)) return send(res, 404, { error: "folder" });
    const value = [...files].filter(([u]) => u.slice(0, u.lastIndexOf("/")) === folder).map(([u, f]) => ({ Name: u.slice(folder.length + 1), ETag: etag(u, f.v) }));
    return send(res, 200, { value });
  }
  if ((m = api.match(/^web\/GetFileByServerRelativePath\((.*)\)\/\$value$/i))) {
    const url = arg(m[1], "DecodedUrl");
    const f = files.get(url);
    if (req.method === "GET") {
      if (!f) return send(res, 404, { error: "file" });
      res.writeHead(200, { "Content-Type": "application/octet-stream", ETag: etag(url, f.v) });
      return res.end(f.body);
    }
    if (req.method === "POST" && String(req.headers["x-http-method"]).toUpperCase() === "PUT") {
      if (!f) return send(res, 404, { error: "file" });
      const want = req.headers["if-match"];
      if (want && want !== "*" && want !== etag(url, f.v)) return send(res, 412, { error: "etag" });
      files.set(url, { body, v: f.v + 1 });
      return send(res, 204);
    }
  }
  send(res, 400, { error: "unsupported " + req.method + " " + api });
}).listen(PORT, () => console.log(`SharePoint-Nachbau: http://localhost:${PORT}${WEB}/test.html`));
