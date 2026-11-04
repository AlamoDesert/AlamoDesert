const MARKUP = "<div class=\"wrap\">\n  <header class=\"top\">\n    <h1 class=\"brand\">Rezeption<small id=\"weekday\">–</small></h1>\n    <div class=\"clock\" id=\"clock\">--:--</div>\n    <div class=\"presence\" id=\"presence\" role=\"group\" aria-label=\"Eingecheckt\"></div>\n    <button class=\"btn outbtn\" id=\"outBtn\" hidden>Auschecken</button>\n    <div class=\"tabs\" role=\"tablist\">\n      <button class=\"tab\" role=\"tab\" data-view=\"schicht\"><b>Schicht</b><span class=\"meta\" id=\"meta-shift\"></span></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"erstattung\" hidden><b>Check-ins</b><span class=\"meta\" id=\"meta-ci\"></span></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"dienst\"><b>Dienstplan</b></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"zeiten\"><b>Zeiten</b></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"admin\"><b>Verwaltung</b></button>\n    </div>\n    <div class=\"datenav\">\n      <button class=\"iconbtn\" id=\"prev\" aria-label=\"Vorheriger Tag\">‹</button>\n      <label class=\"datebtn\"><span id=\"datelabel\">–</span><span class=\"src\" id=\"datesrc\"></span><input type=\"date\" id=\"datepick\" aria-label=\"Datum wählen\"></label>\n      <button class=\"iconbtn\" id=\"next\" aria-label=\"Nächster Tag\">›</button>\n      <button class=\"todaybtn\" id=\"today\">Heute</button>\n    </div>\n    <div class=\"status\" id=\"status\">Verbinde…</div>\n  </header>\n  <div class=\"vobar\" id=\"vobar\" hidden><b>Nur ansehen</b><span>Abhaken und Eintragen sind gesperrt.</span><button class=\"btn primary\" data-pres-add=\"1\">Einchecken</button></div>\n  <main id=\"main\"></main>\n  <div id=\"ciwrap\" class=\"ciwrap\" hidden></div>\n</div>\n<input type=\"file\" id=\"rzfile\" class=\"rzfile\" tabindex=\"-1\" aria-hidden=\"true\"><div id=\"picker\" hidden></div><div id=\"remind\" hidden></div><div id=\"toast\" class=\"toast\" role=\"status\" hidden></div>";

/* Rezeption Schichtcheck – App-Kern.
   Wird von tools/build.mjs in index.html (eigenständig) und in das SharePoint-Webpart (app.gen.ts) eingebaut.
   mount(container, opts) rendert die App in `container` (liegt in einem Shadow-Root) und gibt eine Aufräumfunktion zurück.
   opts.mode: "auto" (claude.ai-Datenbank falls vorhanden, sonst Browser-Speicher) | "local" | "sharepoint". */

// ---------- SharePoint-Speicher ----------
// Jedes Dokument ist eine JSON-Datei in einer Dokumentbibliothek (Versionsverlauf = Sicherung).
// Bietet dieselbe Schnittstelle wie die claude.ai-Datenbank, soweit die App sie nutzt:
// doc(path).get/set/update/onSnapshot und collection("days").where("month", "==", ym).onSnapshot.
// Änderungen anderer Geräte kommen per Abfrage alle POLL_MS an.
export function createSpDb(opts) {
  const POLL_MS = opts.pollMs || 15000;
  const web = String(opts.webAbsoluteUrl || "").replace(/\/$/, "");
  const webRel = String(opts.webServerRelativeUrl || "/").replace(/\/$/, "");
  const title = opts.library || "RezeptionDaten";
  let libUrl = null;                 // server-relativ, z. B. /sites/team/RezeptionDaten
  let digest = null, digestUntil = 0;
  const knownFolders = new Set();

  const q = (v) => encodeURIComponent(String(v).replace(/'/g, "''"));
  class SpError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status; } }
  async function http(url, init = {}) {
    let res;
    try { res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init }); }
    catch { throw new SpError("unavailable", "Keine Verbindung zu SharePoint"); }
    if (res.status === 401 || res.status === 403) throw new SpError("not_granted", "Keine Berechtigung in SharePoint", res.status);
    return res;
  }
  async function getDigest() {
    if (digest && Date.now() < digestUntil) return digest;
    const res = await http(`${web}/_api/contextinfo`, { method: "POST", headers: { Accept: "application/json;odata=nometadata" } });
    if (!res.ok) throw new SpError("unavailable", `contextinfo ${res.status}`, res.status);
    const j = await res.json();
    digest = j.FormDigestValue;
    digestUntil = Date.now() + Math.max(60, (j.FormDigestTimeoutSeconds || 1800) - 120) * 1000;
    return digest;
  }
  async function post(url, body, headers = {}) {
    const d = await getDigest();
    return http(url, { method: "POST", body, headers: { Accept: "application/json;odata=nometadata", "X-RequestDigest": d, ...headers } });
  }
  // Bibliothek finden oder anlegen (BaseTemplate 101 = Dokumentbibliothek).
  async function ensureLibrary() {
    if (libUrl) return libUrl;
    const url = `${web}/_api/web/lists/GetByTitle('${q(title)}')?$select=Id&$expand=RootFolder`;
    let res = await http(url, { headers: { Accept: "application/json;odata=nometadata" } });
    if (res.status === 404) {
      const c = await post(`${web}/_api/web/lists`, JSON.stringify({ __metadata: { type: "SP.List" }, BaseTemplate: 101, Title: title, Description: "Daten der Rezeptions-Checkliste (nicht manuell bearbeiten)" }),
        { Accept: "application/json;odata=verbose", "Content-Type": "application/json;odata=verbose" });
      if (!c.ok) throw new SpError("unavailable", `Bibliothek „${title}“ konnte nicht angelegt werden (${c.status})`, c.status);
      res = await http(url, { headers: { Accept: "application/json;odata=nometadata" } });
    }
    if (!res.ok) throw new SpError("unavailable", `Bibliothek „${title}“ nicht lesbar (${res.status})`, res.status);
    const j = await res.json();
    libUrl = (j.RootFolder && j.RootFolder.ServerRelativeUrl) || `${webRel}/${title}`;
    return libUrl;
  }
  // Pfad → Ordner + Dateiname. Tage liegen in Monatsordnern: days/2026-10/2026-10-14.json
  function locate(path) {
    const parts = path.split("/");
    const name = parts.pop() + ".json";
    if (parts[0] === "days" && parts.length === 1 && /^\d{4}-\d{2}-\d{2}/.test(name)) parts.push(name.slice(0, 7));
    return { dir: parts, name };
  }
  async function ensureFolder(dirParts) {
    const lib = await ensureLibrary();
    let cur = lib;
    for (const p of dirParts) {
      cur += "/" + p;
      if (knownFolders.has(cur)) continue;
      const res = await post(`${web}/_api/web/folders/AddUsingPath(DecodedUrl='${q(cur)}',Overwrite=false)`, null);
      if (!res.ok && res.status !== 409) {
        // Ältere Variante als Rückfall
        const r2 = await post(`${web}/_api/web/folders/add('${q(cur)}')`, null);
        if (!r2.ok) throw new SpError("unavailable", `Ordner ${cur} (${r2.status})`, r2.status);
      }
      knownFolders.add(cur);
    }
    return cur;
  }
  async function readFile(path) {
    const lib = await ensureLibrary();
    const { dir, name } = locate(path);
    const fileUrl = [lib, ...dir, name].join("/");
    const res = await http(`${web}/_api/web/GetFileByServerRelativePath(DecodedUrl='${q(fileUrl)}')/$value`);
    if (res.status === 404) return { exists: false, data: undefined, etag: null, fileUrl };
    if (!res.ok) throw new SpError("unavailable", `Lesen ${path} (${res.status})`, res.status);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new SpError("unavailable", `Datei ${name} ist beschädigt`); }
    return { exists: true, data, etag: res.headers.get("ETag"), fileUrl };
  }
  async function writeFile(path, data, etag) {
    const { dir, name } = locate(path);
    const body = JSON.stringify(data);
    if (etag !== undefined && etag !== null) {
      const lib = await ensureLibrary();
      const fileUrl = [lib, ...dir, name].join("/");
      const res = await post(`${web}/_api/web/GetFileByServerRelativePath(DecodedUrl='${q(fileUrl)}')/$value`, body, { "X-HTTP-Method": "PUT", "IF-MATCH": etag });
      if (res.status === 412) throw new SpError("conflict", "Gleichzeitige Änderung", 412);
      if (!res.ok) throw new SpError("unavailable", `Schreiben ${path} (${res.status})`, res.status);
      return;
    }
    const folder = await ensureFolder(dir);
    const res = await post(`${web}/_api/web/GetFolderByServerRelativePath(DecodedUrl='${q(folder)}')/Files/AddUsingPath(DecodedUrl='${q(name)}',Overwrite=true)`, body);
    if (!res.ok) throw new SpError("unavailable", `Speichern ${path} (${res.status})`, res.status);
  }
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function merge(base, patch) {
    const out = isObj(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : (isObj(v) ? merge({}, v) : v);
    return out;
  }
  const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const snap = (id, exists, data) => ({ id, exists, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });

  // Beobachter: nach eigenen Schreibvorgängen sofort neu lesen.
  const watchers = new Set();
  const poke = () => watchers.forEach((w) => w());

  function doc(path) {
    const id = path.split("/").pop();
    return {
      id, path,
      async get() { const r = await readFile(path); return snap(id, r.exists, r.exists ? freeze(r.data) : undefined); },
      async set(data) { await writeFile(path, data); poke(); },
      async update(patch) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const r = await readFile(path);
          if (!r.exists) throw new SpError("invalid_argument", "Dokument existiert nicht");
          try { await writeFile(path, merge(r.data, patch), r.etag || null); poke(); return; }
          catch (e) { if (e.code !== "conflict") throw e; }
        }
        throw new SpError("unavailable", "Zu viele gleichzeitige Änderungen");
      },
      onSnapshot(next, error) {
        let last = Symbol("none"), stopped = false, busy = false;
        const run = async () => {
          if (stopped || busy) return;
          busy = true;
          try {
            const r = await readFile(path);
            const key = r.exists ? JSON.stringify(r.data) : null;
            if (key !== last) { last = key; next(snap(id, r.exists, r.exists ? freeze(r.data) : undefined)); }
          } catch (e) { if (e.code === "not_granted" && error) { error(e); stopped = true; } }
          finally { busy = false; }
        };
        run();
        const t = setInterval(run, POLL_MS);
        watchers.add(run);
        return () => { stopped = true; clearInterval(t); watchers.delete(run); };
      },
    };
  }
  function collection(name) {
    let monthEq = null;
    const api = {
      where(field, op, value) { if (name === "days" && field === "month" && op === "==") monthEq = String(value); return api; },
      onSnapshot(next, error) {
        let stopped = false, busy = false, lastKey = null;
        const cache = new Map(); // Dateiname -> { etag, data }
        const run = async () => {
          if (stopped || busy || !monthEq) return;
          busy = true;
          try {
            const lib = await ensureLibrary();
            const folder = `${lib}/days/${monthEq}`;
            const res = await http(`${web}/_api/web/GetFolderByServerRelativePath(DecodedUrl='${q(folder)}')/Files?$select=Name,ETag`, { headers: { Accept: "application/json;odata=nometadata" } });
            let files = [];
            if (res.ok) files = ((await res.json()).value || []).filter((f) => /\.json$/.test(f.Name));
            else if (res.status !== 404) throw new SpError("unavailable", `Monat ${monthEq} (${res.status})`, res.status);
            for (const f of files) {
              const c = cache.get(f.Name);
              if (c && c.etag === f.ETag) continue;
              const r = await readFile("days/" + f.Name.replace(/\.json$/, ""));
              if (r.exists) cache.set(f.Name, { etag: f.ETag, data: freeze(r.data) });
            }
            for (const k of [...cache.keys()]) if (!files.some((f) => f.Name === k)) cache.delete(k);
            const key = files.map((f) => f.Name + f.ETag).sort().join("|");
            if (key !== lastKey) {
              lastKey = key;
              const docs = [...cache.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([n, v]) => snap(n.replace(/\.json$/, ""), true, v.data));
              next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
            }
          } catch (e) { if (e.code === "not_granted" && error) { error(e); stopped = true; } }
          finally { busy = false; }
        };
        run();
        const t = setInterval(run, POLL_MS);
        watchers.add(run);
        return () => { stopped = true; clearInterval(t); watchers.delete(run); };
      },
    };
    return api;
  }
  return { doc, collection, ready: ensureLibrary };
}

// ---------- App ----------
export function mount(container, opts = {}) {
  opts = { mode: "auto", ...opts };
  const root = opts.root || document;
  const host = root.host || container;
  const timers = [], cleanups = [];
  // Brücke der Mac-App (mac/preload.js); im Browser und in SharePoint nicht vorhanden.
  const NATIVE = opts.native || (typeof window !== "undefined" && window.rezeptionNative) || null;
  let disposed = false;
  container.innerHTML = MARKUP;
  // Reiter „Check-ins“ (Check-in-Erstattung, eigene Seite im iframe) nur, wenn die Seite mitgeliefert wird (Mac-App, Webversion)
  // und die Leitung ihn unter Verwaltung › Funktionen eingeschaltet hat (Standard: aus).
  const CHECKIN_URL = opts.checkinUrl || null;
  // Farbschema: in SharePoint immer hell, sonst wie die einbettende Seite (claude.ai setzt data-theme).
  if (opts.mode === "sharepoint") host.setAttribute("data-theme", "light");
  else if (root.host) {
    const syncTheme = () => { const t = document.documentElement.getAttribute("data-theme"); if (t) host.setAttribute("data-theme", t); else host.removeAttribute("data-theme"); };
    syncTheme();
    const mo = new MutationObserver(syncTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    cleanups.push(() => mo.disconnect());
  }
  // Querformat: Höhe bis zum unteren Fensterrand, damit alles auf einen Bildschirm passt.
  if (opts.fitViewport) {
    const fit = () => { const top = Math.max(0, host.getBoundingClientRect().top + (window.scrollY || 0)); host.style.setProperty("--rz-h", Math.max(480, window.innerHeight - top - 8) + "px"); };
    fit();
    window.addEventListener("resize", fit);
    cleanups.push(() => window.removeEventListener("resize", fit));
    timers.push(setTimeout(fit, 500));
  }


  // ---------- Standardplan (Vorlage: Aushang „Checkliste neue Rezeption") ----------
  // Pro Tag gilt: Tagesanpassung > Wochentag-Vorlage > gespeicherter Standard > DEFAULT_PLAN.
  // Item-IDs sind Datenbank-Schlüssel: nie umbenennen.
  // Stand: von der Rezeption angepasster Plan (Testversion, 10.10.2026).
  const DEFAULT_PLAN = {
    "frueh": {
      "end": "15:30",
      "phases": [
        {
          "from": "08:00",
          "hint": "direkt bei Schichtbeginn",
          "id": "open",
          "items": [
            {
              "id": "f_lager",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Lager (hinter Rezeption) aufschließen"
            },
            {
              "id": "f_ruf",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Rufweiterleitung deaktivieren"
            },
            {
              "id": "f_nubsi",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neue Eingangstür „Nubsi“ verstellen"
            },
            {
              "id": "f_kuehl_auf",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kühlschränke aufschließen + Licht an"
            },
            {
              "id": "f_kaffee",
              "important": false,
              "optional": false,
              "s": "rechts hinter dem Display",
              "t": "Kaffeemaschine anstellen"
            },
            {
              "id": "f_musik",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Musik an über Sonos"
            },
            {
              "id": "f_tv",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Beide Fernseher anmachen"
            }
          ],
          "title": "Öffnen",
          "to": "08:30"
        },
        {
          "from": "08:00",
          "hint": "vor den ersten Buchungen",
          "id": "setup",
          "items": [
            {
              "id": "f_spint",
              "important": false,
              "optional": false,
              "s": "Schläger-Nr. korrekt hinterlegt? Auf Schäden prüfen.",
              "t": "Schläger/Bälle vom Vorabend aus dem Rückgabespint nehmen"
            },
            {
              "id": "f_merch",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Merch und Testschläger vorne an die Wand hängen"
            },
            {
              "id": "f_rezeption",
              "important": false,
              "optional": false,
              "s": "Aufsteller, Kaffeebecher + Extras, Spendenbox, Preisliste, Eisliste, Snickers, Müsliriegel, Griffbänder",
              "t": "Rezeption aufbauen"
            },
            {
              "id": "f_kuehl_fuell",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kühlschränke auffüllen"
            }
          ],
          "title": "Rezeption einrichten",
          "to": "09:00"
        },
        {
          "from": "09:00",
          "hint": "am Vormittag",
          "id": "orga",
          "items": [
            {
              "id": "f_excel",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neuerungen in der Excel (SharePoint) prüfen"
            },
            {
              "id": "f_bestand",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Bestand Schläger + Bälle prüfen → sortieren"
            }
          ],
          "title": "Orga",
          "to": "11:00"
        }
      ],
      "start": "08:00"
    },
    "spaet": {
      "end": "23:00",
      "phases": [
        {
          "from": "15:30",
          "hint": "Übergabe-Notiz lesen",
          "id": "start",
          "items": [
            {
              "id": "s_excel",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neuerungen in der Excel (SharePoint) prüfen"
            },
            {
              "id": "s_xmv2uktvfpcm8",
              "important": false,
              "optional": true,
              "s": "",
              "t": "Check-ins erledigen, wenn noch offen"
            }
          ],
          "title": "Schichtstart",
          "to": "16:00"
        },
        {
          "from": "18:30",
          "hint": "je nach Dunkelheit",
          "id": "licht",
          "items": [
            {
              "id": "s_flutlicht_an",
              "important": false,
              "optional": true,
              "s": "ab ca. 18:30, je nach Dunkelheit",
              "t": "bei Bedarf: Tennis-Flutlicht anstellen"
            },
            {
              "id": "s_plejd",
              "important": false,
              "optional": false,
              "s": "geht automatisch 30 min vor Sonnenuntergang ein und um 22:10 Uhr aus",
              "t": "Outdoor-Plätze: Licht über Plejd anmachen"
            }
          ],
          "title": "Licht an",
          "to": "19:30"
        },
        {
          "from": "20:00",
          "hint": "",
          "id": "kunden",
          "items": [
            {
              "id": "s_kunden",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kunden für abends ab 22 Uhr und morgens (8–10 Uhr) anschreiben und informieren"
            }
          ],
          "title": "Kunden informieren",
          "to": "21:00"
        },
        {
          "from": "21:00",
          "hint": "nach den Buchungen",
          "id": "plaetze",
          "items": [
            {
              "id": "s_flutlicht_aus",
              "important": false,
              "optional": true,
              "s": "spätestens 22:10 Uhr",
              "t": "Tennis-Flutlicht ausstellen"
            },
            {
              "id": "s_waessern",
              "important": false,
              "optional": true,
              "s": "nur wenn es sehr trocken ist, nach 21 Uhr // aktuell nicht notwendig wegen Tau",
              "t": "Tennisplätze 3× hintereinander wässern"
            }
          ],
          "title": "Plätze",
          "to": "21:30"
        },
        {
          "from": "21:30",
          "hint": "nach der letzten Buchung",
          "id": "abbau",
          "items": [
            {
              "id": "s_kaffee",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kaffeemaschine reinigen"
            },
            {
              "id": "s_merch",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Merch + Testschläger hinten in den Raum wegräumen"
            },
            {
              "id": "s_rezeption",
              "important": false,
              "optional": false,
              "s": "Aufsteller alter Tresen 2×, neuer Tresen 1×, Kaffeebecher + Extras, Spendenbox, Preisliste, Eisliste, Snickers, Müsliriegel, Griffbänder",
              "t": "Rezeption abbauen"
            },
            {
              "id": "s_spinte",
              "important": false,
              "optional": false,
              "s": "Notiz in der Buchung: Schläger-Nr. + evtl. Bälle",
              "t": "Rückgabe-Spinte mit LE füllen"
            },
            {
              "id": "s_kuehl",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kühlschränke auffüllen + Licht aus + abschließen"
            }
          ],
          "title": "Abbau",
          "to": "22:00"
        },
        {
          "from": "22:30",
          "hint": "in dieser Reihenfolge",
          "id": "close",
          "items": [
            {
              "id": "s_musik",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Musik aus über Sonos/Spotify"
            },
            {
              "id": "s_tv",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Fernseher ausmachen"
            },
            {
              "id": "s_schiebe",
              "important": false,
              "optional": false,
              "s": "roter Punkt",
              "t": "Schiebefenster abschließen"
            },
            {
              "id": "s_ruf",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Rufweiterleitung aktivieren, Info an G/D/D/J"
            },
            {
              "id": "s_xmv2j3h7wo0pc",
              "important": false,
              "optional": true,
              "s": "wenn voll",
              "t": "Müll rausbringen"
            },
            {
              "id": "s_nubsi",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neue Eingangstür „Nubsi“ verstellen"
            },
            {
              "id": "s_alte",
              "important": false,
              "optional": false,
              "s": "Gummiband abmachen, prüfen ob abgeschlossen",
              "t": "„Alte“ Eingangstür (mit Code) abschließen"
            }
          ],
          "title": "Abschließen",
          "to": "23:00"
        }
      ],
      "start": "15:30"
    },
    "always": {
      "frueh": [
        {
          "every": 60,
          "id": "rund",
          "important": false,
          "s": "",
          "t": "Rundgang Halle / draußen"
        },
        {
          "every": 60,
          "id": "wasser",
          "important": false,
          "s": "",
          "t": "Wasserspender regelmäßig wischen"
        },
        {
          "every": 0,
          "id": "spuel",
          "important": false,
          "s": "",
          "t": "Spülbecken (Lager) sauberhalten"
        },
        {
          "every": 0,
          "id": "checkin",
          "important": false,
          "s": "nicht geschafft? → Übergabe-Notiz",
          "t": "Check-ins erledigen"
        },
        {
          "every": 0,
          "id": "whatsapp",
          "important": false,
          "s": "",
          "t": "WhatsApp-Chats abarbeiten"
        },
        {
          "every": 0,
          "id": "a_xmv2j2g67uihk",
          "important": false,
          "s": "",
          "t": "Laptop + Handy laden"
        },
        {
          "every": 0,
          "id": "fenster",
          "important": false,
          "s": "je nach Wetter",
          "t": "Fenster öffnen/schließen"
        },
        {
          "every": 0,
          "id": "a_xmv2j6qsr3cnv",
          "important": false,
          "s": "",
          "t": "Müll rausbringen, wenn voll"
        }
      ],
      "spaet": [
        {
          "every": 60,
          "id": "rund",
          "important": false,
          "s": "",
          "t": "Rundgang Halle / draußen"
        },
        {
          "every": 60,
          "id": "wasser",
          "important": false,
          "s": "",
          "t": "Wasserspender regelmäßig wischen"
        },
        {
          "every": 0,
          "id": "spuel",
          "important": false,
          "s": "",
          "t": "Spülbecken (Lager) sauberhalten"
        },
        {
          "every": 0,
          "id": "whatsapp",
          "important": false,
          "s": "",
          "t": "WhatsApp-Chats abarbeiten"
        },
        {
          "every": 0,
          "id": "fenster",
          "important": false,
          "s": "je nach Wetter",
          "t": "Fenster öffnen/schließen"
        },
        {
          "every": 0,
          "id": "a_xmv2j69560uh4",
          "important": false,
          "s": "",
          "t": "Laptop + Handy laden"
        }
      ]
    }
  };

  const SHIFT_META = {
    frueh: { label: "Frühschicht", short: "Früh", prefix: "f" },
    spaet: { label: "Spätschicht", short: "Spät", prefix: "s" },
  };
  const KEYS = ["frueh", "spaet"];

  // ---------- Helfer ----------
  const $ = (id) => root.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (iso, n) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoDate(d); };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const fmtMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const newId = (prefix) => `${prefix}_x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const CHECK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
  const LOOP_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5.5A5.5 5.5 0 0 0 3.2 4.6M3 10.5a5.5 5.5 0 0 0 9.8.9"/><path d="M3 1.8v3h3M13 14.2v-3h-3"/></svg>';

  // ---------- Plan prüfen (Daten aus der DB sind unvertrauenswürdig) ----------
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  // Akzeptiert 7:30, 0730, 730, 7.30, 7 → "07:30"/"07:00"; sonst null.
  function normTime(v) {
    const m = String(v || "").trim().match(/^(\d{1,2})(?:[:.]?(\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2] || 0);
    return h < 24 && mi < 60 ? `${pad(h)}:${pad(mi)}` : null;
  }
  const sortPhases = (phases) => phases.map((p, i) => [p, i]).sort((a, b) => (toMin(a[0].from) - toMin(b[0].from)) || (a[1] - b[1])).map(x => x[0]);

  function normalizePlan(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = { always: {} };
    for (const key of KEYS) {
      const s = raw[key], def = DEFAULT_PLAN[key];
      if (!s || typeof s !== "object" || !Array.isArray(s.phases)) return null;
      const seen = new Set();
      const phases = s.phases.slice(0, 20).map(p => {
        if (!p || typeof p !== "object" || !TIME_RE.test(p.from) || !TIME_RE.test(p.to)) return null;
        const items = (Array.isArray(p.items) ? p.items : []).slice(0, 40).map(i => {
          if (!i || typeof i !== "object" || !ID_RE.test(i.id) || seen.has(i.id)) return null;
          const t = str(i.t, 200).trim();
          if (!t) return null;
          seen.add(i.id);
          return { id: i.id, t, s: str(i.s, 300), important: i.important === true, optional: i.optional === true, ...(TIME_RE.test(i.remind) ? { remind: i.remind, ...(i.remindAlways === true ? { remindAlways: true } : {}) } : {}) };
        }).filter(Boolean);
        return { id: ID_RE.test(p.id) ? p.id : newId("p"), title: str(p.title, 60).trim() || "Abschnitt", from: p.from, to: p.to, hint: str(p.hint, 80), items };
      }).filter(Boolean);
      out[key] = {
        start: TIME_RE.test(s.start) ? s.start : def.start,
        end: TIME_RE.test(s.end) ? s.end : def.end,
        phases: sortPhases(phases),
      };
      const al = raw.always && Array.isArray(raw.always[key]) ? raw.always[key] : DEFAULT_PLAN.always[key];
      out.always[key] = al.slice(0, 20).map(a => {
        if (!a || typeof a !== "object") return null;
        const t = str(a.t, 200).trim();
        if (!t) return null;
        const every = Number.isInteger(a.every) && a.every >= 0 && a.every <= 480 ? a.every : (a.rounds === true ? 60 : 0);
        // Art: rhythm (Zähler + fällig), confirm (Pflicht, einmal pro Schicht bestätigen), hint (nur Hinweis).
        // Ältere Pläne ohne Art: mit Rhythmus → rhythm, Laptop/Handy/Spülbecken → confirm, sonst hint.
        let kind = ["rhythm", "confirm", "hint"].includes(a.kind) ? a.kind : every > 0 ? "rhythm" : /laptop|handy|spülbecken|spuelbecken/i.test(t) ? "confirm" : "hint";
        return { id: ID_RE.test(a.id) ? a.id : newId("a"), t, s: str(a.s, 200), important: a.important === true, kind, every: kind === "rhythm" ? (every || 60) : 0 };
      }).filter(Boolean);
    }
    return out;
  }

  // Abgeleitete Strukturen pro Planobjekt einmal berechnen.
  const derivedCache = new WeakMap();
  function derive(plan) {
    let d = derivedCache.get(plan);
    if (d) return d;
    d = { ids: {}, item: {} };
    for (const key of KEYS) {
      d.ids[key] = [];
      for (const p of plan[key].phases) for (const i of p.items) { d.ids[key].push(i.id); d.item[i.id] = { ...i, shift: key, phase: p }; }
    }
    derivedCache.set(plan, d);
    return d;
  }

  // ---------- Zustand ----------
  const DEFAULT = normalizePlan(DEFAULT_PLAN);
  const state = {
    date: isoDate(new Date()),
    view: "schicht",
    shiftSel: null,      // null = laufende Schicht automatisch, sonst "frueh" | "spaet"
    rosterMonth: null,   // "JJJJ-MM" im Dienstplan
    rosterDay: null,     // Tag im Bearbeiten-Fenster des Dienstplans
    remindOpen: false, remindSnoozeUntil: 0,
    time: {},            // Zeiterfassung des angezeigten Tages: { <id>: { pid, role, in, out, pause, at, orig?, editedAt? } | null }
    checkin: null,       // offenes Einchecken-Fenster
    checkout: null,      // offenes Auschecken-Fenster
    timesMonth: null, timesPerson: null, timesData: null, timesEdit: null, timesAll: false,
    checks: {}, notes: {}, prevNotes: {},
    read: {},            // Übergabe gelesen: { <Empfänger-Schicht>: { by, at, noteAt } } – noteAt = Stand der gelesenen Notiz
    handPop: null,       // Schicht, deren Übergabe gerade als Fenster angezeigt wird
    sideOpen: new Set(), // aufgeklappte Gruppen rechts („rhythm“, „confirm“, „hint“)
    notePop: null,       // Schicht, deren eigene Übergabe gerade im Fenster bearbeitet wird
    coFlag: null,        // Schicht, deren offene Punkte nach einem gescheiterten Auschecken im Fahrplan markiert sind
    logs: {},            // Daueraufgaben: { frueh|spaet: { <id>: { <key>: {at, by} | null } } }
    dayPlan: null,       // Tagesanpassung (normalisiert) oder null
    daySnap: null,       // festgehaltener Plan-Stand des Tages (gilt nur für vergangene Tage)
    cfg: { base: null, weekday: {}, people: [], roster: {}, adminPin: null, features: { checkins: false }, master: null, backupKey: null }, // Pläne, Team, Dienstplan, Leitungs-PIN, Funktionen
    docExists: false, cfgExists: false,
    month: {},           // date -> { checks, plan }
    names: {},
    expanded: new Set(),
    confirm: null,       // zweistufiges Löschen
    mode: "loading",
    readOnly: false,
    who: null,           // { date, shift, id } – wer gerade an der Rezeption arbeitet (pro Gerät)
    pickerOpen: false,
    pickerMode: "login", // "login" = Anmeldemaske (niemand eingecheckt), "add" = weitere Person über „+“
    pickAdd: false,      // Eingabefeld „Neue Person“ in der Anmeldemaske offen
    viewOnly: false,     // „Nur ansehen“ gewählt: Schicht und Erstattung gesperrt, bis jemand eincheckt
    byeSeen: false,      // Feierabend-Gruß in der Maske weggetippt
    unlockedUntil: 0,    // Leitungsbereich entsperrt bis (ms)
    pinStage: null,      // { mode: "unlock"|"set", first?: string, next: view }
    rosterEdit: false,
    edShift: "frueh",    // Aufgaben-Plan: angezeigte Schicht
    edOpen: new Set(),   // aufgeklappte Abschnitte im Aufgaben-Plan
    edAdd: null,         // Abschnitt mit offener Eingabezeile „Neue Aufgabe“
    edNew: null,         // zuletzt hinzugefügte Aufgabe (grün markiert)
    edPop: null,         // Bearbeiten-Fenster: { type: "item" | "phase" | "shift" | "always", id }
    edConfirmDel: false,
    adminPop: null,      // Fenster in der Verwaltung: "team" | "backup" | "pin" | "encsetup" | "enccode" | "decrypt" | "cleanup"
    pendingImport: null, // verschlüsselte Sicherung, die auf Passwort/Code wartet
    encCode: null,       // frisch erzeugter Wiederherstellungscode (nur bis „Fertig“ im Speicher)
    taskRem: null,       // gerade angezeigte Aufgaben-Erinnerung { id, key, item }
    rosterHi: "",        // Dienstplan: Name, dessen Tage hervorgehoben werden
    importPreview: null, // eingelesener Arbeitsplan vor dem Übernehmen
  };
  let db = null, user = null, myId = null, unsubDay = null, unsubMonth = null, unsubCfg = null, monthKey = null;
  let writeChain = Promise.resolve();
  let renderPending = false;
  let scrolledOnce = false;

  // raw = ohne Schichtzeiten aus dem Dienstplan (für den Plan-Editor).
  // snap = festgehaltener Plan-Stand eines Tages: vergangene Tage behalten so Aufgaben und Prozente, auch wenn die Vorlagen später geändert werden.
  function resolvePlan(date, dayPlan, raw, snap) {
    let r;
    if (dayPlan) r = { plan: dayPlan, source: "day" };
    else if (snap && date < isoDate(new Date())) r = { plan: snap, source: "snap" };
    else {
      const wd = String(parseIso(date).getDay());
      if (state.cfg.weekday[wd]) r = { plan: state.cfg.weekday[wd], source: "weekday" };
      else if (state.cfg.base) r = { plan: state.cfg.base, source: "base" };
      else r = { plan: DEFAULT, source: "default" };
    }
    return raw ? r : { ...r, plan: withRosterTimes(r.plan, date) };
  }
  // Schichtbeginn/-ende des Tages aus dem eingelesenen Arbeitsplan übernehmen (Abschnitte bleiben unverändert).
  const timesCache = new Map();
  function withRosterTimes(plan, date) {
    const t = state.cfg.roster[date] && state.cfg.roster[date].times;
    if (!t) return plan;
    const key = date + JSON.stringify(t);
    const hit = timesCache.get(key);
    if (hit && hit.src === plan) return hit.plan;
    const out = { ...plan };
    for (const k of KEYS) if (t[k]) { const [a, b] = t[k].split("-"); out[k] = { ...plan[k], start: a, end: b }; }
    if (timesCache.size > 200) timesCache.clear();
    timesCache.set(key, { src: plan, plan: out });
    return out;
  }
  const P = () => resolvePlan(state.date, state.dayPlan, false, state.daySnap).plan;

  // ---------- Speicher ----------
  const LS = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
    month(ym) {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("rz2:" + ym)) { const d = JSON.parse(localStorage.getItem(k) || "{}"); out[k.slice(4)] = { checks: d.checks || {}, plan: normalizePlan(d.plan), snap: normalizePlan(d.snap), time: normTimes(d.time) }; }
        }
      } catch { /* blockiert */ }
      return out;
    },
  };

  function setStatus(text, err = false) { const el = $("status"); el.textContent = text; el.title = text; el.classList.toggle("err", err); }
  function statusLine() {
    if (state.readOnly) return "Nur Lesezugriff.";
    if (state.mode === "shared") return opts.mode === "sharepoint" ? "Gespeichert in SharePoint" : "Live geteilt";
    if (state.mode === "local") return backupHint() || "Gespeichert auf diesem Mac";
    return "Verbinde…";
  }

  function applyDoc(data) {
    state.checks = (data && data.checks && typeof data.checks === "object") ? data.checks : {};
    state.notes = (data && data.notes && typeof data.notes === "object") ? data.notes : {};
    state.read = (data && data.read && typeof data.read === "object") ? data.read : {};
    state.logs = (data && data.logs && typeof data.logs === "object") ? data.logs : {};
    state.time = normTimes(data && data.time);
    state.dayPlan = data ? normalizePlan(data.plan) : null;
    state.daySnap = data ? normalizePlan(data.snap) : null;
  }
  function applyCfg(data) {
    const weekday = {};
    if (data && data.weekday && typeof data.weekday === "object") {
      for (let i = 0; i < 7; i++) { const p = normalizePlan(data.weekday[String(i)]); if (p) weekday[String(i)] = p; }
    }
    const people = (data && Array.isArray(data.people) ? data.people : []).slice(0, 80).map(x => {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id)) return null;
      const name = str(x.name, 40).trim();
      return name ? { id: x.id, name } : null;
    }).filter(Boolean);
    const roster = {};
    if (data && data.roster && typeof data.roster === "object") {
      for (const [d, v] of Object.entries(data.roster)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== "object") continue;
        const e = {};
        for (const k of KEYS) e[k] = Array.isArray(v[k]) ? v[k].filter(id => typeof id === "string" && ID_RE.test(id)).slice(0, 10) : [];
        // Schichtzeiten des Tages aus dem Arbeitsplan ("08:45-16:00") und Anmerkungen pro Person ("Ab 17 Uhr").
        if (v.times && typeof v.times === "object") {
          const t = {};
          for (const k of KEYS) if (typeof v.times[k] === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v.times[k])) t[k] = v.times[k];
          if (Object.keys(t).length) e.times = t;
        }
        if (v.info && typeof v.info === "object") {
          const inf = {};
          for (const [pid, txt] of Object.entries(v.info)) if (ID_RE.test(pid) && typeof txt === "string" && txt.trim()) inf[pid] = txt.trim().slice(0, 60);
          if (Object.keys(inf).length) e.info = inf;
        }
        // Anmerkung pro Schicht aus dem Monatsplan (nur Anzeige, z. B. Zusatzhinweise zur Besetzung).
        if (v.notes && typeof v.notes === "object") {
          const n = {};
          for (const k of KEYS) if (typeof v.notes[k] === "string" && v.notes[k].trim()) n[k] = v.notes[k].trim().slice(0, 80);
          if (Object.keys(n).length) e.notes = n;
        }
        roster[d] = e;
      }
    }
    state.cfg = { base: data ? normalizePlan(data.base) : null, weekday, people, roster, adminPin: data && typeof data.adminPin === "string" ? data.adminPin.slice(0, 200) : null,
      features: { checkins: !!(data && data.features && data.features.checkins === true) },
      master: data ? normalizeMaster(data.master) : null,
      backupKey: data ? normalizeBackupKey(data.backupKey) : null };
  }

  // Schlüssel für verschlüsselte Sicherungen: nur Form prüfen (Inhalte sind base64).
  function normalizeBackupKey(k) {
    const w = (x) => x && typeof x === "object" && ["salt", "iv", "ct"].every(f => typeof x[f] === "string" && x[f].length < 20000) && Number.isInteger(x.iter) && x.iter >= 100000;
    return k && typeof k === "object" && k.v === 1 && typeof k.pub === "string" && k.pub.length < 4000 && w(k.pw) && w(k.code) ? { v: 1, created: String(k.created || ""), pub: k.pub, pw: k.pw, code: k.code } : null;
  }
  function currentDayDoc() {
    return { month: state.date.slice(0, 7), checks: state.checks, notes: state.notes, read: state.read, logs: state.logs, time: state.time, plan: state.dayPlan, snap: state.daySnap };
  }

  async function loadPrevNotes() {
    const prev = addDays(state.date, -1), forDate = state.date;
    let notes = {};
    if (state.mode === "shared") {
      try { const s = await db.doc("days/" + prev).get(); notes = (s.exists && s.data().notes) || {}; } catch { notes = {}; }
    } else notes = LS.get("rz2:" + prev, {}).notes || {};
    if (forDate !== state.date) return;
    state.prevNotes = notes;
    collectNames();
    render();
  }

  function subscribeDay() {
    if (unsubDay) { unsubDay(); unsubDay = null; }
    state.prevNotes = {};
    if (state.mode !== "shared") {
      applyDoc(LS.get("rz2:" + state.date, null));
      state.docExists = true;
      render(); loadPrevNotes();
      return;
    }
    const m = state.month[state.date];
    applyDoc(m ? { checks: m.checks, plan: m.plan, snap: m.snap } : null);
    state.docExists = !!m;
    render(); loadPrevNotes();
    unsubDay = db.doc("days/" + state.date).onSnapshot(
      (snap) => { state.docExists = snap.exists; applyDoc(snap.exists ? snap.data() : null); collectNames(); render(); },
      (e) => setStatus("Verbindung unterbrochen (" + ((e && e.code) || "Fehler") + ") – Seite neu laden", true),
    );
  }

  function subscribeMonth(force) {
    const ym = state.date.slice(0, 7);
    if (!force && ym === monthKey && (unsubMonth || state.mode === "local")) return;
    monthKey = ym;
    if (unsubMonth) { unsubMonth(); unsubMonth = null; }
    if (state.mode !== "shared") { state.month = LS.month(ym); return; }
    state.month = {};
    unsubMonth = db.collection("days").where("month", "==", ym).onSnapshot(
      (snap) => {
        const m = {};
        snap.docs.forEach(d => { if (d.exists) { const x = d.data(); m[d.id] = { checks: x.checks || {}, plan: normalizePlan(x.plan), snap: normalizePlan(x.snap), time: normTimes(x.time) }; } });
        state.month = m;
        if (state.view === "monat") render();
      },
      () => { /* optional */ },
    );
  }

  function subscribeCfg() {
    if (state.mode !== "shared") { applyCfg(LS.get("rz2cfg", null)); state.cfgExists = true; return; }
    unsubCfg = db.doc("config/plan").onSnapshot(
      (snap) => { state.cfgExists = snap.exists; applyCfg(snap.exists ? snap.data() : null); render(); },
      () => { /* Standardplan bleibt aktiv */ },
    );
  }

  function collectNames() {
    const ids = [
      ...Object.values(state.checks).filter(Boolean).map(c => c.by),
      ...Object.values(state.notes).filter(Boolean).map(n => n.by),
      ...Object.values(state.prevNotes).filter(Boolean).map(n => n.by),
      ...Object.values(state.logs).flatMap(sh => Object.values(sh || {}).flatMap(m => Object.values(m || {}))).filter(Boolean).map(v => v.by),
    ].filter(id => typeof id === "string" && id && !(id in state.names));
    if (!ids.length || !user || typeof user.profiles !== "function") return;
    const uniq = [...new Set(ids)];
    uniq.forEach(id => { state.names[id] = ""; });
    user.profiles(uniq).then(ps => {
      uniq.forEach(id => { state.names[id] = (ps && ps[id] && ps[id].name) || ""; });
      render();
    }).catch(() => { /* optional */ });
  }

  // Schreibvorgänge strikt nacheinander. patch = Merge auf bestehendes Dokument, full = Inhalt beim Neuanlegen.
  function persistDoc(path, patch, full, localKey, localFull) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return Promise.resolve(false); }
    if (state.mode !== "shared") {
      const ok = LS.set(localKey, localFull);
      if (!ok) setStatus("Browser-Speicher blockiert – Änderungen gehen beim Neuladen verloren", true);
      return Promise.resolve(ok);
    }
    const job = writeChain.then(async () => {
      const ref = db.doc(path);
      try {
        const snap = await ref.get();
        if (snap.exists) await ref.update(patch); else await ref.set(full);
        setStatus(statusLine());
        return true;
      } catch (e) {
        const code = e && e.code;
        if (code === "not_granted") { state.readOnly = true; setStatus("Nur Lesezugriff – Bearbeitungsrechte beim Besitzer anfragen", true); }
        else setStatus("Speichern fehlgeschlagen (" + (code || "Fehler") + ") – bitte erneut versuchen", true);
        return false;
      }
    });
    writeChain = job;
    return job;
  }
  // Plan-Stand festhalten: Jeder Schreibvorgang am angezeigten Tag speichert den gültigen Plan mit (heute immer der aktuelle,
  // an vergangenen Tagen nur, falls noch keiner festgehalten ist). Tage mit Tagesanpassung brauchen das nicht.
  function snapFor(date) {
    if (date !== state.date || state.dayPlan) return null;
    if (date < isoDate(new Date()) && state.daySnap) return null;
    const snap = resolvePlan(date, null, true).plan;
    return state.daySnap && JSON.stringify(state.daySnap) === JSON.stringify(snap) ? null : snap;
  }
  const persistDay = (date, patch) => {
    const snap = snapFor(date);
    if (snap) { state.daySnap = snap; patch = { ...patch, snap }; }
    return persistDoc("days/" + date, patch, currentDayDoc(), "rz2:" + date, currentDayDoc());
  };
  // Nach einer Änderung der Vorlagen: heutigen Stand nachziehen (sonst hielte der Tag den Stand vom letzten Haken fest).
  async function refreshTodaySnap() {
    const today = isoDate(new Date());
    if (state.date === today) { if (state.daySnap && snapFor(today)) await persistDay(today, {}); return; }
    const snap = resolvePlan(today, null, true).plan;
    if (state.mode !== "shared") {
      const doc = LS.get("rz2:" + today, null);
      if (doc && doc.snap && !doc.plan) LS.set("rz2:" + today, { ...doc, snap });
      return;
    }
    try { const ref = db.doc("days/" + today), cur = await ref.get(); if (cur.exists && cur.data().snap && !cur.data().plan) await ref.update({ snap }); } catch { /* beim nächsten Haken */ }
  }
  // Einmalig (lokaler Speicher): vergangene Tage mit Einträgen, die noch keinen festgehaltenen Stand haben, mit dem jetzt gültigen Plan festhalten.
  function migrateSnaps() {
    if (state.mode !== "local") return;
    const meta = LS.get("rz2meta", {});
    if (meta.snapV1) return;
    const today = isoDate(new Date());
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /^rz2:\d{4}-\d{2}-\d{2}$/.test(k) && k.slice(4) < today) keys.push(k); }
      for (const k of keys) {
        const doc = LS.get(k, null);
        if (!doc || doc.plan || doc.snap) continue;
        const touched = (doc.checks && Object.keys(doc.checks).length) || (doc.logs && Object.keys(doc.logs).length);
        if (touched) LS.set(k, { ...doc, snap: resolvePlan(k.slice(4), null, true).plan });
      }
    } catch { return; }
    LS.set("rz2meta", { ...LS.get("rz2meta", {}), snapV1: true });
  }
  function cfgPayload() {
    const weekday = {};
    for (const k of Object.keys(state.cfg.weekday)) weekday[k] = state.cfg.weekday[k];
    return { base: state.cfg.base, weekday, people: state.cfg.people, roster: state.cfg.roster, adminPin: state.cfg.adminPin, features: state.cfg.features, master: state.cfg.master || null, backupKey: state.cfg.backupKey || null };
  }
  const persistCfg = (patch) => persistDoc("config/plan", patch, cfgPayload(), "rz2cfg", cfgPayload());

  function setCheck(id, value) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return; }
    if (needPerson()) return;
    const next = { ...state.checks, [id]: value };
    if (!value) delete next[id];
    state.checks = next;
    state.month = { ...state.month, [state.date]: { checks: next, plan: state.dayPlan, snap: state.daySnap } };
    render();
    persistDay(state.date, { checks: { [id]: value } });
    // Letzter Punkt der Spätschicht heute erledigt → Tagesabschluss sichern.
    if (value && state.date === isoDate(new Date())) {
      const pr = progress(P(), "spaet", next);
      if (pr.total && pr.done === pr.total) autoBackup("day");
    }
  }

  // Übergabe aus dem Fenster speichern. Nur „Wichtig“ geändert → Zeitstempel bleibt (eine gelesene Übergabe bleibt gelesen).
  function saveNote(shift, text, important) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return; }
    const prev = state.notes[shift], t = String(text || "").slice(0, 4000);
    const same = prev && (prev.text || "") === t;
    const val = same ? { ...prev, important: !!important } : { text: t, by: actorId(), at: new Date().toISOString(), important: !!important };
    state.notes = { ...state.notes, [shift]: val };
    persistDay(state.date, { notes: { [shift]: val } });
    render();
  }

  // Übergabe an die Schicht key: Früh liest die Spät-Notiz vom Vortag, Spät die Früh-Notiz von heute.
  function handIn(key) {
    const n = key === "frueh" ? state.prevNotes.spaet : state.notes.frueh;
    return n && typeof n.text === "string" && n.text.trim() ? n : null;
  }
  function handRead(key, n = handIn(key)) {
    const r = state.read && state.read[key];
    return n && r && r.noteAt === n.at ? r : null;
  }
  function markHandRead(key, reply) {
    const n = handIn(key); if (!n) return;
    const txt = String(reply || "").trim().slice(0, 300);
    const val = { by: actorId(), at: new Date().toISOString(), noteAt: n.at, ...(txt ? { reply: txt } : {}) };
    state.read = { ...state.read, [key]: val };
    persistDay(state.date, { read: { [key]: val } });
  }
  // Nach jedem Einchecken: Übergabe der eigenen Schicht als Fenster – auch wenn keine hinterlassen wurde (dann ein kurzer Hinweis).
  function maybeShowHandover(role) {
    if (state.date !== isoDate(new Date())) return;
    const key = KEYS.includes(role) ? role : (activeShift(P(), timeCtx()) || focusShift(P(), nowMin()));
    if (key) { state.handPop = key; renderRemind(); }
  }

  // ---------- Personen ----------
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  function personName(id) {
    if (!id) return "";
    const p = state.cfg.people.find(x => x.id === id);
    if (p) return p.name;
    return state.names[id] || (id === myId ? "dir" : "");
  }
  function loadWho() { state.who = LS.get("rz2who", null); }
  // Aktive Person: heute eingecheckt (noch nicht ausgecheckt) und an diesem Gerät gewählt.
  function currentPerson() {
    const w = state.who, today = isoDate(new Date());
    if (!w || w.date !== today) return null;
    if (!openEntry(today, w.id)) return null;
    return state.cfg.people.find(p => p.id === w.id) || null;
  }
  // Schicht der eingecheckten Person (Früh/Spät, heute) – dann zeigt die Schicht-Ansicht nur diese.
  const lockedShift = () => currentPerson() && state.who && KEYS.includes(state.who.shift) && state.date === isoDate(new Date()) ? state.who.shift : null;
  const actorId = () => { const p = currentPerson(); return p ? p.id : (myId || null); };
  function rosterFor(date) { return state.cfg.roster[date] || { frueh: [], spaet: [] }; }
  // Abhaken braucht eine gewählte Person, sobald ein Team angelegt ist.
  function needPerson() {
    if (!state.cfg.people.length || currentPerson()) return false;
    if (state.viewOnly) pulseViewOnly(); else openPicker("login");
    return true;
  }
  // Alle heute Eingecheckten (offene Einträge), älteste zuerst.
  function presentPeople() {
    const today = isoDate(new Date());
    return Object.values(timeOf(today)).filter(e => e && !e.out).sort((a, b) => a.in.localeCompare(b.in))
      .map(e => ({ person: state.cfg.people.find(p => p.id === e.pid), entry: e })).filter(x => x.person)
      .filter((x, i, arr) => arr.findIndex(y => y.person.id === x.person.id) === i);
  }
  // Ist die aktive Person ausgecheckt, aber noch jemand da, übernimmt die zuletzt Eingecheckte.
  function ensureActive() {
    if (currentPerson()) return;
    const pres = presentPeople();
    if (pres.length) { const last = pres[pres.length - 1]; setActive(last.person.id, last.entry.role); }
  }

  // ---------- Zeiterfassung ----------
  // Ein Eintrag pro Einchecken im Tagesdokument (Tag des Beginns). Zeiten immer in 15-Minuten-Schritten.
  // Schlüssel „aushilfe“ bleibt wegen gespeicherter Daten, angezeigt wird „Sonstiges“.
  const ROLE_LABEL = { frueh: "Früh", spaet: "Spät", aushilfe: "Sonstiges" };
  const QUARTERS = Array.from({ length: 96 }, (_, i) => fmtMin(i * 15));
  const roundQ = (m) => Math.min(1425, Math.round(m / 15) * 15);
  function normTimes(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [id, e] of Object.entries(raw)) {
      if (!ID_RE.test(id) || !e || typeof e !== "object" || !ID_RE.test(e.pid || "") || !TIME_RE.test(e.in || "")) continue;
      out[id] = {
        pid: e.pid, role: ["frueh", "spaet", "aushilfe"].includes(e.role) ? e.role : "aushilfe", in: e.in,
        out: TIME_RE.test(e.out || "") ? e.out : null, pause: Number.isInteger(e.pause) && e.pause >= 0 && e.pause <= 600 ? e.pause : null,
        note: str(e.note, 200).trim(),
        ...(e.open && typeof e.open === "object" && str(e.open.reason, 300).trim() ? { open: { n: Number.isInteger(e.open.n) ? e.open.n : 0, reason: str(e.open.reason, 300).trim() } } : {}),
        at: typeof e.at === "string" ? e.at : null, editedAt: typeof e.editedAt === "string" ? e.editedAt : null,
        orig: e.orig && typeof e.orig === "object" ? { in: e.orig.in || null, out: e.orig.out || null, pause: Number.isInteger(e.orig.pause) ? e.orig.pause : null } : null,
      };
    }
    return out;
  }
  // Notiz der Zeiterfassung inkl. Grund, falls beim Auschecken Punkte offen blieben.
  const timeNote = (e) => [e.note, e.open ? `Offen gelassen (${e.open.n}): ${e.open.reason}` : ""].filter(Boolean).join(" · ");
  const timeOf = (date) => date === state.date ? state.time : ((state.month[date] && state.month[date].time) || (state.mode === "local" ? normTimes(LS.get("rz2:" + date, {}).time) : {}));
  function openEntry(date, pid) {
    const t = timeOf(date);
    const hit = Object.entries(t).find(([, e]) => e && e.pid === pid && !e.out);
    return hit ? { id: hit[0], date, entry: hit[1] } : null;
  }
  // Vergessenes Auschecken an früheren Tagen (aktueller Monat).
  function staleOpenEntries(pid, today) {
    const out = [];
    for (const [date, m] of Object.entries(state.month)) {
      if (date >= today || !m || !m.time) continue;
      for (const [id, e] of Object.entries(m.time)) if (e && e.pid === pid && !e.out) out.push({ id, date, entry: e });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function workedMin(e) {
    if (!e || !e.in || !e.out) return null;
    let d = toMin(e.out) - toMin(e.in);
    if (d < 0) d += 1440;
    return Math.max(0, d - (e.pause || 0));
  }
  const fmtHours = (m) => m === null || m === undefined ? "–" : `${Math.floor(m / 60)}:${pad(m % 60)}`;
  // Gesetzliche Mindestpause als Vorschlag: über 6 Std. 30 Min., über 9 Std. 45 Min.
  const suggestPause = (gross) => gross > 540 ? 45 : gross > 360 ? 30 : 0;
  function persistTime(date, id, entry) {
    if (date === state.date) {
      const t = { ...state.time }; if (entry) t[id] = entry; else delete t[id];
      state.time = t;
    }
    if (state.month[date] || date.slice(0, 7) === state.date.slice(0, 7)) {
      const m = state.month[date] || { checks: {}, plan: null, time: {} };
      const t = { ...(m.time || {}) }; if (entry) t[id] = entry; else delete t[id];
      state.month = { ...state.month, [date]: { ...m, time: t } };
    }
    if (state.timesData && state.timesData.ym === date.slice(0, 7)) {
      const d = { ...(state.timesData.days[date] || {}) }; if (entry) d[id] = entry; else delete d[id];
      state.timesData = { ...state.timesData, days: { ...state.timesData.days, [date]: d } };
    }
    if (state.mode !== "shared") {
      const doc = date === state.date ? currentDayDoc() : { ...LS.get("rz2:" + date, {}), month: date.slice(0, 7) };
      if (date !== state.date) { const t = { ...(doc.time || {}) }; if (entry) t[id] = entry; else delete t[id]; doc.time = t; }
      return persistDoc("days/" + date, null, null, "rz2:" + date, doc);
    }
    const full = date === state.date ? currentDayDoc() : { month: date.slice(0, 7), time: entry ? { [id]: entry } : {} };
    return persistDoc("days/" + date, { time: { [id]: entry } }, full, "rz2:" + date, full);
  }
  function rosterRole(date, pid) {
    const r = rosterFor(date);
    return r.frueh.includes(pid) ? "frueh" : r.spaet.includes(pid) ? "spaet" : null;
  }
  function plannedFor(date, pid, role) {
    if (!["frueh", "spaet"].includes(role) || !rosterFor(date)[role].includes(pid)) return null;
    const m = date === state.date ? { plan: state.dayPlan, snap: state.daySnap } : (state.month[date] || {});
    const pl = resolvePlan(date, m.plan || null, false, m.snap).plan[role];
    return `${pl.start}–${pl.end}`;
  }
  function timeSelect(id, value, opts2 = {}) {
    return `<span class="tsel"><button class="mini" data-tstep="${id}" data-dir="-1" aria-label="15 Minuten früher">‹</button><select id="${id}">${opts2.allowOpen ? `<option value=""${value ? "" : " selected"}>offen</option>` : ""}${QUARTERS.map(q => `<option${q === value ? " selected" : ""}>${q}</option>`).join("")}</select><button class="mini" data-tstep="${id}" data-dir="1" aria-label="15 Minuten später">›</button></span>`;
  }
  const pauseSelect = (id, value) => `<select id="${id}">${Array.from({ length: 13 }, (_, i) => i * 15).map(v => `<option value="${v}"${v === value ? " selected" : ""}>${v} Min.</option>`).join("")}</select>`;

  // ---------- Zeitlogik ----------
  function timeCtx() {
    const today = isoDate(new Date());
    if (state.date < today) return "past";
    if (state.date > today) return "future";
    return nowMin();
  }
  function phaseState(phase, ctx) {
    if (!phase.items.length) return "done";
    const open = phase.items.filter(i => !state.checks[i.id]).length;
    if (!open) return "done";
    if (ctx === "future") return "later";
    if (ctx === "past") return "late";
    if (ctx >= toMin(phase.to)) return "late";
    if (ctx >= toMin(phase.from)) return "now";
    return "later";
  }
  function activeShift(plan, ctx) {
    if (typeof ctx !== "number") return null;
    const f = plan.frueh, s = plan.spaet;
    if (ctx >= toMin(f.start) && ctx < toMin(f.end) && ctx < toMin(s.start)) return "frueh";
    if (ctx >= toMin(s.start) && ctx < toMin(s.end)) return "spaet";
    if (ctx >= toMin(f.start) && ctx < toMin(f.end)) return "frueh";
    return null;
  }
  function focusShift(plan, ctx) {
    const a = activeShift(plan, ctx);
    if (a) return a;
    if (typeof ctx === "number" && ctx >= toMin(plan.spaet.start)) return "spaet";
    return "frueh";
  }
  // Einträge einer Daueraufgabe, älteste zuerst. Ungültige/gelöschte (null) fallen raus.
  function logEntries(shift, id) {
    const m = state.logs[shift] && state.logs[shift][id];
    if (!m || typeof m !== "object") return [];
    return Object.entries(m)
      .filter(([, v]) => v && typeof v.at === "string" && !isNaN(new Date(v.at)))
      .map(([k, v]) => ({ key: k, at: v.at, by: v.by }))
      .sort((x, y) => x.at.localeCompare(y.at));
  }
  // Fälligkeit bei festem Rhythmus: Referenz = letzter Haken, sonst Schichtbeginn.
  function dueInfo(plan, shift, a, ctx) {
    if (a.kind !== "rhythm" || !a.every || typeof ctx !== "number" || activeShift(plan, ctx) !== shift) return null;
    const list = logEntries(shift, a.id);
    const last = list.length ? list[list.length - 1] : null;
    const ref = last ? (() => { const d = new Date(last.at); return d.getHours() * 60 + d.getMinutes(); })() : toMin(plan[shift].start);
    const due = ref + a.every;
    if (due >= toMin(plan[shift].end)) return { state: "ok", due: null };
    if (ctx < due) return { state: "ok", due };
    return { state: ctx >= due + Math.max(15, a.every / 2) ? "over" : "due", due };
  }
  function progress(plan, key, checks) {
    const ids = derive(plan).ids[key];
    const done = ids.filter(id => checks[id]).length;
    return { done, total: ids.length, pct: ids.length ? Math.round(done / ids.length * 100) : 0 };
  }

  // ---------- Bausteine ----------
  const PILL = { now: '<span class="pill now">jetzt</span>', late: '<span class="pill late">offen</span>', done: '<span class="pill done">erledigt</span>', later: '<span class="pill later">später</span>' };

  function whoLine(c) {
    if (!c) return "";
    const name = personName(c.by);
    const time = fmtTime(c.at);
    return `${c.s === "na" ? "entfällt" : "erledigt"}${time ? " " + time : ""}${name ? " · " + esc(name) : ""}`;
  }

  function itemHtml(item, opts = {}) {
    const c = state.checks[item.id];
    const flag = !c && state.coFlag === item.shift && state.date === isoDate(new Date());
    const cls = [item.important ? "important" : "", c ? (c.s === "na" ? "na" : "done") : "", opts.upcoming ? "upcoming" : "", flag ? "flag" : ""].join(" ");
    const tag = (opts.showPhase ? `<span class="tag">${esc(item.phase.title)} · bis ${item.phase.to}</span>` : "") + (item.remind && (!c || item.remindAlways) ? `<span class="remtag" title="${item.remindAlways ? "Erinnerung als Popup, auch wenn schon erledigt" : "Erinnerung als Popup"}">${BELL_SVG}${esc(item.remind)}</span>` : "");
    // „entfällt“ sperrt den Haken für diesen Tag; nur „rückgängig“ gibt ihn wieder frei.
    const na = !!c && c.s === "na";
    return `<li class="${cls}">
      <button class="check" data-id="${esc(item.id)}" aria-pressed="${c && c.s === "done" ? "true" : "false"}"${na ? ' disabled aria-disabled="true" title="Entfällt heute – zum Abhaken erst „rückgängig“ tippen"' : ""}>
        <span class="box">${na ? "" : CHECK_SVG}</span>
        <span class="txt"><span class="label">${esc(item.t)}</span>${tag}${item.s ? `<span class="sub">${esc(item.s)}</span>` : ""}${c ? `<span class="who">${whoLine(c)}</span>` : ""}</span>
      </button>
      ${checkinsOn() && /check-?ins?\b/i.test(item.t) ? `<button class="golink" data-goview="erstattung" title="Check-ins öffnen">Check-ins ›</button>` : ""}
      ${item.optional ? `<button class="skip" data-skip="${esc(item.id)}" aria-pressed="${na}" ${na ? 'aria-label="Entfällt rückgängig machen"' : ""}>${na ? "rückgängig" : "entfällt"}</button>` : ""}
    </li>`;
  }

  const pendingConfirms = (plan, key) => plan.always[key].filter(a => a.kind === "confirm" && !logEntries(key, a.id).length);
  function alwaysHtml(plan, key, ctx) {
    const list = plan.always[key];
    if (!list.length) return `<div class="empty">Keine Daueraufgaben.</div>`;
    const canLog = typeof ctx === "number";
    const lastLine = (last) => { if (!last) return ""; const n = personName(last.by); return `${fmtTime(last.at)}${n ? " · " + esc(n) : ""}`; };
    // Übersicht: sichtbar ist nur, was jetzt zählt (fällige Rundgänge, offene Pflicht); der Rest steckt in einer aufklappbaren Zeile.
    const open = state.sideOpen;
    const rhythmL = list.filter(a => a.kind === "rhythm").map(a => {
      const entries = logEntries(key, a.id), last = entries[entries.length - 1];
      const info = canLog ? dueInfo(plan, key, a, ctx) : null;
      let sub = a.every % 60 === 0 ? (a.every === 60 ? "1× pro Stunde" : `alle ${a.every / 60} Std.`) : `alle ${a.every} Min.`;
      if (info && info.due !== null) sub += info.state === "ok" ? ` · nächster um <b>${fmtMin(info.due)}</b>` : ` · <b>fällig seit ${fmtMin(info.due)}</b>`;
      return { show: !!(info && info.state !== "ok"), html: `<li class="${[a.important ? "important" : "", info ? info.state : ""].join(" ")}">
        <button class="tap" data-log="${esc(a.id)}" data-shift="${key}" ${canLog ? "" : 'disabled title="Nur am heutigen Tag"'} aria-label="${esc(a.t)} erledigt – eintragen">
          <span class="ic" aria-hidden="true">${LOOP_SVG}</span>
          <span><span class="label">${esc(a.t)}</span><span class="sub">${sub}</span>${last ? `<span class="last">zuletzt ${lastLine(last)}</span>` : ""}</span>
          <span class="cnt${entries.length ? "" : " zero"}" title="heute in dieser Schicht">${entries.length}×</span>
        </button>
        ${last && canLog ? `<button class="undo" data-unlog="${esc(a.id)}" data-shift="${key}" aria-label="Letzten Eintrag zurücknehmen">↶</button>` : ""}
      </li>` };
    });
    const confirmL = list.filter(a => a.kind === "confirm").map(a => {
      const entries = logEntries(key, a.id), last = entries[entries.length - 1];
      return { show: !last, html: `<li class="confirm ${last ? "ok" : "open"}${a.important ? " important" : ""}${!last && state.coFlag === key && state.date === isoDate(new Date()) ? " flag" : ""}">
        <button class="tap" data-log="${esc(a.id)}" data-shift="${key}" ${canLog && !last ? "" : "disabled"} aria-label="${esc(a.t)} bestätigen">
          <span class="box" aria-hidden="true">${CHECK_SVG}</span>
          <span><span class="label">${esc(a.t)}</span>${last ? `<span class="last">bestätigt ${lastLine(last)}</span>` : `<span class="sub">${a.s ? esc(a.s) + " · " : ""}vor Schichtende bestätigen</span>`}</span>
        </button>
        ${last && canLog ? `<button class="undo" data-unlog="${esc(a.id)}" data-shift="${key}" aria-label="Bestätigung zurücknehmen">↶</button>` : ""}
      </li>` };
    });
    const hint = list.filter(a => a.kind === "hint").map(a => `<li class="${a.important ? "important" : ""}"><span class="label">${esc(a.t)}</span>${a.s ? ` <span class="sub">${esc(a.s)}</span>` : ""}</li>`).join("");
    const more = (kind, n, text) => n ? `<li class="more"><button class="morebtn" data-sideopen="${kind}" aria-expanded="${open.has(kind)}">${open.has(kind) ? "weniger anzeigen" : text} <span aria-hidden="true">${open.has(kind) ? "‹" : "›"}</span></button></li>` : "";
    const part = (items, kind, text) => {
      const vis = items.filter(x => x.show || open.has(kind)), hidden = items.length - items.filter(x => x.show).length;
      return vis.map(x => x.html).join("") + more(kind, hidden, text(hidden));
    };
    const rhythm = part(rhythmL, "rhythm", n => `${n} weitere im Takt`);
    const confirm = part(confirmL, "confirm", n => `✓ ${n} bestätigt`);
    const hintN = list.filter(a => a.kind === "hint").length;
    return `${rhythm ? `<div class="sublabel">Regelmäßig</div><ul class="always">${rhythm}</ul>` : ""}
      ${confirm ? `<div class="sublabel">Pflicht · einmal pro Schicht bestätigen</div><ul class="always">${confirm}</ul>` : ""}
      ${hint ? `<div class="sublabel">Im Blick behalten</div>${open.has("hint") ? `<ul class="hints">${hint}</ul>` : ""}<ul class="always">${more("hint", hintN, `${hintN} ${hintN === 1 ? "Hinweis" : "Hinweise"} anzeigen`)}</ul>` : ""}`;
  }

  // Jeder Tipp = neuer Eintrag unter eigenem Schlüssel; gleichzeitige Tipps verschiedener Geräte überschreiben sich nicht.
  function logAlways(shift, id) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return; }
    if (needPerson()) { state.remindOpen = false; renderRemind(); return; }
    const k = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const val = { at: new Date().toISOString(), by: actorId() };
    const sh = { ...(state.logs[shift] || {}) };
    sh[id] = { ...(sh[id] || {}), [k]: val };
    state.logs = { ...state.logs, [shift]: sh };
    render();
    persistDay(state.date, { logs: { [shift]: { [id]: { [k]: val } } } });
  }
  function unlogAlways(shift, id) {
    if (state.readOnly) return;
    const list = logEntries(shift, id);
    if (!list.length) return;
    const k = list[list.length - 1].key;
    const sh = { ...(state.logs[shift] || {}) };
    sh[id] = { ...(sh[id] || {}), [k]: null };
    state.logs = { ...state.logs, [shift]: sh };
    render();
    persistDay(state.date, { logs: { [shift]: { [id]: { [k]: null } } } });
  }

  function noteAuthor(n) {
    if (!n || !n.at) return "";
    const name = personName(n.by);
    return ` · ${fmtTime(n.at)}${name ? " · " + esc(name) : ""}`;
  }
  function readLine(r) {
    const name = personName(r.by);
    return `Gelesen ${fmtTime(r.at)}${name ? " · " + esc(name) : ""}`;
  }
  // Eigene Übergabe: kompakt als Vorschau, geschrieben wird im Fenster (state.notePop).
  function noteEditor(shift, label) {
    const n = state.notes[shift], has = !!(n && n.text && n.text.trim());
    // Lesebestätigung der Spätschicht sieht die Frühschicht noch am selben Tag; die Spät-Notiz liest erst morgen jemand.
    const r = shift === "frueh" ? handRead("spaet") : null;
    const canEdit = !state.readOnly && !(state.viewOnly && !currentPerson());
    return `<div class="note"><div class="nhead"><label>${n && n.important ? '<span class="imptag">Wichtig</span> ' : ""}${esc(label)}</label>${canEdit && has ? `<button class="btn sm" data-noteedit="${shift}">Bearbeiten</button>` : ""}</div>
      ${has ? `<div class="read mine${n.important ? " imp" : ""}">${esc(n.text)}</div>` : `<button class="notebtn" data-noteedit="${shift}" ${canEdit ? "" : "disabled"}>+ Übergabe schreiben</button>`}
      <span class="saved">${has && n.at ? "Gespeichert" + noteAuthor(n) : ""}${r ? ` · <b class="okread">✓ ${readLine(r)}</b>` : ""}</span>${r && r.reply ? `<div class="reply">Rückmeldung: ${esc(r.reply)}</div>` : ""}</div>`;
  }
  function noteReader(key, label) {
    const n = handIn(key), r = n && handRead(key, n), wasRead = n && state.read && state.read[key];
    const canMark = n && !r && state.date === isoDate(new Date()) && !state.readOnly;
    const foot = !n ? "" : r ? `<div class="rfoot"><b class="okread">✓ ${readLine(r)}</b></div>${r.reply ? `<div class="reply">Rückmeldung: ${esc(r.reply)}</div>` : ""}`
      : `<div class="rfoot"><span>${wasRead ? "Nach dem Lesen geändert" : "Noch nicht gelesen"}</span>${canMark ? `<button class="btn primary sm" data-hread="${key}">Gelesen</button>` : ""}</div>`;
    return `<div class="note"><label>${n && n.important ? '<span class="imptag">Wichtig</span> ' : ""}${esc(label)}${n ? noteAuthor(n) : ""}</label>
      <div class="read${n ? (n.important && !r ? " imp" : "") : " none"}">${n ? esc(n.text) : "Keine Notiz hinterlassen."}</div>${foot}</div>`;
  }
  function handoverHtml(key) {
    return key === "frueh"
      ? noteReader("frueh", "Von der Spätschicht (gestern)") + noteEditor("frueh", "Für die Spätschicht")
      : noteReader("spaet", "Von der Frühschicht") + noteEditor("spaet", "Für die Frühschicht morgen");
  }

  function dutyLine(date) {
    const r = rosterFor(date);
    const names = (k) => (r[k].map(personName).filter(Boolean).join(", ") || "–") + (r.notes && r.notes[k] ? ` (${r.notes[k]})` : "");
    if (!state.cfg.people.length) return `<div class="duty">Team und Dienstplan unter <b>Verwaltung</b> anlegen.</div>`;
    return `<div class="duty"><span>Dienst Früh: <b>${esc(names("frueh"))}</b></span><span>Spät: <b>${esc(names("spaet"))}</b></span></div>`;
  }

  // ---------- Schicht (eine Ansicht für Früh und Spät) ----------
  // Links der Fahrplan der gewählten Schicht, rechts Immer im Blick, Dienst und Übergabe.
  function renderSchicht() {
    const plan = P(), ctx = timeCtx(), d = derive(plan);
    const cp = currentPerson(), role = lockedShift();
    // Eingecheckt als Früh oder Spät: nur die eigene Schicht, kein Umschalten (sonst verwirrend).
    const auto = role || focusShift(plan, ctx), key = role || state.shiftSel || auto, s = plan[key], meta = SHIFT_META[key];
    const MARK = { done: "✓", now: "▶", late: "!", later: "" };
    const stops = s.phases.map(p => {
      const st = phaseState(p, ctx);
      const done = p.items.filter(i => state.checks[i.id]).length;
      // Übersicht: offen sind nur der laufende und überfällige Abschnitte (und nach „Zurück zur Schicht“ alle mit offenen Punkten);
      // erledigte und spätere sind eine Zeile zum Aufklappen.
      const flagged = state.coFlag === key && done < p.items.length;
      const foldable = st === "done" || st === "later";
      const collapsed = foldable && !flagged && !state.expanded.has(p.id);
      const label = { done: "erledigt", now: "jetzt", late: "offen", later: "später" }[st];
      const count = st === "later" && collapsed ? `${p.items.length} ${p.items.length === 1 ? "Aufgabe" : "Aufgaben"}` : `${done}/${p.items.length}`;
      const head = `<span class="mark" aria-hidden="true">${MARK[st]}</span><span class="time">${p.from}–${p.to}</span><span class="ttl">${esc(p.title)}<small>${count}</small></span>${PILL[st]}`;
      const headEl = foldable
        ? `<button class="stop-head" data-toggle="${esc(p.id)}" aria-expanded="${!collapsed}" aria-label="${esc(p.title)}, ${label}, ${collapsed ? "aufklappen" : "zuklappen"}">${head}</button>`
        : `<div class="stop-head">${head}</div>`;
      const hint = p.hint && (st === "now" || st === "late") ? `<div class="phint">${esc(p.hint)}</div>` : "";
      const items = collapsed ? "" : `<ul class="items">${p.items.map(i => itemHtml(d.item[i.id])).join("") || '<li class="empty">Keine Aufgaben.</li>'}</ul>`;
      return `<section class="stop is-${st}" id="phase-${esc(p.id)}">${headEl}${hint}${items}</section>`;
    }).join("") || `<div class="empty">Für diese Schicht sind keine Abschnitte geplant (Verwaltung › Aufgaben-Plan).</div>`;
    const other = key === "frueh" ? "spaet" : "frueh";
    const otherOpen = plan[other].phases.filter(p => phaseState(p, ctx) === "late").reduce((n, p) => n + p.items.filter(i => !state.checks[i.id]).length, 0)
      + (typeof ctx === "number" && toMin(plan[other].end) <= ctx ? pendingConfirms(plan, other).length : 0);
    const pr = progress(plan, key, state.checks);
    const seg = KEYS.map(k => `<button class="segbtn${k === key ? " on" : ""}" data-shiftsel="${k}" aria-pressed="${k === key}">${SHIFT_META[k].short}${k === auto && typeof ctx === "number" && activeShift(plan, ctx) === k ? " ·&nbsp;jetzt" : ""}</button>`).join("");
    const title = ctx === "past" ? "Rückblick" : ctx === "future" ? "Vorschau" : "Fahrplan";
    const lay = getLayout();
    // Ungelesene Übergabe: Leiste über dem Fahrplan, bis die eingecheckte Person sie als gelesen markiert.
    const hb = state.date === isoDate(new Date()) && cp && !state.readOnly ? handIn(key) : null;
    const banner = hb && !handRead(key, hb) ? `<div class="handbar${hb.important ? " imp" : ""}"><span class="imptag">Übergabe</span><span class="htxt"><b>${key === "frueh" ? "Von der Spätschicht" : "Von der Frühschicht"}:</b> ${esc(hb.text)}</span><button class="btn" data-hopen="${key}">Öffnen</button><button class="btn primary" data-hread="${key}">Gelesen</button></div>` : "";
    if (state.coFlag === key && !shiftOpenList(key).items.length && !shiftOpenList(key).confirms.length) state.coFlag = null;
    return `${banner}<div class="schicht cols-1" style="--side:${lay.side}px">
      <section class="card boardcard">
        <div class="chead"><h2>${title} ${meta.label}</h2><span class="hint">${s.start}–${s.end} · ${pr.done}/${pr.total} erledigt</span>${role ? "" : `<div class="seg" role="group" aria-label="Schicht wählen">${seg}</div>`}</div>
        <div class="bar flat"><i style="width:${pr.pct}%"></i></div>
        ${otherOpen ? (role ? `<div class="othersum">${SHIFT_META[other].label}: <b>${otherOpen} offen geblieben</b></div>` : `<button class="othersum" data-shiftsel="${other}">${SHIFT_META[other].label}: <b>${otherOpen} offen geblieben</b> – ansehen</button>`) : ""}
        <div class="cbody board"><div class="board-in">${stops}</div></div>
      </section>
      <div class="splitter" data-split="side" role="separator" aria-orientation="vertical" aria-label="Spaltenbreite – ziehen oder Pfeiltasten, Doppelklick setzt zurück" tabindex="0" title="Ziehen zum Anpassen · Doppelklick = Standard"></div>
      <div class="side${lay.hand ? " has-hand" : ""}"${lay.hand ? ` style="--hand:${lay.hand}px"` : ""}>
        <section class="card grow"><div class="chead"><h2>Immer im Blick</h2><span class="hint">${meta.label}</span></div><div class="cbody">${alwaysHtml(plan, key, ctx)}</div></section>
        <div class="hsplit" data-split="hand" role="separator" aria-orientation="horizontal" aria-label="Höhe von Dienst und Übergabe – ziehen oder Pfeiltasten, Doppelklick setzt zurück" tabindex="0" title="Ziehen zum Anpassen · Doppelklick = Standard"></div>
        <section class="card hand"><div class="chead"><h2>Dienst &amp; Übergabe</h2></div><div class="cbody">${dutyLine(state.date)}${handoverHtml(key)}</div></section>
      </div>
    </div>`;
  }

  // Breite der rechten Spalte und Höhe von „Dienst & Übergabe“, gespeichert pro Person (sonst „Standard“) im Browser-Speicher des Geräts.
  // hand = Höhe der Karte „Dienst & Übergabe“ in px, null = so hoch wie der Inhalt.
  const LAYOUT_DEFAULT = { side: 420, hand: null };
  const clampSide = (v) => Math.min(900, Math.max(280, Math.round(v)));
  const clampHand = (v) => Math.min(1200, Math.max(120, Math.round(v)));
  const layoutKey = () => { const p = currentPerson(); return p ? p.id : "_"; };
  function getLayout() {
    const all = LS.get("rz2layout", {}), l = (all && all[layoutKey()]) || (all && all._) || {};
    return {
      side: Number.isFinite(l.side) ? clampSide(l.side) : LAYOUT_DEFAULT.side,
      hand: Number.isFinite(l.hand) ? clampHand(l.hand) : LAYOUT_DEFAULT.hand,
    };
  }
  function saveLayout(patch) {
    const all = LS.get("rz2layout", {}) || {}, key = layoutKey();
    all[key] = { ...getLayout(), ...patch };
    LS.set("rz2layout", all);
  }
  let drag = null;
  // Trennlinien ziehen: data-split="side" (Breite rechte Spalte) oder "hand" (Höhe Dienst & Übergabe).
  function startDrag(e, el) {
    const kind = el.dataset.split, wrap = el.closest(kind === "hand" ? ".side" : ".schicht"); if (!wrap) return;
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    drag = { kind, value: null };
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      if (kind === "hand") {
        drag.value = Math.round(Math.min(rect.height - 140, Math.max(120, rect.bottom - ev.clientY - 6)));
        wrap.classList.add("has-hand"); wrap.style.setProperty("--hand", drag.value + "px");
      } else {
        drag.value = Math.round(Math.min(rect.width - 380, Math.max(280, rect.right - ev.clientX - 6)));
        wrap.style.setProperty("--side", drag.value + "px");
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (drag && drag.value != null) saveLayout({ [drag.kind]: drag.value });
      drag = null;
      if (renderPending) render();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ---------- Monat ----------
  function renderMonth() {
    const d = parseIso(state.date), y = d.getFullYear(), m = d.getMonth();
    const days = new Date(y, m + 1, 0).getDate(), today = isoDate(new Date());
    const head = Array.from({ length: days }, (_, i) => `<th scope="col">${pad(i + 1)}.</th>`).join("");
    const row = (key) => Array.from({ length: days }, (_, i) => {
      const date = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
      const entry = date === state.date ? { checks: state.checks, plan: state.dayPlan, snap: state.daySnap } : (state.month[date] || { checks: {}, plan: null });
      const plan = resolvePlan(date, entry.plan, false, entry.snap).plan;
      const p = progress(plan, key, entry.checks || {});
      const cls = date > today && !p.done ? "future" : p.pct === 100 ? "full" : p.done ? "part" : "none";
      const text = p.done ? (p.pct === 100 ? "✓" : p.pct + "%") : "·";
      return `<td><button class="mcell ${cls}${date === state.date ? " sel" : ""}" data-date="${date}" data-shift="${key}" aria-label="${SHIFT_META[key].label} ${pad(i + 1)}.${pad(m + 1)}.: ${p.done} von ${p.total}">${text}</button></td>`;
    }).join("");
    return `<div class="monthhead">
        <button class="iconbtn" id="mprev" aria-label="Vorheriger Monat">‹</button>
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="iconbtn" id="mnext" aria-label="Nächster Monat">›</button>
      </div>
      <div class="mscroll"><table class="mgrid">
        <thead><tr><th class="rowh"></th>${head}</tr></thead>
        <tbody><tr><th class="rowh" scope="row">Früh</th>${row("frueh")}</tr><tr><th class="rowh" scope="row">Spät</th>${row("spaet")}</tr></tbody>
      </table></div>
      <div class="legend"><span><i class="lg-full"></i>vollständig</span><span><i class="lg-part"></i>teilweise</span><span>Tippe auf einen Tag, um ihn zu öffnen.</span></div>`;
  }

  // ---------- Dienstplan ----------
  function mondayOf(iso) { const d = parseIso(iso); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return isoDate(d); }
  function renderRoster() {
    const ym = state.rosterMonth || state.date.slice(0, 7);
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7;
    const today = isoDate(new Date()), edit = state.rosterEdit && isUnlocked();
    const line = (entry, k) => {
      const names = entry[k].map(personName).filter(Boolean).join(", ");
      const nt = entry.notes && entry.notes[k] ? entry.notes[k] : "";
      const note = nt ? ` <em>${esc(nt)}</em>` : "";
      return `<div class="rl" data-hay="${esc(`${names} ${nt}`.toLowerCase())}"${nt ? ` title="${esc(nt)}"` : ""}><b>${k === "frueh" ? "F" : "S"}</b><span class="${names ? "" : "gap"}">${names ? esc(names) : "–"}${note}</span></div>`;
    };
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<div class="rc blank"></div>`);
    for (let day = 1; day <= daysIn; day++) {
      const date = `${ym}-${pad(day)}`, entry = rosterFor(date), wd = new Date(y, m - 1, day).getDay();
      const cls = ["rc", date === today ? "today" : "", wd === 0 || wd === 6 ? "we" : "", date === state.date ? "sel" : ""].join(" ");
      const inner = `<div class="rd">${day}.</div>${line(entry, "frueh")}${line(entry, "spaet")}`;
      cells.push(edit ? `<button class="${cls}" data-rday="${date}" aria-label="${day}. bearbeiten">${inner}</button>` : `<div class="${cls}">${inner}</div>`);
    }
    const dayEditor = edit && state.rosterDay ? (() => {
      const date = state.rosterDay, entry = rosterFor(date), dd = parseIso(date);
      const chips = (k) => state.cfg.people.map(p => `<button class="chip${entry[k].includes(p.id) ? "" : " off"}" data-roster="${date}" data-shift="${k}" data-pid="${esc(p.id)}" aria-pressed="${entry[k].includes(p.id)}">${esc(p.name)}</button>`).join("") || '<span class="empty">Kein Team angelegt</span>';
      return `<div class="overlay inmain" role="dialog" aria-modal="true"><div class="dialog">
        <h2>${WD[dd.getDay()]}, ${pad(dd.getDate())}.${pad(dd.getMonth() + 1)}.</h2>
        ${KEYS.map(k => `<div class="grp">${SHIFT_META[k].label}${entry.times && entry.times[k] ? " · " + esc(entry.times[k].replace("-", "–")) : ""}</div><div class="cell">${chips(k)}</div>
          <label class="rnote">Notiz <input class="in" data-rnote="${date}" data-shift="${k}" maxlength="80" value="${esc((entry.notes && entry.notes[k]) || "")}" placeholder="optional"></label>`).join("")}
        <div class="row"><button class="btn primary" data-act2="rday-close">Fertig</button></div>
      </div></div>`;
    })() : "";
    return `<div class="monthhead">
        <button class="iconbtn" id="mrprev" aria-label="Vorheriger Monat">‹</button>
        <h2>Dienstplan ${MONTHS[m - 1]} ${y}</h2>
        <button class="iconbtn" id="mrnext" aria-label="Nächster Monat">›</button>
        ${edit ? `<label class="btn" for="rzfile" data-filepick="plan">Monatsplan einlesen (PDF/Excel)</label><button class="btn primary" data-act2="roster-done">Fertig</button>`
               : `<button class="btn" data-act2="roster-edit">Bearbeiten</button>`}
      </div>
      ${edit ? renderImportPreview() : ""}
      <div class="rfind"><label>Hervorheben <input class="in" id="rhi" list="rhi-list" value="${esc(state.rosterHi)}" placeholder="Name eingeben" autocomplete="off"></label>
        <datalist id="rhi-list">${state.cfg.people.map(p => `<option value="${esc(p.name)}">`).join("")}</datalist>
        ${state.rosterHi ? `<button class="btn ghost sm" data-act2="rhi-clear">×</button>` : ""}<span id="rhicount" class="hint"></span></div>
      <div class="rcal">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(w => `<div class="rh">${w}</div>`).join("")}${cells.join("")}</div>
      <div class="legend">${edit ? "Tag antippen, um die Einteilung zu ändern." : `F = Frühschicht, S = Spätschicht.${pinOff() ? "" : " Bearbeiten braucht die Leitungs-PIN."}`}</div>
      ${dayEditor}`;
  }
  // Tage einer Person hervorheben: Treffer am Wortanfang in Namen und Notiz („ar“ → Arne, nicht Marc).
  function applyRosterHi() {
    const cal = root.querySelector(".rcal"); if (!cal) return;
    const q = state.rosterHi.trim().toLowerCase();
    const re = q ? new RegExp("(^|[^\\p{L}])" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u") : null;
    let days = 0; const per = { F: 0, S: 0 };
    cal.querySelectorAll(".rc:not(.blank)").forEach(c => {
      let any = false;
      c.querySelectorAll(".rl").forEach(l => {
        const hit = !!re && re.test(l.dataset.hay || "");
        l.classList.toggle("hit", hit);
        if (hit) { any = true; per[l.querySelector("b").textContent]++; }
      });
      if (any) days++;
      c.classList.toggle("hit", any); c.classList.toggle("dim", !!re && !any);
    });
    const cnt = $("rhicount");
    if (cnt) cnt.textContent = re ? `${days} Tag${days === 1 ? "" : "e"} · Früh ${per.F} · Spät ${per.S}` : "";
  }
  function setRosterNote(date, shift, text) {
    const cur = rosterFor(date), notes = { ...(cur.notes || {}) }, t = String(text || "").trim().slice(0, 80);
    if ((notes[shift] || "") === t) return;
    if (t) notes[shift] = t; else delete notes[shift];
    const entry = { ...cur, notes };
    state.cfg = { ...state.cfg, roster: { ...state.cfg.roster, [date]: entry } };
    // Leeres Objekt statt fehlendem Feld, damit der Merge eine gelöschte Notiz wirklich entfernt.
    persistCfg({ roster: { [date]: { ...entry, notes: { frueh: notes.frueh || null, spaet: notes.spaet || null } } } });
    // Kein render(): change feuert beim Klick auf „Fertig“ (Blur) – ein Neuaufbau würde diesen Klick verschlucken.
    // Der Kalender aktualisiert sich beim Schließen des Fensters.
  }
  function toggleRoster(date, shift, pid) {
    const cur = rosterFor(date);
    const ids = cur[shift].includes(pid) ? cur[shift].filter(x => x !== pid) : [...cur[shift], pid];
    const entry = { ...cur, [shift]: ids };
    state.cfg = { ...state.cfg, roster: { ...state.cfg.roster, [date]: entry } };
    render();
    persistCfg({ roster: { [date]: entry } });
  }

  // ---------- Monats-Arbeitsplan einlesen (PDF oder Excel) ----------
  // Aufbau (Kopfzeile): OKT | Tag | Vormittags | Uhrzeit | Anmerkung | Nachmittags/Abends | Uhrzeit | Anmerkung.
  // Pro Tag stehen die Namen in „Vormittags“ bzw. „Nachmittags/Abends“. Anmerkungen werden nur angezeigt.
  // Zuordnung über die Spaltenposition der Kopfzeile (PDF: x-Koordinate, Excel: Spaltenbuchstabe).
  const MONTH_NAMES = ["jan", "feb", "mär|mar|maer", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];
  // pdf.js: Mac-App lokal, Webversion aus der mitveröffentlichten Kopie (pdfjs/ neben index.html), SharePoint von jsDelivr.
  const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs";
  // jsDelivr nur im SharePoint-Betrieb (dort liegt keine eigene Kopie); Mac-App und Webversion laden nichts von fremden Servern.
  const PDFJS_CANDIDATES = [opts.pdfjsUrl, NATIVE && NATIVE.pdfjsUrl, (() => { try { return new URL("pdfjs/pdf.min.mjs", document.baseURI).href; } catch { return null; } })(), opts.mode === "sharepoint" ? PDFJS_CDN : null].filter(Boolean);
  const TIME_RANGE = /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/;
  async function unzipEntries(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Keine gültige Excel-Datei");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = u8.subarray(start, start + csize);
      if (method === 0) out[name] = new TextDecoder().decode(data);
      else if (method === 8) out[name] = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    }
    return out;
  }
  // Ergebnis beider Leser: Zeilen als Liste von { pos, text } (pos = Spaltennummer bzw. x-Koordinate).
  async function xlsxRows(file) {
    const files = await unzipEntries(await file.arrayBuffer());
    const xml = (t) => new DOMParser().parseFromString(t, "application/xml");
    const shared = files["xl/sharedStrings.xml"] ? [...xml(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map(si => [...si.getElementsByTagName("t")].map(t => t.textContent).join("")) : [];
    const sheetName = Object.keys(files).filter(n => n.startsWith("xl/worksheets/")).sort()[0];
    if (!sheetName) throw new Error("Kein Tabellenblatt gefunden");
    const colNum = (ref) => { let n = 0; for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
    const rows = [];
    for (const r of xml(files[sheetName]).getElementsByTagName("row")) {
      const cells = [];
      for (const c of r.getElementsByTagName("c")) {
        const v = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0], t = c.getAttribute("t");
        let val = t === "s" && v ? shared[Number(v.textContent)] : t === "inlineStr" && is ? is.textContent : v ? v.textContent : "";
        if (!t && val && /^0?\.\d+$/.test(val)) { const m = Math.round(Number(val) * 1440); val = `${Math.floor(m / 60)}:${pad(m % 60)}`; }
        val = String(val ?? "").trim();
        if (val) cells.push({ pos: colNum(c.getAttribute("r") || "A"), text: val });
      }
      rows.push(cells);
    }
    return { rows, tolerance: 0 };
  }
  async function pdfRows(file) {
    let lib, src, lastErr;
    for (const url of PDFJS_CANDIDATES) {
      try { lib = await import(/* webpackIgnore: true */ url); src = url; break; } catch (e) { lastErr = e; }
    }
    if (!lib) throw new Error("PDF-Leser konnte nicht geladen werden (" + ((lastErr && lastErr.message) || "unbekannt") + "). Die Excel-Datei des Plans funktioniert immer.");
    lib.GlobalWorkerOptions.workerSrc = src.replace(/pdf\.min\.mjs$/, "pdf.worker.min.mjs");
    // Außerhalb der Mac-App (claude.ai, SharePoint) darf die Seite oft keinen Worker von fremder Adresse starten.
    // pdf.js nutzt dann den hier geladenen Worker-Code direkt in der Seite (für Monatspläne schnell genug).
    if (!NATIVE && !globalThis.pdfjsWorker) {
      try { globalThis.pdfjsWorker = await import(/* webpackIgnore: true */ lib.GlobalWorkerOptions.workerSrc); } catch { /* dann normaler Worker */ }
    }
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const items = (await (await doc.getPage(i)).getTextContent()).items.filter(it => it.str && it.str.trim());
      const lines = [];
      for (const it of items) {
        const y = it.transform[5];
        let line = lines.find(l => Math.abs(l.y - y) < 3);
        if (!line) { line = { y, cells: [] }; lines.push(line); }
        line.cells.push({ pos: it.transform[4], text: it.str.trim() });
      }
      lines.sort((a, b) => b.y - a.y).forEach(l => rows.push(l.cells.sort((a, b) => a.pos - b.pos)));
    }
    return { rows, tolerance: 6 };
  }
  // Kopfzeile suchen und Spalten bestimmen.
  function findColumns(rows) {
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i];
      const iE = cells.findIndex(c => /vormit/i.test(c.text)), iL = cells.findIndex(c => /nachmit/i.test(c.text));
      if (iE < 0 || iL < 0) continue;
      const cols = { header: i, month: cells[0] ? cells[0].text : "" };
      const after = (from, re) => cells.findIndex((c, j) => j > from && re.test(c.text));
      cols.day = (cells.find(c => /^tag$/i.test(c.text)) || {}).pos;
      cols.nameE = cells[iE].pos; cols.nameL = cells[iL].pos;
      const tE = after(iE, /uhrzeit|zeit/i), nE = after(iE, /anmerk|notiz|bemerk/i);
      const tL = after(iL, /uhrzeit|zeit/i), nL = after(iL, /anmerk|notiz|bemerk/i);
      // Steht „Uhrzeit/Anmerkung“ des Nachmittags in einer zweiten Kopfzeile (umbrochener Text), dort suchen.
      const next = rows[i + 1] || [];
      const pick = (idx, re, minPos) => idx >= 0 ? cells[idx].pos : (next.find(c => re.test(c.text) && c.pos >= minPos) || {}).pos;
      cols.timeE = pick(tE >= 0 && (iL < 0 || tE < iL) ? tE : -1, /uhrzeit|zeit/i, cols.nameE);
      cols.noteE = pick(nE >= 0 && nE < iL ? nE : -1, /anmerk|notiz|bemerk/i, cols.nameE);
      cols.timeL = pick(tL, /uhrzeit|zeit/i, cols.nameL);
      cols.noteL = pick(nL, /anmerk|notiz|bemerk/i, cols.nameL);
      return cols;
    }
    return null;
  }
  function parsePlan(data) {
    const cols = findColumns(data.rows);
    if (!cols) throw new Error("Kopfzeile mit „Vormittags“ und „Nachmittags“ nicht gefunden.");
    // Spaltengrenzen: jede Zelle gehört zur Kopf-Spalte mit der größten Startposition ≤ Zellposition.
    const bounds = Object.entries({ day: cols.day, nameE: cols.nameE, timeE: cols.timeE, noteE: cols.noteE, nameL: cols.nameL, timeL: cols.timeL, noteL: cols.noteL })
      .filter(([, v]) => typeof v === "number").sort((a, b) => a[1] - b[1]);
    const colOf = (pos) => { let k = null; for (const [key, x] of bounds) if (pos + data.tolerance >= x) k = key; return k; };
    const out = [], seen = new Set();
    for (const cells of data.rows.slice(cols.header + 1)) {
      const rec = {};
      for (const c of cells) {
        let key = colOf(c.pos);
        // Name, der in die Uhrzeit-Spalte ragt („Nelson 15:30-23:00“): am Uhrzeit-Anfang trennen.
        if (key === "nameE" || key === "nameL" || key === "timeE" || key === "timeL") {
          const m = c.text.match(TIME_RANGE);
          if (m && m.index > 0) { const nk = key.endsWith("E") ? "nameE" : "nameL"; rec[nk] = ((rec[nk] || "") + " " + c.text.slice(0, m.index)).trim(); rec[nk === "nameE" ? "timeE" : "timeL"] = c.text.slice(m.index); continue; }
        }
        if (!key) { if (/^\d{1,2}$/.test(c.text) && rec.day === undefined) key = "day"; else continue; }
        rec[key] = ((rec[key] || "") + " " + c.text).trim();
      }
      const day = parseInt(rec.day, 10);
      if (!(day >= 1 && day <= 31) || seen.has(day)) continue;
      seen.add(day);
      const time = (t) => { const m = (t || "").match(TIME_RANGE); return m ? `${pad(Number(m[1]))}:${m[2]}-${pad(Number(m[3]))}:${m[4]}` : null; };
      const names = (t) => (t || "").split(/\s*(?:[,/&]|\bund\b)\s*/i).map(x => x.trim()).filter(x => x && !/^[-–]$/.test(x));
      const note = (t) => (t || "").replace(/^[`´'\s]+/, "").trim();
      out.push({ day, early: names(rec.nameE), late: names(rec.nameL), tEarly: time(rec.timeE), tLate: time(rec.timeL), noteEarly: note(rec.noteE), noteLate: note(rec.noteL) });
    }
    if (!out.length) throw new Error("In der Datei wurden keine Tageszeilen gefunden.");
    return { entries: out.sort((a, b) => a.day - b.day), monthHint: cols.month };
  }
  function guessMonth(text) {
    const t = String(text || "").toLowerCase();
    for (let i = 0; i < 12; i++) if (new RegExp("(^|[^a-zäöü])(" + MONTH_NAMES[i] + ")").test(t)) return i;
    return null;
  }
  const findPerson = (name) => {
    const lc = name.toLowerCase();
    return state.cfg.people.find(p => p.name.toLowerCase() === lc) || state.cfg.people.find(p => p.name.toLowerCase().split(/\s+/)[0] === lc);
  };
  async function readPlanFile(file) {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const { entries, monthHint } = parsePlan(isPdf ? await pdfRows(file) : await xlsxRows(file));
    const now = new Date();
    const month = guessMonth(monthHint) ?? guessMonth(file.name) ?? now.getMonth();
    let year = now.getFullYear();
    if (month - now.getMonth() > 6) year--; else if (now.getMonth() - month > 6) year++;
    const all = [...new Set(entries.flatMap(e => [...e.early, ...e.late]))];
    return { fileName: file.name, entries, month, year, unknown: all.filter(n => !findPerson(n)) };
  }
  function renderImportPreview() {
    const ip = state.importPreview;
    if (!ip) return "";
    if (ip.loading) return `<section class="card imp"><div class="chead"><h2>Arbeitsplan einlesen</h2></div><div class="cbody"><p><b>Lese ${esc(ip.fileName)} …</b> Das dauert ein paar Sekunden.</p></div></section>`;
    if (ip.error) return `<section class="card imp"><div class="chead"><h2>Arbeitsplan einlesen</h2></div><div class="cbody"><p class="err">${esc(ip.error)}</p><div class="row"><button class="btn" data-act2="import-cancel">Schließen</button></div></div></section>`;
    const daysIn = new Date(ip.year, ip.month + 1, 0).getDate();
    const valid = ip.entries.filter(e => e.day <= daysIn);
    const cell = (names, t, note) => `<td class="${names.length ? "on" : "gap"}">${names.length ? esc(names.join(", ")) : "unbesetzt"}${t ? `<span class="t">${esc(t.replace("-", "–"))}</span>` : ""}${note ? `<small>${esc(note)}</small>` : ""}</td>`;
    const rowsHtml = valid.map(e => {
      const d = new Date(ip.year, ip.month, e.day);
      return `<tr><th>${WD[d.getDay()].slice(0, 2)} ${pad(e.day)}.</th>${cell(e.early, e.tEarly, e.noteEarly)}${cell(e.late, e.tLate, e.noteLate)}</tr>`;
    }).join("");
    const gaps = valid.reduce((n, e) => n + (e.early.length ? 0 : 1) + (e.late.length ? 0 : 1), 0);
    return `<section class="card imp"><div class="chead"><h2>Monatsplan einlesen</h2><span class="hint">${esc(ip.fileName)}</span></div>
      <div class="cbody">
        <div class="impform">
          <label>Monat <select id="imp-month">${MONTHS.map((m, i) => `<option value="${i}"${i === ip.month ? " selected" : ""}>${m}</option>`).join("")}</select></label>
          <label>Jahr <input class="in time" id="imp-year" value="${ip.year}" inputmode="numeric" maxlength="4"></label>
        </div>
        <p>${valid.length} Tage erkannt${gaps ? ` · ${gaps} Schichten unbesetzt` : ""}. Beim Übernehmen ersetzt der Plan die Einteilung dieser Tage komplett, ebenso Schichtzeiten und Anmerkungen. Anmerkungen werden nur angezeigt.</p>
        ${ip.unknown.length ? `<p class="new">Neu im Team (werden angelegt): <b>${ip.unknown.map(esc).join(", ")}</b></p>` : ""}
        <div class="impscroll"><table class="imptab"><thead><tr><th></th><th>Vormittags</th><th>Nachmittags/Abends</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
        <div class="row"><button class="btn ghost" data-act2="import-cancel">Abbrechen</button><button class="btn primary" data-act2="import-apply">Übernehmen</button></div>
      </div></section>`;
  }
  async function applyImport() {
    const ip = state.importPreview;
    if (!ip || ip.error || ip.loading) return;
    // Unbekannte Namen als Teammitglieder anlegen.
    let people = state.cfg.people;
    const ids = {};
    for (const n of new Set(ip.entries.flatMap(e => [...e.early, ...e.late]))) {
      const p = findPerson(n) || people.find(x => x.name.toLowerCase() === n.toLowerCase());
      if (p) ids[n] = p.id;
      else { const np = { id: newId("u"), name: n.slice(0, 40) }; people = [...people, np]; ids[n] = np.id; }
    }
    if (people !== state.cfg.people) { state.cfg = { ...state.cfg, people }; await persistCfg({ people }); }
    const daysIn = new Date(ip.year, ip.month + 1, 0).getDate();
    const roster = { ...state.cfg.roster }, patch = {};
    for (const e of ip.entries) {
      if (e.day > daysIn) continue;
      const date = `${ip.year}-${pad(ip.month + 1)}-${pad(e.day)}`;
      const entry = { frueh: e.early.map(n => ids[n]), spaet: e.late.map(n => ids[n]) };
      const times = {}, notes = {};
      if (e.tEarly) times.frueh = e.tEarly;
      if (e.tLate) times.spaet = e.tLate;
      if (e.noteEarly) notes.frueh = e.noteEarly;
      if (e.noteLate) notes.spaet = e.noteLate;
      if (Object.keys(times).length) entry.times = times;
      if (Object.keys(notes).length) entry.notes = notes;
      roster[date] = entry;
      // Monatsplan ersetzt den Tag komplett. null löscht alte Felder beim Zusammenführen in SharePoint.
      patch[date] = { frueh: entry.frueh, spaet: entry.spaet, info: null,
        times: { frueh: times.frueh || null, spaet: times.spaet || null },
        notes: { frueh: notes.frueh || null, spaet: notes.spaet || null } };
    }
    state.cfg = { ...state.cfg, roster };
    state.importPreview = null;
    // Im Bearbeiten-Modus bleiben und den eingelesenen Monat zeigen – so sieht man das Ergebnis sofort.
    state.rosterMonth = `${ip.year}-${pad(ip.month + 1)}`;
    render();
    const ok = await persistCfg({ roster: patch });
    setStatus(ok ? `Monatsplan ${MONTHS[ip.month]} ${ip.year} übernommen` : "Monatsplan konnte nicht gespeichert werden", !ok);
  }
  async function onPlanFile(file) {
    setStatus("Lese " + file.name + " …");
    state.importPreview = { fileName: file.name, loading: true };
    render();
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Zeitüberschreitung – der PDF-Leser hat nicht geantwortet. Bitte Seite neu laden und erneut versuchen.")), 45000));
    try { state.importPreview = await Promise.race([readPlanFile(file), timeout]); setStatus(statusLine()); }
    catch (e) { state.importPreview = { fileName: file.name, error: (e && e.message) || "Datei konnte nicht gelesen werden" }; }
    render();
  }
  // Ein festes Datei-Feld außerhalb von <main>: Neuzeichnen ersetzt es nicht. Sonst geht die gewählte Datei auf dem
  // iPad verloren (Safari zeichnet beim Zurückkehren aus der Dateiauswahl neu, bevor es die Datei übergibt).
  const FILE_ACCEPT = { plan: ".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", backup: "application/json,.json" };
  let filePurpose = "plan";
  container.addEventListener("click", (e) => {
    const l = e.target.closest && e.target.closest("[data-filepick]");
    if (!l) return;
    filePurpose = l.dataset.filepick;
    const inp = $("rzfile"); inp.accept = FILE_ACCEPT[filePurpose] || ""; inp.value = "";
  }, true);
  $("rzfile").addEventListener("change", (e) => {
    const inp = e.target, f = inp.files && inp.files[0];
    if (!f) return;
    inp.value = ""; inp.blur();
    if (filePurpose === "backup") importBackup(f); else onPlanFile(f);
  });



  // ---------- Leitungsbereich (PIN) ----------
  // Einfacher Schutz gegen versehentliche Änderungen auf dem Gemeinschaftsrechner – keine echte Zugriffskontrolle.
  // Ab 1.17: gesalzener, langsamer Hash (PBKDF2-SHA256) „p2:<salz>:<runden>:<hash>“. Alte „f1:“-Hashes gelten weiter
  // und werden beim nächsten richtigen Entsperren umgestellt. Nach 5 Fehlversuchen sperrt die Eingabe (gerätebezogen, rz2pinlock).
  const PIN_ITER = 150000;
  const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  const unhex = (h) => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
  async function pbkdf2Hex(pin, saltHex, iter) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("rezeption:" + pin), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: iter }, key, 256));
  }
  async function pinHashSecure(pin) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return `p2:${salt}:${PIN_ITER}:${await pbkdf2Hex(pin, salt, PIN_ITER)}`;
  }
  async function pinMatches(pin, stored) {
    if (typeof stored !== "string") return false;
    if (stored.startsWith("f1:")) return pinHash(pin) === stored;
    const m = stored.match(/^p2:([0-9a-f]{32}):(\d{4,7}):([0-9a-f]{64})$/);
    return !!m && (await pbkdf2Hex(pin, m[1], Number(m[2]))) === m[3];
  }
  const pinLock = () => { const l = LS.get("rz2pinlock", null); return l && typeof l === "object" ? l : { fails: 0, until: 0 }; };
  function pinHash(pin) {
    let h = 0x811c9dc5;
    for (const ch of "rezeption:" + pin) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return "f1:" + h.toString(16);
  }
  // adminPin "off" = PIN bewusst deaktiviert: Leitungsbereiche sind für alle offen.
  const PIN_OFF = "off";
  const pinOff = () => state.cfg.adminPin === PIN_OFF;
  const isUnlocked = () => pinOff() || Date.now() < state.unlockedUntil;
  const checkinsOn = () => !!CHECKIN_URL && !!(state.cfg.features && state.cfg.features.checkins);
  // Leitungs-PIN festgelegt (nicht leer, nicht „off“): Zeiten anderer nur für die Leitung.
  const timesOwnOnly = () => !!state.cfg.adminPin && !pinOff();
  function requireAdmin(next) {
    if (isUnlocked()) { state.unlockedUntil = Date.now() + 10 * 60000; return true; }
    state.pinStage = { mode: state.cfg.adminPin ? "unlock" : "set", next };
    state.view = "pin";
    render();
    setTimeout(() => { const el = $("pin-in"); if (el) el.focus(); }, 0);
    return false;
  }
  function renderPin() {
    const st = state.pinStage || { mode: "unlock" };
    const title = st.mode === "set" ? (st.first ? "PIN wiederholen" : "Leitungs-PIN festlegen") : "Leitungs-PIN";
    const text = st.mode === "set" ? "Diese PIN schützt Team, Dienstplan und Aufgaben-Plan vor Änderungen. Mindestens 4 Ziffern." : "Nur für die Leitung.";
    return `<form class="pinform" id="pinform">
      <h2>${title}</h2><p>${text}</p>
      <input class="in" id="pin-in" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN">
      <button class="btn primary" type="submit">${st.mode === "set" && !st.first ? "Weiter" : "Entsperren"}</button>
      <button class="btn ghost" type="button" data-act2="pin-cancel">Abbrechen</button>
      ${st.mode === "set" && !st.first ? `<button class="btn ghost" type="button" data-act2="pin-off">Ohne PIN nutzen</button>` : ""}
      <p id="pin-msg"></p>
    </form>`;
  }
  // Render wird während einer Eingabe aufgeschoben – bei Formular-Aktionen deshalb erst den Fokus lösen.
  function blurActive() { const a = root.activeElement; if (a && a.blur) a.blur(); }
  async function submitPin(val) {
    const st = state.pinStage, msg = $("pin-msg");
    blurActive();
    if (!/^\d{4,8}$/.test(val)) { if (msg) msg.textContent = "Bitte 4 bis 8 Ziffern eingeben."; return; }
    if (st.mode === "set") {
      if (!st.first) { state.pinStage = { ...st, first: val }; render(); setTimeout(() => { const el = $("pin-in"); if (el) el.focus(); }, 0); return; }
      if (st.first !== val) { state.pinStage = { ...st, first: null }; render(); setTimeout(() => { const m2 = $("pin-msg"); if (m2) m2.textContent = "Die PINs stimmen nicht überein. Bitte neu festlegen."; }, 0); return; }
      state.cfg = { ...state.cfg, adminPin: await pinHashSecure(val) };
      await persistCfg({ adminPin: state.cfg.adminPin });
    } else {
      const lock = pinLock();
      if (lock.until > Date.now()) { if (msg) msg.textContent = `Zu viele Fehlversuche – bitte in ${Math.ceil((lock.until - Date.now()) / 60000)} Min. erneut versuchen.`; return; }
      if (!(await pinMatches(val, state.cfg.adminPin))) {
        const fails = lock.fails + 1;
        // ab dem 5. Fehlversuch: 1 Min. Sperre, danach jeweils doppelt so lang (höchstens 30 Min.)
        const until = fails >= 5 ? Date.now() + Math.min(30, 2 ** (fails - 5)) * 60000 : 0;
        LS.set("rz2pinlock", { fails, until });
        if (msg) msg.textContent = until ? "PIN falsch. Eingabe für kurze Zeit gesperrt." : "PIN falsch.";
        const el = $("pin-in"); if (el) { el.value = ""; el.focus(); }
        return;
      }
      LS.set("rz2pinlock", { fails: 0, until: 0 });
      // Alter, ungesalzener Hash → beim richtigen Entsperren auf den sicheren umstellen.
      if (state.cfg.adminPin.startsWith("f1:")) { state.cfg = { ...state.cfg, adminPin: await pinHashSecure(val) }; persistCfg({ adminPin: state.cfg.adminPin }); }
    }
    state.unlockedUntil = Date.now() + 10 * 60000;
    const next = st.next || "admin";
    state.pinStage = null;
    if (next === "dienst-edit") { state.view = "dienst"; state.rosterEdit = true; }
    else if (next === "zeiten-all") { state.view = "zeiten"; state.timesAll = true; state.timesPerson = ""; }
    else { if (next === "plan") openFirstPhase(); state.view = next; }
    render();
  }

  // ---------- Verwaltung ----------
  function backupHint() {
    if (state.mode !== "local") return "";
    const last = LS.get("rz2meta", {}).lastBackup;
    const days = last ? Math.floor((Date.now() - new Date(last)) / 86400000) : null;
    if (FS_OK && !backupDir && !NATIVE) return "Sicherungsordner fehlt (Verwaltung)";
    if (days === null) return "Noch keine Sicherung (Verwaltung)";
    return days >= 7 ? `Sicherung ${days} Tage alt (Verwaltung)` : "";
  }
  // Verwaltung: eine Liste mit Status in drei Gruppen; Team, Datensicherung und PIN öffnen ein Fenster (state.adminPop).
  function backupStatus() {
    const last = LS.get("rz2meta", {}).lastBackup, when = last ? new Date(last).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : null;
    if (state.mode === "shared") return { text: opts.mode === "sharepoint" ? "Gespeichert in SharePoint (Versionsverlauf)" : "Online gespeichert · Sicherung der Mac-App übernehmen", cls: "" };
    const enc = state.cfg.backupKey ? " · verschlüsselt" : "";
    if (NATIVE) return when ? { text: `Gesichert ${when} · automatisch${enc}`, cls: "ok" } : { text: "Noch keine Sicherung", cls: "bad" };
    if (!backupDir) return { text: "Kein Sicherungsordner gewählt" + (when ? ` · zuletzt ${when}` : ""), cls: "bad" };
    return when ? { text: `Gesichert ${when} · automatisch nach „${backupDir.name}“${enc}`, cls: "ok" } : { text: `Automatisch nach „${backupDir.name}“ · noch keine Sicherung`, cls: "" };
  }
  // ---------- Alte Daten löschen (Löschkonzept) ----------
  // Fristen: Protokoll/Übergaben 3 Monate, Dienstplan 1 Jahr, Arbeitszeiten 2 Jahre nach Ende des Kalenderjahres.
  // Nur im lokalen Speicher (Mac-App); gelöscht wird erst nach Bestätigung, jede Löschung wird ohne Inhalte vermerkt.
  const hasLog = (doc) => ["checks", "logs", "notes", "read"].some(f => doc[f] && typeof doc[f] === "object" && Object.keys(doc[f]).length);
  function cleanupScan() {
    if (state.mode !== "local") return null;
    const d = new Date();
    const res = {
      cutLog: isoDate(new Date(d.getFullYear(), d.getMonth() - 3, d.getDate())),
      cutRoster: isoDate(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate())),
      cutTime: `${d.getFullYear() - 2}-01-01`, logDays: [], timeDays: [], rosterDays: [],
    };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !/^rz2:\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        const date = k.slice(4), doc = LS.get(k, null);
        if (!doc || typeof doc !== "object") continue;
        if (date < res.cutLog && hasLog(doc)) res.logDays.push(date);
        if (date < res.cutTime && doc.time && Object.keys(doc.time).length) res.timeDays.push(date);
      }
    } catch { return null; }
    res.rosterDays = Object.keys(state.cfg.roster).filter(k => k < res.cutRoster);
    res.total = res.logDays.length + res.timeDays.length + res.rosterDays.length;
    return res;
  }
  async function runCleanup() {
    const sc = cleanupScan(); if (!sc || !sc.total) return;
    for (const date of new Set([...sc.logDays, ...sc.timeDays])) {
      const k = "rz2:" + date, doc = { ...LS.get(k, {}) };
      if (sc.logDays.includes(date)) { doc.checks = {}; doc.logs = {}; doc.notes = {}; doc.read = {}; }
      if (sc.timeDays.includes(date)) delete doc.time;
      // Ohne Einträge bleibt nichts Personenbezogenes übrig → Tag ganz entfernen.
      if (!hasLog(doc) && !(doc.time && Object.keys(doc.time).length)) localStorage.removeItem(k); else LS.set(k, doc);
    }
    if (sc.rosterDays.length) {
      const roster = { ...state.cfg.roster };
      for (const k of sc.rosterDays) delete roster[k];
      state.cfg = { ...state.cfg, roster };
      await persistCfg({ roster });
    }
    const meta = LS.get("rz2meta", {});
    const entry = { at: new Date().toISOString(), log: sc.logDays.length, time: sc.timeDays.length, roster: sc.rosterDays.length };
    LS.set("rz2meta", { ...meta, cleanups: [entry, ...(Array.isArray(meta.cleanups) ? meta.cleanups : [])].slice(0, 20) });
    state.confirm = null;
    subscribeMonth(true); subscribeDay();
    setStatus(`Alte Daten gelöscht: ${entry.log} Tage Protokoll, ${entry.time} Tage Arbeitszeiten, ${entry.roster} Dienstplan-Tage`);
    render();
  }
  function renderAdmin() {
    const m = getMaster(), ym = state.date.slice(0, 7), [yy, mm] = ym.split("-").map(Number), days = new Date(yy, mm, 0).getDate();
    const items = (k) => m.plan[k].phases.reduce((n, p) => n + p.items.length, 0);
    const rems = KEYS.reduce((n, k) => n + m.plan[k].phases.reduce((x, p) => x + p.items.filter(i => i.remind).length, 0), 0);
    let planned = 0;
    for (let d = 1; d <= days; d++) { const r = state.cfg.roster[`${ym}-${pad(d)}`]; if (r && ((r.frueh || []).length || (r.spaet || []).length)) planned++; }
    const bs = backupStatus(), n = state.cfg.people.length, sc = cleanupScan();
    const lastClean = (LS.get("rz2meta", {}).cleanups || [])[0];
    const clTxt = !sc ? null : sc.total ? { text: `${sc.total} ${sc.total === 1 ? "Eintrag" : "Einträge"} über der Frist – bitte löschen`, cls: "bad" } : { text: `Nichts fällig${lastClean ? ` · zuletzt gelöscht ${new Date(lastClean.at).toLocaleDateString("de-DE")}` : ""}`, cls: "" };
    const pinTxt = pinOff() ? { text: "Ausgeschaltet – Verwaltung und alle Zeiten sind für alle offen", cls: "bad" } : state.cfg.adminPin ? { text: "Aktiv · sperrt 10 Minuten nach der letzten Aktion", cls: "" } : { text: "Noch keine PIN festgelegt", cls: "bad" };
    const row = (attr, title, st, cls = "") => `<button class="arow" ${attr}><span><b>${title}</b><small class="${cls}">${esc(st)}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
    const group = (title, rows) => `<section class="agroup" aria-label="${title}"><h3>${title}</h3><div class="alist">${rows}</div></section>`;
    return `<div class="admin2"><h2>Verwaltung</h2>
      ${group("Planung",
        row('data-act2="open-plan"', "Aufgaben-Plan", `Früh ${items("frueh")} Aufgaben · Spät ${items("spaet")} Aufgaben${rems ? ` · ${rems} ${rems === 1 ? "Erinnerung" : "Erinnerungen"}` : ""}`) +
        row('data-act2="open-roster"', "Dienstplan", `${MONTHS[mm - 1]}: ${planned} von ${days} Tagen eingeteilt`) +
        row('data-adminpop="team"', "Team", `${n} ${n === 1 ? "Person" : "Personen"}`))}
      ${group("Auswertung",
        row('data-act2="open-month"', "Monatsstatistik", "Erledigt pro Tag und Schicht") +
        row('data-act2="open-times"', "Arbeitszeiten aller", "Korrigieren, Excel- und PDF-Export"))}
      ${group("System",
        (state.mode === "loading" ? "" : row('data-adminpop="backup"', state.mode === "shared" ? "Datenspeicher" : "Datensicherung", bs.text, bs.cls)) +
        (CHECKIN_URL ? `<div class="arow"><span><b>Check-ins</b><small>${checkinsOn() ? "Eingeschaltet" : "Ausgeschaltet"}</small></span><button class="switch${checkinsOn() ? " on" : ""}" role="switch" aria-checked="${checkinsOn()}" aria-label="Check-ins ${checkinsOn() ? "ausschalten" : "einschalten"}" data-act2="feat-checkins"><span></span></button></div>` : "") +
        (clTxt ? row('data-adminpop="cleanup"', "Alte Daten löschen", clTxt.text, clTxt.cls) : "") +
        row('data-adminpop="pin"', "Leitungs-PIN", pinTxt.text, pinTxt.cls))}
    </div>${state.adminPop ? renderAdminPop() : ""}`;
  }
  function renderAdminPop() {
    const pop = state.adminPop, last = LS.get("rz2meta", {}).lastBackup;
    const frame = (title, body) => `<div class="overlay inmain" role="dialog" aria-modal="true" aria-labelledby="ap-title"><div class="dialog adminpop">
      <h2 id="ap-title">${title}</h2>${body}<div class="row"><button class="btn primary" data-adminpop-close="1">Fertig</button></div></div></div>`;
    if (pop === "team") {
      const people = state.cfg.people.map(p => `<li><span class="av" aria-hidden="true">${esc(initials(p.name))}</span>
        <input class="in" id="pp-${esc(p.id)}" data-person="${esc(p.id)}" value="${esc(p.name)}" maxlength="40" aria-label="Name">
        ${state.confirm === "p:" + p.id ? `<button class="btn sm danger" data-act2="person-del" data-pid="${esc(p.id)}">Wirklich entfernen?</button>` : `<button class="btn ghost sm danger" data-act2="person-del" data-pid="${esc(p.id)}">Entfernen</button>`}</li>`).join("");
      return frame(`Team · ${state.cfg.people.length} ${state.cfg.people.length === 1 ? "Person" : "Personen"}`, `
        ${people ? `<ul class="teamlist">${people}</ul>` : "<p>Noch niemand angelegt.</p>"}
        <form id="addperson" class="pkadd"><input class="in" id="newperson" maxlength="40" placeholder="Vor- und Nachname" aria-label="Neue Person"><button class="btn primary" type="submit">Hinzufügen</button></form>
        <p class="hint">Namen erscheinen bei der Anmeldung und im Dienstplan. Entfernte Personen bleiben in alten Einträgen erhalten.</p>`);
    }
    if (pop === "cleanup") {
      const sc = cleanupScan(); if (!sc) return "";
      const fmt = (d) => d.split("-").reverse().join(".");
      const log = (LS.get("rz2meta", {}).cleanups || []).slice(0, 5);
      return frame("Alte Daten löschen", `<div class="apbody">
        <p>Nach dem Löschkonzept werden diese Daten nicht mehr gebraucht:</p>
        <table class="cltab"><thead><tr><th>Daten</th><th>Frist</th><th>Betroffen</th></tr></thead><tbody>
          <tr><td>Protokoll, Übergaben, „Gelesen“</td><td>älter als 3 Monate (vor ${fmt(sc.cutLog)})</td><td><b>${sc.logDays.length}</b> ${sc.logDays.length === 1 ? "Tag" : "Tage"}</td></tr>
          <tr><td>Dienstplan</td><td>älter als 1 Jahr (vor ${fmt(sc.cutRoster)})</td><td><b>${sc.rosterDays.length}</b> ${sc.rosterDays.length === 1 ? "Tag" : "Tage"}</td></tr>
          <tr><td>Arbeitszeiten</td><td>2 Jahre nach Jahresende (vor ${fmt(sc.cutTime)})</td><td><b>${sc.timeDays.length}</b> ${sc.timeDays.length === 1 ? "Tag" : "Tage"}</td></tr>
        </tbody></table>
        <p class="hint">Arbeitszeiten, die als Lohnunterlage länger gebraucht werden, vorher als PDF/Excel an die Lohnbuchhaltung geben. Gelöschtes bleibt noch bis zu 120 Tage in älteren Sicherungsdateien. Der Plan-Stand der Tage (ohne Personen) bleibt erhalten.</p>
        ${sc.total ? (state.confirm === "cleanup" ? `<button class="btn danger" data-act2="cleanup-run">Wirklich ${sc.total} Einträge löschen?</button>` : `<button class="btn primary" data-act2="cleanup-ask">Jetzt löschen</button>`) : `<p><b>Nichts fällig.</b></p>`}
        ${log.length ? `<p class="hint">Bisherige Löschungen: ${log.map(e => `${new Date(e.at).toLocaleDateString("de-DE")} (${e.log}/${e.roster}/${e.time})`).join(" · ")} – Protokoll/Dienstplan/Zeiten in Tagen</p>` : ""}</div>`);
    }
    if (pop === "encsetup") return `<div class="overlay inmain" role="dialog" aria-modal="true" aria-labelledby="ap-title"><form class="dialog adminpop" id="encform">
      <h2 id="ap-title">Sicherungen verschlüsseln</h2>
      <p>Ab jetzt lassen sich neue Sicherungen nur mit diesem Passwort oder dem Wiederherstellungscode öffnen. Die automatische Sicherung läuft weiter ohne Eingabe.</p>
      <label class="fld"><span>Passwort der Leitung (mind. 8 Zeichen)</span><input class="in" type="password" id="enc-pw1" minlength="8" autocomplete="new-password" required></label>
      <label class="fld"><span>Passwort wiederholen</span><input class="in" type="password" id="enc-pw2" minlength="8" autocomplete="new-password" required></label>
      <p class="hint">Ohne Passwort und ohne Wiederherstellungscode ist eine verschlüsselte Sicherung nicht mehr lesbar – auch nicht für den Entwickler.</p>
      <p class="perr" id="enc-msg" role="alert"></p>
      <div class="row"><button type="button" class="btn ghost" data-adminpop-close="1">Abbrechen</button><button type="submit" class="btn primary">Einrichten</button></div></form></div>`;
    if (pop === "enccode") return `<div class="overlay inmain" role="dialog" aria-modal="true" aria-labelledby="ap-title"><div class="dialog adminpop">
      <h2 id="ap-title">Wiederherstellungscode</h2>
      <p>Falls das Passwort vergessen wird, öffnet dieser Code die Sicherungen. <b>Jetzt ausdrucken oder abschreiben und sicher verwahren</b> (z. B. im Tresor). Er wird nicht noch einmal angezeigt.</p>
      <div class="enccode" aria-label="Wiederherstellungscode">${esc(state.encCode || "")}</div>
      <label class="check-inline"><input type="checkbox" id="enc-noted"> Ich habe den Code sicher notiert.</label>
      <div class="row"><button class="btn primary" data-enc-done="1" disabled id="enc-done">Fertig</button></div></div></div>`;
    if (pop === "decrypt") return `<div class="overlay inmain" role="dialog" aria-modal="true" aria-labelledby="ap-title"><form class="dialog adminpop" id="decform">
      <h2 id="ap-title">Verschlüsselte Sicherung</h2>
      <p>Diese Sicherung ist verschlüsselt (erstellt ${state.pendingImport && state.pendingImport.exportedAt ? new Date(state.pendingImport.exportedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–"}). Passwort der Leitung oder Wiederherstellungscode eingeben.</p>
      <label class="fld"><span>Passwort oder Wiederherstellungscode</span><input class="in" type="password" id="dec-secret" autocomplete="off" required></label>
      <p id="dec-msg" role="status"></p>
      <div class="row"><button type="button" class="btn ghost" data-dec-cancel="1">Abbrechen</button><button type="submit" class="btn primary">Entschlüsseln und einspielen</button></div></form></div>`;
    if (pop === "backup") return frame(state.mode === "shared" ? "Datenspeicher" : "Datensicherung", `<div class="apbody">
      ${state.mode === "local" ? `${NATIVE ? `<p>Die Daten liegen in der App auf diesem Mac. Bei jedem Schichtbeginn und zum Tagesabschluss legt die App automatisch eine Sicherung ab – „rezeption-sicherung-aktuell.json“ und eine Datei pro Tag.</p>
          <p>Ordner: <b>${esc((nativeInfo && nativeInfo.backupDir) || "Dokumente/Rezeption Sicherungen")}</b></p>
          <button class="btn primary" data-act2="backup-now">Jetzt sichern</button>
          <button class="btn" data-act2="backup-open">Ordner im Finder zeigen</button>
          <label class="check-inline"><input type="checkbox" id="autostart" ${nativeInfo && nativeInfo.autoStart ? "checked" : ""}> Beim Anmelden am Mac automatisch starten</label>` : `<p>Alles liegt im Browser dieses Macs. Wird der Browserverlauf mit „Website-Daten“ gelöscht, ist es weg. Sichere deshalb regelmäßig.</p>
          ${FS_OK ? (backupDir
            ? `<p>Sicherungsordner: <b>${esc(backupDir.name)}</b>. Gesichert wird bei jedem Schichtbeginn und wenn der letzte Punkt der Spätschicht abgehakt ist – als „rezeption-sicherung-aktuell.json“ und eine Datei pro Tag.</p>
               <button class="btn primary" data-act2="backup-now">Jetzt sichern</button>
               <button class="btn" data-act2="backup-dir">Anderen Ordner wählen</button>
               <button class="btn ghost danger" data-act2="backup-forget">Ordner trennen</button>`
            : `<p>Wähle einmal den per OneDrive synchronisierten SharePoint-Ordner. Danach sichert die App automatisch dorthin – andere Downloads bleiben, wo sie sind.</p>
               <button class="btn primary" data-act2="backup-dir">Sicherungsordner wählen</button>
               <button class="btn" data-act2="export">Einmalig herunterladen</button>`)
          : `<p>Dieser Browser kann nicht direkt in einen Ordner schreiben. Bitte Google Chrome verwenden.</p>
             <button class="btn" data-act2="export">Einmalig herunterladen</button>`}`}
          <p>Letzte Sicherung: <b>${last ? new Date(last).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "noch nie"}</b></p>
          <label class="btn" for="rzfile" data-filepick="backup">Sicherung einspielen</label>
          <p id="import-msg"></p>
          <div class="encbox"><b>Verschlüsselung</b>${state.cfg.backupKey
            ? `<p>Eingeschaltet seit ${esc(new Date(state.cfg.backupKey.created).toLocaleDateString("de-DE"))}. Neue Sicherungen lassen sich nur mit dem Passwort der Leitung oder dem Wiederherstellungscode öffnen.</p>
              <button class="btn" data-adminpop="encsetup">Passwort ändern (neu einrichten)</button>
              ${state.confirm === "enc-off" ? `<button class="btn danger" data-act2="enc-off">Wirklich ausschalten?</button>` : `<button class="btn ghost danger" data-act2="enc-off-ask">Ausschalten</button>`}
              <p class="hint">Ältere Sicherungen bleiben mit dem damaligen Passwort bzw. Code lesbar.</p>`
            : `<p>Aus – wer eine Sicherungsdatei öffnet, kann alles lesen.</p><button class="btn" data-adminpop="encsetup">Verschlüsselung einrichten</button>`}</div>` : state.mode === "shared" ? `${opts.mode === "sharepoint" ? `<p>Alle Daten liegen in der SharePoint-Bibliothek <b>${esc(opts.library || "RezeptionDaten")}</b> dieser Website. SharePoint speichert jede Änderung im Versionsverlauf – ein früherer Stand lässt sich dort wiederherstellen.</p>` : `<p>Die Webversion speichert online und ist für alle mit dem Link gleich. Die Mac-App hat ihre eigenen Daten – beide gleichen sich nicht ab.</p>`}
          <p>Daten aus der bisherigen Mac-Version übernehmen: dort unter Verwaltung › Datensicherung eine Sicherung herunterladen und hier einspielen.</p>
          <label class="btn" for="rzfile" data-filepick="backup">Sicherung übernehmen</label>
          <p id="import-msg"></p>` : ""}</div>`);
    if (pop === "pin") return frame("Leitungs-PIN", `<div class="apbody">${pinOff()
          ? `<p><b>PIN ist deaktiviert.</b> Verwaltung, Aufgaben-Plan, Dienstplan-Bearbeitung und alle Zeiten sind für alle offen.</p>
          <button class="btn primary" data-act2="pin-change">PIN festlegen</button>`
          : `<p>Entsperrt für 10 Minuten nach der letzten Aktion.</p>
          <button class="btn" data-act2="pin-change">PIN ändern</button>
          <button class="btn ghost" data-act2="lock">Jetzt sperren</button>
          ${state.confirm === "pin-off" ? `<button class="btn danger" data-act2="pin-off">Wirklich deaktivieren?</button>` : `<button class="btn ghost danger" data-act2="pin-off-ask">PIN deaktivieren</button>`}`}</div>`);
    return "";
  }
  function addPerson(name) {
    name = name.trim().slice(0, 40);
    if (!name) return;
    if (state.cfg.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { setStatus(`„${name}“ gibt es schon`, true); return; }
    blurActive();
    const people = [...state.cfg.people, { id: newId("u"), name }];
    state.cfg = { ...state.cfg, people };
    render();
    persistCfg({ people });
    setTimeout(() => { const el = $("newperson"); if (el) el.focus(); }, 0);
  }
  function renamePerson(id, name) {
    name = name.trim().slice(0, 40);
    if (!name) return;
    const people = state.cfg.people.map(p => p.id === id ? { ...p, name } : p);
    state.cfg = { ...state.cfg, people };
    persistCfg({ people });
  }
  function deletePerson(id) {
    if (state.confirm !== "p:" + id) { state.confirm = "p:" + id; render(); return; }
    state.confirm = null;
    const people = state.cfg.people.filter(p => p.id !== id);
    state.cfg = { ...state.cfg, people };
    render();
    persistCfg({ people });
  }
  // ---------- Sicherung in einen gewählten Ordner (Chrome: File System Access API) ----------
  // Der Ordner-Zugriff wird in IndexedDB gemerkt. Chrome fragt ggf. nach – dafür muss die Sicherung aus einem Klick starten.
  const FS_OK = typeof window.showDirectoryPicker === "function";
  let nativeInfo = null; // Mac-App: { backupDir, autoStart }
  let backupDir = null;
  const idb = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open("rz2fs", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("h");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) { const d = await this.open(); return new Promise((res, rej) => { const q = d.transaction("h").objectStore("h").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); },
    async set(k, v) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction("h", "readwrite"); if (v === null) t.objectStore("h").delete(k); else t.objectStore("h").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  };
  async function loadBackupDir() {
    try { backupDir = await idb.get("backupDir"); } catch { backupDir = null; }
    if (state.view === "admin") render();
  }
  async function chooseBackupDir() {
    if (!FS_OK) return;
    try {
      const h = await window.showDirectoryPicker({ id: "rezeption-sicherung", mode: "readwrite" });
      backupDir = h;
      await idb.set("backupDir", h);
      const ok = await writeBackup("manual");
      setStatus(ok ? `Sicherungsordner „${h.name}“ eingerichtet` : "Ordner gewählt, aber kein Schreibzugriff", !ok);
    } catch (e) {
      if (!(e && e.name === "AbortError")) setStatus("Ordner konnte nicht gewählt werden", true);
    }
    render();
  }
  async function forgetBackupDir() {
    backupDir = null;
    try { await idb.set("backupDir", null); } catch { /* egal */ }
    render();
  }
  // Gerätebezogene Schlüssel gehören nicht in die Sicherung.
  const DEVICE_KEYS = new Set(["rz2who", "rz2bye", "rz2pinlock", "rz2taskrem"]);
  // Sicherung: version 1 = Klartext; mit eingerichteter Verschlüsselung (cfg.backupKey) version 2 = { enc } (siehe encryptBackup).
  async function backupPayload() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && ((k.startsWith("rz2") && !DEVICE_KEYS.has(k)) || k.startsWith("cir."))) data[k] = localStorage.getItem(k); }
    const exportedAt = new Date().toISOString();
    const plain = JSON.stringify({ app: "rezeption-schichtcheck", version: 1, exportedAt, data }, null, 1);
    if (!state.cfg.backupKey) return plain;
    return JSON.stringify({ app: "rezeption-schichtcheck", version: 2, exportedAt, enc: await encryptBackup(plain, state.cfg.backupKey) });
  }

  // ---------- Verschlüsselte Sicherungen ----------
  // Öffentlicher Schlüssel (RSA-OAEP 3072) verschlüsselt pro Sicherung einen zufälligen AES-256-GCM-Schlüssel – dafür braucht die
  // automatische Sicherung kein Passwort. Der private Schlüssel liegt zweimal verschlüsselt vor: mit dem Passwort der Leitung und
  // mit einem Wiederherstellungscode (PBKDF2-SHA256). Beides steht in jeder Sicherungsdatei, sie lässt sich also auf jedem Gerät
  // mit der App und Passwort oder Code öffnen. Ohne beides ist sie nicht lesbar.
  const KDF_ITER = 310000;
  const b64 = (buf) => { const u = new Uint8Array(buf); let s2 = ""; for (let i = 0; i < u.length; i += 0x8000) s2 += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s2); };
  const unb64 = (t) => { const s2 = atob(t); const u = new Uint8Array(s2.length); for (let i = 0; i < s2.length; i++) u[i] = s2.charCodeAt(i); return u; };
  const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  async function secretKey(secret, salt, iter) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function wrapWith(secret, data) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await secretKey(secret, salt, KDF_ITER), data);
    return { salt: b64(salt), iv: b64(iv), iter: KDF_ITER, ct: b64(ct) };
  }
  async function unwrapWith(secret, w) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(w.iv) }, await secretKey(secret, unb64(w.salt), w.iter), unb64(w.ct));
  }
  // Neu einrichten: Schlüsselpaar erzeugen, privaten Schlüssel mit Passwort und Code verpacken. Liefert { key, code }.
  async function createBackupKey(password) {
    const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
    const pub = await crypto.subtle.exportKey("spki", pair.publicKey), priv = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    const rnd = crypto.getRandomValues(new Uint8Array(24));
    const code = [...rnd].map(b => CODE_ABC[b % 32]).join("").match(/.{6}/g).join("-");
    return { code, key: { v: 1, created: new Date().toISOString(), pub: b64(pub), pw: await wrapWith(password, priv), code: await wrapWith(normCode(code), priv) } };
  }
  async function encryptBackup(plain, k) {
    const pub = await crypto.subtle.importKey("spki", unb64(k.pub), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plain));
    const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, await crypto.subtle.exportKey("raw", aes));
    return { alg: "RSA-OAEP-256+A256GCM", key: b64(wrapped), iv: b64(iv), ct: b64(ct), keys: { pw: k.pw, code: k.code } };
  }
  // Entschlüsseln mit Passwort oder Wiederherstellungscode (beides wird probiert). Wirft bei falscher Eingabe.
  async function decryptBackup(enc, secret) {
    let priv = null;
    for (const [w, sec] of [[enc.keys.pw, secret], [enc.keys.code, normCode(secret)]]) {
      if (!w || !sec) continue;
      try { priv = await unwrapWith(sec, w); break; } catch { /* nächster Versuch */ }
    }
    if (!priv) throw new Error("secret");
    const pk = await crypto.subtle.importKey("pkcs8", priv, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
    const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, pk, unb64(enc.key));
    const aes = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(enc.iv) }, aes, unb64(enc.ct)));
  }
  async function writeFile(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  // Schreibt „…-aktuell.json“ (immer neuester Stand) und „…-JJJJ-MM-TT.json“ (eine Datei pro Tag, wird überschrieben).
  // reason: "manual" | "shift" (Schichtbeginn) | "day" (Tagesabschluss)
  async function writeBackup(reason) {
    if (state.mode !== "local" || (!backupDir && !NATIVE)) return false;
    let text;
    try { text = await backupPayload(); } catch { setStatus("Browser-Speicher blockiert oder Verschlüsselung fehlgeschlagen", true); return false; }
    if (NATIVE) {
      // Mac-App: schreibt ohne Rückfrage nach ~/Dokumente/Rezeption Sicherungen.
      const now = new Date();
      try {
        const r = await NATIVE.saveBackup(text, isoDate(now));
        if (!r || !r.ok) throw new Error((r && r.error) || "Fehler");
        if (r.dir) nativeInfo = { ...(nativeInfo || {}), backupDir: r.dir };
        LS.set("rz2meta", { ...LS.get("rz2meta", {}), lastBackup: now.toISOString(), ...(reason === "day" ? { lastDayBackup: isoDate(now) } : {}) });
        setStatus(`Gesichert ${fmtMin(now.getHours() * 60 + now.getMinutes())}${reason === "day" ? " (Tagesabschluss)" : ""}`);
        if (state.view === "admin") render();
        return true;
      } catch (e) { setStatus("Sicherung fehlgeschlagen: " + ((e && e.message) || "Fehler"), true); return false; }
    }
    try {
      let perm = backupDir.queryPermission ? await backupDir.queryPermission({ mode: "readwrite" }) : "granted";
      if (perm !== "granted" && backupDir.requestPermission) perm = await backupDir.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") { setStatus("Sicherung übersprungen – Ordnerzugriff nicht erlaubt (Verwaltung)", true); return false; }
      const now = new Date();
      await writeFile(backupDir, `rezeption-sicherung-${isoDate(now)}.json`, text);
      await writeFile(backupDir, "rezeption-sicherung-aktuell.json", text);
      LS.set("rz2meta", { ...LS.get("rz2meta", {}), lastBackup: now.toISOString(), ...(reason === "day" ? { lastDayBackup: isoDate(now) } : {}) });
      setStatus(`Gesichert ${fmtMin(now.getHours() * 60 + now.getMinutes())}${reason === "day" ? " (Tagesabschluss)" : ""}`);
      if (state.view === "admin") render();
      return true;
    } catch {
      setStatus("Sicherung fehlgeschlagen – Ordner prüfen (Verwaltung › Datensicherung)", true);
      return false;
    }
  }
  // Manuell ohne Ordner: einmaliger Download in den normalen Download-Ordner.
  async function downloadBackup() {
    let text;
    try { text = await backupPayload(); } catch { setStatus("Browser-Speicher blockiert oder Verschlüsselung fehlgeschlagen", true); return; }
    const now = new Date();
    try { if (!(await offerFile(`rezeption-sicherung-${isoDate(now)}.json`, text, "application/json"))) return; }
    catch (e) { setStatus("Sicherung fehlgeschlagen: " + ((e && e.message) || "Fehler"), true); return; }
    LS.set("rz2meta", { ...LS.get("rz2meta", {}), lastBackup: now.toISOString() });
    setStatus("Sicherung heruntergeladen");
    render();
  }
  // Automatisch nur mit eingerichtetem Ordner: bei jedem Schichtbeginn und einmal zum Tagesabschluss.
  function autoBackup(reason) {
    if (state.mode !== "local" || (!backupDir && !NATIVE)) return;
    if (reason === "day" && LS.get("rz2meta", {}).lastDayBackup === isoDate(new Date())) return;
    writeBackup(reason);
  }
  // Übernimmt eine lokale Sicherung (localStorage-Schlüssel) in den geteilten Speicher (SharePoint).
  async function migrateToShared(entries, msg) {
    const docs = [];
    for (const [k, v] of entries) {
      let val; try { val = JSON.parse(v); } catch { continue; }
      if (!val || typeof val !== "object") continue;
      if (k === "rz2cfg") docs.push(["config/plan", val, true]);
      else if (/^rz2:\d{4}-\d{2}-\d{2}$/.test(k)) docs.push(["days/" + k.slice(4), { ...val, month: k.slice(4, 11) }]);
    }
    if (!docs.length) { if (msg) msg.textContent = "Die Sicherung enthält keine Daten."; return; }
    let done = 0;
    // Leere Felder (kein Team, kein Dienstplan, keine PIN) überschreiben vorhandene Einstellungen nicht.
    const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)));
    for (const [path, val, mergeCfg] of docs) {
      try {
        const ref = db.doc(path);
        const cur = mergeCfg ? await ref.get() : null;
        if (cur && cur.exists) await ref.update(prune(val)); else await ref.set(val);
        done++;
      } catch (e) { if (msg) msg.textContent = `Abbruch bei ${path}: ${(e && e.message) || "Fehler"}. ${done} von ${docs.length} übernommen.`; return; }
      if (msg) msg.textContent = `Übernehme… ${done}/${docs.length}`;
    }
    if (msg) msg.textContent = `${done} Einträge übernommen.`;
    subscribeMonth(true); subscribeDay();
  }
  function importBackup(file) {
    const msg = $("import-msg");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (obj && obj.app === "rezeption-schichtcheck" && obj.version === 2 && obj.enc && obj.enc.keys) {
          state.pendingImport = obj; state.adminPop = "decrypt"; state.view = "admin"; render();
          setTimeout(() => { const i = $("dec-secret"); if (i) i.focus(); }, 0);
          return;
        }
        applyImport(obj, msg);
      } catch {
        if (msg) msg.textContent = "Diese Datei ist keine gültige Sicherung dieser App.";
      }
    };
    reader.onerror = () => { if (msg) msg.textContent = "Datei konnte nicht gelesen werden."; };
    reader.readAsText(file);
  }
  // Verschlüsselung einrichten: Schlüssel erzeugen, speichern, Code einmal anzeigen, gleich eine verschlüsselte Sicherung schreiben.
  async function setupEncryption() {
    const p1 = ($("enc-pw1") || {}).value || "", p2 = ($("enc-pw2") || {}).value || "", m = $("enc-msg");
    if (p1.length < 8) { if (m) m.textContent = "Das Passwort braucht mindestens 8 Zeichen."; return; }
    if (p1 !== p2) { if (m) m.textContent = "Die Passwörter stimmen nicht überein."; return; }
    if (!isUnlocked()) { requireAdmin("admin"); return; }
    if (m) m.textContent = "Richte ein …";
    let res;
    try { res = await createBackupKey(p1); } catch { if (m) m.textContent = "Verschlüsselung wird von diesem Browser nicht unterstützt."; return; }
    blurActive();
    state.cfg = { ...state.cfg, backupKey: res.key };
    await persistCfg({ backupKey: res.key });
    state.encCode = res.code; state.adminPop = "enccode"; render();
    writeBackup("manual");
  }
  async function decryptPendingImport(secret) {
    const m = $("dec-msg"), obj = state.pendingImport;
    if (!obj) return;
    if (m) m.textContent = "Entschlüssele …";
    let plain;
    try { plain = await decryptBackup(obj.enc, String(secret || "").trim()); }
    catch { if (m) m.textContent = "Passwort bzw. Wiederherstellungscode passt nicht zu dieser Sicherung."; return; }
    state.pendingImport = null;
    try { applyImport(JSON.parse(plain), m); } catch { if (m) m.textContent = "Die entschlüsselte Datei ist keine gültige Sicherung."; }
  }
  // Klartext-Sicherung (version 1) übernehmen – auch Sicherungen älterer Versionen.
  function applyImport(obj, msg) {
    if (!obj || obj.app !== "rezeption-schichtcheck" || !obj.data || typeof obj.data !== "object") throw new Error("format");
    // cir.* = Daten der Erstattung (Regeln, Hansefit-Liste, Buchungsfortschritt) – nur lokal, nicht im geteilten Speicher.
    const entries = Object.entries(obj.data).filter(([k, v]) => (k.startsWith("rz2") || (k.startsWith("cir.") && state.mode !== "shared")) && typeof v === "string" && !DEVICE_KEYS.has(k));
    if (!entries.length) throw new Error("leer");
    if (state.mode === "shared") { migrateToShared(entries, msg); return; }
    for (const [k, v] of entries) localStorage.setItem(k, v);
    if (msg) msg.textContent = `${entries.length} Einträge eingespielt. Seite lädt neu…`;
    setTimeout(() => location.reload(), 800);
  }

  // ---------- Namensauswahl ----------
  // Anmeldemaske: bildschirmfüllend, solange niemand eingecheckt ist; über „+“ als Fenster für eine weitere Person.
  function openPicker(mode) {
    state.pickerMode = mode || (presentPeople().length ? "add" : "login");
    state.pickerOpen = true; state.pickAdd = false;
    renderPicker();
  }
  function closePicker() { state.pickerOpen = false; state.checkin = null; state.pickAdd = false; renderPicker(); }
  const byeInfo = () => { const b = LS.get("rz2bye", null); return b && b.date === isoDate(new Date()) ? b : null; };
  function renderPicker() {
    const el = $("picker");
    if (!state.pickerOpen) { state.checkin = null; el.hidden = true; el.innerHTML = ""; el.className = ""; return; }
    el.className = state.pickerMode === "login" ? "login" : "";
    if (state.checkin) return renderCheckin();
    const today = isoDate(new Date()), plan = resolvePlan(today, state.date === today ? state.dayPlan : null).plan;
    const shift = focusShift(plan, nowMin());
    const sched = rosterFor(today)[shift];
    const people = state.cfg.people;
    const info = rosterFor(today).info || {};
    const btn = (p, cls) => `<button class="namebtn ${cls}" data-pick="${esc(p.id)}"><span class="av">${esc(initials(p.name))}</span><span>${esc(p.name)}${info[p.id] ? `<small class="ninfo">${esc(info[p.id])}</small>` : ""}</span></button>`;
    const checked = people.filter(p => openEntry(today, p.id));
    const inSched = people.filter(p => sched.includes(p.id) && !checked.includes(p)), others = people.filter(p => !sched.includes(p.id) && !checked.includes(p));
    const login = state.pickerMode === "login", bye = login && !state.byeSeen ? byeInfo() : null;
    const d = new Date(), brand = login ? `<div class="mhead"><div class="brand">Rezeption<small>${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}</small></div><div class="clock" id="mk-clock">${fmtMin(nowMin())}</div></div>` : "";
    el.hidden = false;
    if (bye) {
      el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="bye-title">${brand}<div class="dialog bye">
        <div class="byeic" aria-hidden="true">☾</div>
        <h2 id="bye-title">Schönen Feierabend${bye.name ? ", " + esc(bye.name) : ""}!</h2>
        <p>Ausgecheckt um ${esc(bye.out || "")}${bye.hours ? ` · ${esc(bye.hours)} Std.` : ""} – du kannst den Laptop jetzt zuklappen.</p>
        <div class="row center"><button class="btn ghost" data-pick-close="1">Nur ansehen</button><button class="btn primary" data-bye-next="1">Jemand anderes einchecken</button></div>
      </div></div>`;
      return;
    }
    const addForm = state.pickAdd
      ? `<form class="pkadd" id="pk-add"><input class="in" id="pk-new" maxlength="40" placeholder="Vor- und Nachname" autocomplete="off" aria-label="Name der neuen Person"><button class="btn primary" type="submit">Hinzufügen &amp; einchecken</button><button class="btn ghost" type="button" data-pick-addtoggle="1">Abbrechen</button></form>`
      : `<button class="namebtn addbtn" data-pick-addtoggle="1"><span class="av">+</span><span>Neue Person</span></button>`;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pick-title">${brand}<div class="dialog">
      <h2 id="pick-title">${login ? "Wer arbeitet gerade?" : "Weitere Person einchecken"}</h2>
      <p>${SHIFT_META[shift].label} ${plan[shift].start}–${plan[shift].end}. Name antippen zum Einchecken – Haken und Notizen werden mit deinem Namen gespeichert.</p>
      ${checked.length ? `<div class="grp in">Schon eingecheckt – antippen, um weiterzuarbeiten</div><div class="names">${checked.map(p => { const o = openEntry(today, p.id); return `<button class="namebtn inn" data-pick="${esc(p.id)}"><span class="av">${esc(initials(p.name))}</span><span>${esc(p.name)}<small class="ninfo ok">${ROLE_LABEL[o.entry.role] || ""} seit ${o.entry.in}</small></span></button>`; }).join("")}</div>` : ""}
      ${inSched.length ? `<div class="grp">Laut Dienstplan</div><div class="names">${inSched.map(p => btn(p, "sched")).join("")}</div>` : ""}
      <div class="grp">${inSched.length ? "Andere" : "Team"}</div><div class="names">${others.map(p => btn(p, "")).join("")}${state.pickAdd ? "" : addForm}</div>
      ${state.pickAdd ? addForm : ""}
      <div class="row">${login ? `<button class="btn ghost" data-pick-close="1">Nur ansehen</button>` : `<button class="btn ghost" data-pick-cancel="1">Abbrechen</button>`}</div>
    </div></div>`;
    const focus = el.querySelector("#pk-new") || el.querySelector(".namebtn.sched") || el.querySelector(".namebtn");
    if (focus) focus.focus();
  }
  // Neue Person aus der Anmeldemaske: ohne PIN (Vertrauensbasis). Gleicher Name → vorhandene Person nehmen.
  async function addPersonAndPick(raw) {
    const name = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) { const i = $("pk-new"); if (i) i.focus(); return; }
    const known = state.cfg.people.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (known) return pickPerson(known.id);
    const np = { id: newId("u"), name }, people = [...state.cfg.people, np];
    state.cfg = { ...state.cfg, people };
    persistCfg({ people });
    pickPerson(np.id);
  }
  function setActive(pid, role) {
    const today = isoDate(new Date());
    state.who = { date: today, shift: role, id: pid };
    LS.set("rz2who", state.who);
  }
  // Name angetippt: schon eingecheckt → nur wechseln, sonst Einchecken-Fenster.
  function pickPerson(id) {
    const today = isoDate(new Date());
    if (state.date !== today) goDate(today);
    const open = openEntry(today, id);
    if (open) {
      setActive(id, open.entry.role);
      closePicker(); render();
      toast(`${personName(id)} ist aktiv`);
      return;
    }
    const plan = resolvePlan(today, state.dayPlan).plan, now = nowMin();
    const role = rosterRole(today, id) || focusShift(plan, now);
    const planned = ["frueh", "spaet"].includes(role) ? plan[role].start : null;
    state.checkin = { pid: id, time: fmtMin(roundQ(now)), role, planned, stale: staleOpenEntries(id, today).map(x => ({ ...x, out: x.entry.out || null, pause: null })) };
    renderPicker();
  }
  function renderCheckin() {
    const c = state.checkin, el = $("picker");
    const now = fmtMin(roundQ(nowMin()));
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="ci-title"><div class="dialog">
      <h2 id="ci-title">Einchecken · ${esc(personName(c.pid))}</h2>
      ${c.stale.map((x, i) => `<div class="stale"><b>Nicht ausgecheckt am ${WD[parseIso(x.date).getDay()].slice(0, 2)} ${pad(parseIso(x.date).getDate())}.${pad(parseIso(x.date).getMonth() + 1)}.</b> (Beginn ${x.entry.in}) – bis wann warst du da?
        <div class="trow"><label>Ende ${timeSelect("ci-stale-" + i, x.out || fmtMin(Math.min(1425, toMin(x.entry.in) + 480)))}</label><label>Pause ${pauseSelect("ci-stalep-" + i, x.pause ?? suggestPause(480))}</label></div></div>`).join("")}
      <div class="trow big"><label>Beginn ${timeSelect("ci-time", c.time)}</label>
        <span class="quick"><button class="chip${c.time === now ? "" : " off"}" data-ciq="${now}">Jetzt ${now}</button>${c.planned ? `<button class="chip${c.time === c.planned ? "" : " off"}" data-ciq="${c.planned}">laut Plan ${c.planned}</button>` : ""}</span></div>
      <div class="trow"><span>Als</span><div class="seg">${["frueh", "spaet", "aushilfe"].map(r => `<button class="segbtn${c.role === r ? " on" : ""}" data-cirole="${r}">${ROLE_LABEL[r]}</button>`).join("")}</div></div>
      <label class="tnote">Notiz (optional) <input class="in" id="ci-note" maxlength="200" value="${esc(c.note || "")}" placeholder="optional"></label>
      <div class="row"><button class="btn ghost" data-ci="cancel">Abbrechen</button><button class="btn primary" data-ci="ok">Einchecken</button></div>
    </div></div>`;
  }
  async function confirmCheckin() {
    const c = state.checkin; if (!c) return;
    const today = isoDate(new Date());
    // Vergessene Einträge zuerst abschließen.
    c.stale.forEach((x, i) => {
      const out = ($("ci-stale-" + i) || {}).value || null, pause = Number(($("ci-stalep-" + i) || {}).value || 0);
      if (out) persistTime(x.date, x.id, { ...x.entry, out, pause });
    });
    const id = newId("t");
    const entry = { pid: c.pid, role: c.role, in: c.time, out: null, pause: null, note: (c.note || "").trim().slice(0, 200), at: new Date().toISOString(), editedAt: null, orig: null };
    state.checkin = null;
    persistTime(today, id, entry);
    setActive(c.pid, c.role);
    state.shiftSel = null; state.viewOnly = false; state.byeSeen = false;
    LS.set("rz2bye", null);
    closePicker(); render();
    setStatus(`${personName(c.pid)} eingecheckt um ${entry.in}`);
    autoBackup("shift");
    maybeShowHandover(c.role);
  }

  // ---------- Auschecken ----------
  function openCheckout(pid) {
    const today = isoDate(new Date());
    if (state.date !== today) goDate(today);
    const open = openEntry(today, pid || (state.who && state.who.id));
    if (!open) { openPicker(); return; }
    const out = fmtMin(roundQ(nowMin()));
    let gross = toMin(out) - toMin(open.entry.in); if (gross < 0) gross += 1440;
    state.checkout = { ...open, out, pause: suggestPause(gross), pauseTouched: false, note: open.entry.note || "" };
    renderCheckout();
  }
  // Früh- und Spätschicht checken erst aus, wenn ihre Schicht (Aufgaben und Pflicht-Bestätigungen) bei 100 % ist – unabhängig davon, wer was erledigt hat.
  function shiftOpenList(key) {
    const plan = P(), d = derive(plan);
    const items = d.ids[key].filter(id => !state.checks[id]).map(id => d.item[id]);
    return { items, confirms: pendingConfirms(plan, key), pr: progress(plan, key, state.checks) };
  }
  function checkoutGate(c) {
    if (!c || c.date !== isoDate(new Date()) || state.date !== c.date || !KEYS.includes(c.entry.role)) return null;
    const g = shiftOpenList(c.entry.role);
    return g.items.length || g.confirms.length ? { key: c.entry.role, ...g } : null;
  }
  function renderCheckout() {
    const c = state.checkout, el = $("remind");
    if (!c) { el.hidden = true; el.innerHTML = ""; renderRemind(); return; }
    const today = isoDate(new Date());
    const others = Object.entries(timeOf(today)).filter(([, e]) => e && !e.out);
    const mins = workedMin({ in: c.entry.in, out: c.out, pause: c.pause });
    const gate = checkoutGate(c);
    const openList = gate ? `<p>${SHIFT_META[gate.key].label}: noch <b>${gate.items.length + gate.confirms.length} offen</b> (${gate.pr.pct} %). Hake sie hier ab oder setze optionale Punkte auf „entfällt“. Bleibt etwas offen, ist ein Grund nötig.</p>
      <ul class="coopen">${gate.items.map(i => `<li><button class="cobox" data-cocheck="${esc(i.id)}" aria-label="${esc(i.t)} abhaken"></button><span><b>${esc(i.t)}</b><small>${esc(i.phase.from)} ${esc(i.phase.title)}${i.optional ? " · optional" : ""}</small></span>${i.optional ? `<button class="btn sm" data-coskip="${esc(i.id)}">entfällt</button>` : ""}</li>`).join("")}${gate.confirms.map(a => `<li><button class="cobox" data-coconfirm="${esc(a.id)}" aria-label="${esc(a.t)} bestätigen"></button><span><b>${esc(a.t)}</b><small>Pflicht · einmal pro Schicht bestätigen</small></span></li>`).join("")}</ul>` : "";
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="co-title"><div class="dialog">
      <h2 id="co-title">Auschecken</h2>
      ${others.length > 1 ? `<div class="trow"><span>Wer</span><div class="seg">${others.map(([id, e]) => `<button class="segbtn${id === c.id ? " on" : ""}" data-coid="${esc(id)}">${esc(personName(e.pid))}</button>`).join("")}</div></div>` : `<p><b>${esc(personName(c.entry.pid))}</b> · ${ROLE_LABEL[c.entry.role]} · eingecheckt um ${c.entry.in}</p>`}
      <div class="trow big"><label>Ende ${timeSelect("co-time", c.out)}</label><label>Pause ${pauseSelect("co-pause", c.pause)}</label></div>
      <label class="tnote">Notiz (optional) <input class="in" id="co-note" maxlength="200" value="${esc(c.note || "")}" placeholder="optional"></label>
      <p>Arbeitszeit: <b>${fmtHours(mins)} Std.</b> (${c.entry.in}–${c.out}, ${c.pause} Min. Pause)</p>
      ${openList}
      ${gate ? `<label class="tnote">Grund, warum Punkte offen bleiben <textarea class="in" id="co-reason" maxlength="300" rows="2" placeholder="Pflichtangabe, wenn nicht alles erledigt ist">${esc(c.reason || "")}</textarea></label>` : ""}
      <div class="row">${gate ? `<button class="btn" data-co="flag">Zurück zur Schicht</button><button class="btn primary" data-co="ok" ${(c.reason || "").trim() ? "" : "disabled"}>Mit Grund auschecken</button>` : `<button class="btn ghost" data-co="cancel">Abbrechen</button><button class="btn primary" data-co="ok">Auschecken</button>`}</div>
    </div></div>`;
  }
  function confirmCheckout() {
    const c = state.checkout; if (!c) return;
    const gate = checkoutGate(c), reason = (c.reason || "").trim().slice(0, 300);
    if (gate && !reason) return renderCheckout();
    state.coFlag = null;
    const open = gate ? { open: { n: gate.items.length + gate.confirms.length, reason } } : {};
    persistTime(c.date, c.id, { ...c.entry, out: c.out, pause: c.pause, note: (c.note || "").trim().slice(0, 200), ...open });
    if (state.who && state.who.id === c.entry.pid) { state.who = null; LS.set("rz2who", null); }
    state.checkout = null;
    const name = personName(c.entry.pid), hours = fmtHours(workedMin({ in: c.entry.in, out: c.out, pause: c.pause }));
    renderCheckout();
    // Noch jemand da: der/die Nächste wird aktiv, kurzer Gruß. Sonst Feierabend-Bildschirm (bleibt bis zur nächsten Anmeldung).
    ensureActive();
    if (presentPeople().length) toast(`Schönen Feierabend, ${name}!`);
    else { LS.set("rz2bye", { date: isoDate(new Date()), name, out: c.out, hours }); state.byeSeen = false; state.viewOnly = false; openPicker("login"); }
    render();
    setStatus(`${name} ausgecheckt um ${c.out} · ${hours} Std.`);
    autoBackup("shift");
  }
  // Kurzer Hinweis unten in der Mitte.
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  // „Nur ansehen“: Hinweisleiste kurz aufleuchten lassen, wenn etwas gesperrt ist.
  function pulseViewOnly() {
    const b = $("vobar"); b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
  }
  $("outBtn").addEventListener("click", () => openCheckout());
  $("remind").addEventListener("input", (e) => {
    if (!state.checkout) return;
    if (e.target.id === "co-note") state.checkout.note = e.target.value;
    if (e.target.id === "co-reason") { state.checkout.reason = e.target.value; const ok = $("remind").querySelector('[data-co="ok"]'); if (ok) ok.disabled = !e.target.value.trim(); }
  });
  $("picker").addEventListener("input", (e) => { if (e.target.id === "ci-note" && state.checkin) state.checkin.note = e.target.value; });
  // Klicks/Änderungen im Ein-/Auschecken (Overlays liegen außerhalb von <main>)
  const stepSelect = (b) => { const sel = $(b.dataset.tstep); if (!sel) return; sel.selectedIndex = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + Number(b.dataset.dir))); sel.dispatchEvent(new Event("change", { bubbles: true })); };
  $("remind").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !state.checkout) return;
    if (b.dataset.tstep) return stepSelect(b);
    if (b.dataset.coid) {
      const t = timeOf(state.checkout.date)[b.dataset.coid];
      if (t) { let g = toMin(state.checkout.out) - toMin(t.in); if (g < 0) g += 1440; state.checkout = { ...state.checkout, id: b.dataset.coid, entry: t, pause: suggestPause(g), pauseTouched: false, note: t.note || "" }; renderCheckout(); }
      return;
    }
    if (b.dataset.co === "cancel") { state.checkout = null; renderCheckout(); return; }
    // Offene Punkte direkt im Fenster erledigen; „Zurück zur Schicht“ markiert sie im Fahrplan.
    const stamp = (st) => ({ s: st, by: actorId(), at: new Date().toISOString() });
    if (b.dataset.cocheck) { setCheck(b.dataset.cocheck, stamp("done")); renderCheckout(); return; }
    if (b.dataset.coskip) { setCheck(b.dataset.coskip, stamp("na")); renderCheckout(); return; }
    if (b.dataset.coconfirm) { const g = checkoutGate(state.checkout); if (g) logAlways(g.key, b.dataset.coconfirm); renderCheckout(); return; }
    if (b.dataset.co === "flag") {
      const g = checkoutGate(state.checkout);
      state.checkout = null; renderCheckout();
      if (g) { state.coFlag = g.key; state.shiftSel = g.key; if (state.view !== "schicht") setView("schicht"); else render(); }
      setTimeout(() => { const f = root.querySelector("li.flag, li.confirm.flag"); if (f && f.scrollIntoView) f.scrollIntoView({ block: "center", behavior: "smooth" }); }, 50);
      return;
    }
    if (b.dataset.co === "ok") return confirmCheckout();
  });
  $("remind").addEventListener("change", (e) => {
    const c = state.checkout; if (!c) return;
    if (e.target.id === "co-time") {
      c.out = e.target.value;
      if (!c.pauseTouched) { let g = toMin(c.out) - toMin(c.entry.in); if (g < 0) g += 1440; c.pause = suggestPause(g); }
      renderCheckout();
    } else if (e.target.id === "co-pause") { c.pause = Number(e.target.value); c.pauseTouched = true; renderCheckout(); }
  });
  $("picker").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.pick) return pickPerson(b.dataset.pick);
    if (b.dataset.pickClose) { state.viewOnly = true; closePicker(); render(); return; }
    if (b.dataset.pickCancel) { closePicker(); return; }
    if (b.dataset.byeNext) { state.byeSeen = true; renderPicker(); return; }
    if (b.dataset.pickAddtoggle) { state.pickAdd = !state.pickAdd; renderPicker(); return; }
    if (!state.checkin) return;
    if (b.dataset.tstep) return stepSelect(b);
    if (b.dataset.ciq) { state.checkin.time = b.dataset.ciq; renderPicker(); return; }
    if (b.dataset.cirole) { state.checkin.role = b.dataset.cirole; renderPicker(); return; }
    if (b.dataset.ci === "cancel") { state.checkin = null; renderPicker(); return; }
    if (b.dataset.ci === "ok") return confirmCheckin();
  });
  $("picker").addEventListener("submit", (e) => {
    if (e.target.id !== "pk-add") return;
    e.preventDefault();
    addPersonAndPick(($("pk-new") || {}).value);
  });
  $("picker").addEventListener("change", (e) => {
    const c = state.checkin; if (!c) return;
    if (e.target.id === "ci-time") { c.time = e.target.value; renderPicker(); }
    const m = e.target.id.match(/^ci-stale(p?)-(\d+)$/);
    if (m) { const x = c.stale[Number(m[2])]; if (m[1]) x.pause = Number(e.target.value); else x.out = e.target.value; }
  });
  const onKey = (e) => {
    // Die Anmeldemaske lässt sich nur über „Nur ansehen“ verlassen; Escape schließt Eingabe bzw. „+“-Fenster.
    if (e.key !== "Escape" || !state.pickerOpen) return;
    if (state.checkin) { state.checkin = null; renderPicker(); }
    else if (state.pickAdd) { state.pickAdd = false; renderPicker(); }
    else if (state.pickerMode === "add") closePicker();
  };
  document.addEventListener("keydown", onKey);
  cleanups.push(() => document.removeEventListener("keydown", onKey));
  // ---------- Pflicht-Erinnerung ----------
  // In den letzten 30 Minuten der laufenden Schicht: Fenster mit allen Pflichtpunkten, die noch nicht bestätigt sind.
  function remindTarget() {
    const today = isoDate(new Date());
    if (state.date !== today || state.mode === "loading") return null;
    // Niemand eingecheckt (z. B. nach dem Auschecken) → keine Erinnerung; das Auschecken warnt selbst vor offenen Pflichtpunkten.
    if (state.cfg.people.length && !currentPerson()) return null;
    const plan = P(), now = nowMin(), key = activeShift(plan, now);
    if (!key || toMin(plan[key].end) - now > 30) return null;
    const pending = pendingConfirms(plan, key);
    return pending.length ? { key, pending, end: plan[key].end } : null;
  }
  function el2clear() { const el = $("remind"); el.hidden = true; el.innerHTML = ""; renderRemind(); }
  function maybeRemind() {
    if (state.checkout || state.handPop || state.notePop || state.taskRem || state.pickerOpen || state.remindOpen) return;
    if (!["schicht", "dienst", "monat", "zeiten"].includes(state.view)) return;
    const tr = taskRemTarget();
    if (tr) { state.taskRem = tr; renderRemind(); return; }
    if (Date.now() < state.remindSnoozeUntil || state.view === "zeiten") return;
    if (remindTarget()) { state.remindOpen = true; renderRemind(); }
  }
  function renderRemind() {
    if (state.checkout) return;
    const el = $("remind");
    const hk = state.handPop;
    if (hk) {
      const hn = handIn(hk), hr = hn && handRead(hk, hn), today = isoDate(new Date());
      const from = hk === "frueh" ? "von der Spätschicht (gestern)" : "von der Frühschicht";
      const rnote = (rosterFor(today).notes || {})[hk];
      const unconf = hk === "spaet" ? pendingConfirms(P(), "frueh") : [];
      const extra = `${rnote ? `<p class="pnote">Anmerkung im Dienstplan: <b>${esc(rnote)}</b></p>` : ""}${unconf.length ? `<p class="pwarn">Von der Frühschicht nicht bestätigt: <b>${unconf.map(a => esc(a.t)).join(", ")}</b> – bitte prüfen.</p>` : ""}`;
      el.hidden = false;
      el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="hand-title"><div class="dialog">
        <h2 id="hand-title">${hn && hn.important ? '<span class="imptag">Wichtig</span> ' : ""}Übergabe ${from}</h2>
        ${hn ? `<div class="handpop${hn.important ? "" : " plain"}">${esc(hn.text)}</div><p class="hint">${noteAuthor(hn).replace(/^ · /, "")}</p>` : `<div class="handpop none">Keine Übergabe hinterlassen – es gibt nichts Besonderes zu beachten.</div>`}
        ${extra}
        ${hn && !hr ? `<label class="tnote">Rückmeldung oder Ergänzung (optional, steht danach unter der Übergabe) <textarea class="in" id="hand-reply" maxlength="300" rows="2" placeholder="optional"></textarea></label>` : ""}
        <div class="row">${hn && !hr ? `<button class="btn ghost" data-hlater="1">Später</button><button class="btn primary" data-hread="${hk}">Gelesen</button>` : `<button class="btn primary" data-hlater="1">OK</button>`}</div>
      </div></div>`;
      const ta = el.querySelector("#hand-reply"); if (ta) ta.focus();
      return;
    }
    state.handPop = null;
    const np = state.notePop;
    if (np) {
      if (el.querySelector("#notepop-text")) return; // schon offen: Eingabe nicht überschreiben
      const n = state.notes[np];
      el.hidden = false;
      el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="np-title"><div class="dialog">
        <h2 id="np-title">Übergabe ${np === "frueh" ? "für die Spätschicht" : "für die Frühschicht morgen"}</h2>
        <textarea class="in notepop" id="notepop-text" maxlength="4000" rows="6" placeholder="z. B. offene Rückrufe, Defekte, Lieferungen …">${esc((n && n.text) || "")}</textarea>
        <label class="impchk${n && n.important ? " on" : ""}"><input type="checkbox" id="notepop-imp" ${n && n.important ? "checked" : ""}> Wichtig – erscheint bei der nächsten Schicht rot</label>
        <div class="row"><button class="btn ghost" data-noteclose="1">Abbrechen</button><button class="btn primary" data-notesave="${np}">Speichern</button></div>
      </div></div>`;
      const ta = $("notepop-text"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }
    const tr = state.taskRem;
    if (tr) {
      const done = state.checks[tr.id];
      if (done && !tr.item.remindAlways) { state.taskRem = null; return renderRemind(); }
      el.hidden = false;
      el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="tr-title"><div class="dialog taskrem">
        <div class="trhead">${BELL_SVG}<span>${done ? "Zur Sicherheit" : "Erinnerung"} · ${esc(tr.item.remind)}</span></div>
        <h2 id="tr-title">${esc(tr.item.t)}</h2>${tr.item.s ? `<p>${esc(tr.item.s)}</p>` : ""}
        ${done ? `<p class="trdone">Schon ${whoLine(done)} – bitte kurz kontrollieren, ob alles passt.</p>` : ""}
        <div class="row"><button class="btn" data-trsnooze="${esc(tr.id)}">In 10 Minuten erinnern</button>${done
          ? `<button class="btn primary done" data-trok="${esc(tr.id)}">Kontrolliert</button>`
          : `<button class="btn primary done" data-trdone="${esc(tr.id)}">Erledigt</button>`}</div>
      </div></div>`;
      return;
    }
    const t = state.remindOpen ? remindTarget() : null;
    if (!t) { state.remindOpen = false; el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rem-title"><div class="dialog">
      <h2 id="rem-title">Vor Schichtende bestätigen</h2>
      <p>${SHIFT_META[t.key].label} endet um ${t.end} Uhr. Diese Punkte sind noch nicht bestätigt:</p>
      <ul class="remlist">${t.pending.map(a => `<li><span>${esc(a.t)}</span><button class="btn primary" data-rconfirm="${esc(a.id)}" data-shift="${t.key}">Erledigt</button></li>`).join("")}</ul>
      <div class="row"><button class="btn ghost" data-rsnooze="1">In 10 Minuten erinnern</button></div>
    </div></div>`;
  }
  $("remind").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.hread) { const r = $("hand-reply"); markHandRead(b.dataset.hread, r ? r.value : ""); state.handPop = null; renderRemind(); render(); return; }
    if (b.dataset.hlater) { state.handPop = null; renderRemind(); return; }
    if (b.dataset.trsnooze) { snoozeTaskRem(b.dataset.trsnooze, 10 * 60000); state.taskRem = null; el2clear(); return; }
    // Erledigte Aufgabe kontrolliert: für heute nicht mehr erinnern.
    if (b.dataset.trok) { snoozeTaskRem(b.dataset.trok, 24 * 3600000); state.taskRem = null; el2clear(); return; }
    if (b.dataset.trdone) { const id = b.dataset.trdone; snoozeTaskRem(id, 24 * 3600000); state.taskRem = null; setCheck(id, { s: "done", by: actorId(), at: new Date().toISOString() }); el2clear(); return; }
    if (b.dataset.noteclose) { state.notePop = null; el2clear(); return; }
    if (b.dataset.notesave) { const ta = $("notepop-text"), im = $("notepop-imp"); saveNote(b.dataset.notesave, ta ? ta.value : "", im ? im.checked : false); state.notePop = null; el2clear(); return; }
    if (b.dataset.rconfirm) { logAlways(b.dataset.shift, b.dataset.rconfirm); renderRemind(); return; }
    if (b.dataset.rsnooze) { state.remindOpen = false; state.remindSnoozeUntil = Date.now() + 10 * 60000; renderRemind(); }
  });

  // Anmeldemaske, sobald niemand eingecheckt ist (außer „Nur ansehen“ und in den PIN-Bereichen der Leitung).
  function maybeAskPerson() {
    if (state.mode === "loading" || state.pickerOpen || state.viewOnly || !state.cfg.people.length) return;
    if (["admin", "plan", "pin", "monat"].includes(state.view)) return;
    if (state.view === "dienst" && state.rosterEdit) return; // Leitung bearbeitet den Dienstplan
    ensureActive();
    if (currentPerson()) return;
    openPicker("login");
  }

  // ---------- Zeiten (Ansicht, Korrektur, Export) ----------
  async function loadTimes(ym) {
    state.timesData = { ym, days: {}, loading: true };
    let days = {};
    try {
      if (state.mode === "shared") {
        const snap = await db.collection("days").where("month", "==", ym).get();
        snap.docs.forEach(d => { if (d.exists) days[d.id] = normTimes(d.data().time); });
      } else {
        for (const [date, m] of Object.entries(LS.month(ym))) days[date] = m.time || {};
      }
    } catch { setStatus("Zeiten konnten nicht geladen werden", true); }
    if (state.timesData && state.timesData.ym === ym) { state.timesData = { ym, days }; if (state.view === "zeiten") render(); }
  }
  function timeRows(pidFilter) {
    const rows = [];
    for (const [date, t] of Object.entries((state.timesData && state.timesData.days) || {})) {
      for (const [id, e] of Object.entries(t || {})) if (e && (!pidFilter || e.pid === pidFilter)) rows.push({ id, date, e, mins: workedMin(e) });
    }
    return rows.sort((a, b) => (a.date + a.e.in).localeCompare(b.date + b.e.in) || personName(a.e.pid).localeCompare(personName(b.e.pid)));
  }
  function sums(rows) {
    const by = {};
    for (const r of rows) { const k = r.e.pid; by[k] = by[k] || { pid: k, days: new Set(), mins: 0, open: 0 }; by[k].days.add(r.date); if (r.mins !== null) by[k].mins += r.mins; else by[k].open++; }
    return Object.values(by).map(x => ({ ...x, days: x.days.size })).sort((a, b) => personName(a.pid).localeCompare(personName(b.pid)));
  }
  const dateLabel = (date) => { const d = parseIso(date); return `${WD[d.getDay()].slice(0, 2)} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
  function renderTimes() {
    const ym = state.timesMonth || state.date.slice(0, 7);
    if (!state.timesData || state.timesData.ym !== ym) { loadTimes(ym); }
    const [y, m] = ym.split("-").map(Number);
    const head = `<div class="monthhead">
        <button class="iconbtn" id="tprev" aria-label="Vorheriger Monat">‹</button>
        <h2>Zeiten ${MONTHS[m - 1]} ${y}</h2>
        <button class="iconbtn" id="tnext" aria-label="Nächster Monat">›</button>
        ${state.timesAll && isUnlocked() ? `<select id="t-person" aria-label="Person"><option value="">Alle</option>${state.cfg.people.map(p => `<option value="${esc(p.id)}"${state.timesPerson === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
          <button class="btn" data-act2="t-add">+ Eintrag</button>
          <button class="btn" data-act2="t-xlsx">Excel</button><button class="btn primary" data-act2="t-pdf">PDF</button>`
          : `<button class="btn" data-act2="t-all">Alle Zeiten (Leitung)</button>`}
      </div>`;
    // Mit Leitungs-PIN sieht jede Person nur ihre eigenen Zeiten (= die eingecheckte Person), alle anderen nur die Leitung.
    // Ohne PIN (nicht festgelegt oder „off“) bleibt die Namenswahl.
    const ownOnly = timesOwnOnly();
    if (!state.timesAll || !isUnlocked()) {
      state.timesAll = false;
      if (ownOnly) {
        const cp = currentPerson();
        state.timesPerson = cp ? cp.id : null;
        if (!cp) return head + `<section class="card tpick"><div class="chead"><h2>Eigene Zeiten</h2></div><div class="cbody"><p>Checke dich ein, um deine eigenen Zeiten zu sehen. Die Zeiten anderer sieht nur die Leitung.</p></div></section>`;
      } else if (!state.timesPerson) {
        return head + `<section class="card tpick"><div class="chead"><h2>Eigene Zeiten ansehen</h2></div><div class="cbody"><div class="names">${state.cfg.people.map(p => `<button class="namebtn" data-tperson="${esc(p.id)}"><span class="av">${esc(initials(p.name))}</span>${esc(p.name)}</button>`).join("") || "<p>Noch kein Team angelegt.</p>"}</div></div></section>`;
      }
    }
    const pid = state.timesPerson || null;
    const rows = timeRows(pid);
    const loading = state.timesData && state.timesData.loading;
    const body = rows.map(r => {
      const planned = plannedFor(r.date, r.e.pid, r.e.role);
      const edited = r.e.orig ? ` <span class="pill later" title="ursprünglich ${esc([r.e.orig.in, r.e.orig.out].filter(Boolean).join("–"))}${r.e.orig.pause !== null ? ", Pause " + r.e.orig.pause : ""}">korrigiert</span>` : "";
      return `<tr class="${r.e.out ? "" : "openrow"}"><td>${dateLabel(r.date)}</td><td>${esc(personName(r.e.pid) || "?")}</td><td>${ROLE_LABEL[r.e.role]}</td><td>${r.e.in}</td><td>${r.e.out || "<b>offen</b>"}</td><td>${r.e.pause !== null ? r.e.pause + " Min." : "–"}</td><td class="num">${fmtHours(r.mins)}</td><td class="muted">${planned || "–"}</td><td class="tnotecell${r.e.open ? " gap" : ""}" title="${esc(timeNote(r.e))}">${esc(timeNote(r.e))}</td><td>${edited}${state.timesAll && isUnlocked() ? ` <button class="mini edit" data-tedit="${esc(r.date)}|${esc(r.id)}" aria-label="Bearbeiten">✎</button>` : ""}</td></tr>`;
    }).join("");
    const sm = sums(rows);
    return head + `<div class="times">
      <section class="card"><div class="chead"><h2>${pid ? esc(personName(pid)) : "Alle"}</h2><span class="hint">${rows.length} Einträge${loading ? " · lädt…" : ""}</span>${!state.timesAll && !ownOnly ? `<button class="btn ghost" data-act2="t-back">Andere Person</button>` : ""}</div>
        <div class="cbody tscroll"><table class="ttab"><thead><tr><th>Datum</th><th>Name</th><th>Rolle</th><th>Ein</th><th>Aus</th><th>Pause</th><th>Stunden</th><th>Geplant</th><th>Notiz</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="10" class="empty">Keine Einträge in diesem Monat.</td></tr>`}</tbody></table></div></section>
      <section class="card"><div class="chead"><h2>Summe</h2></div><div class="cbody"><table class="ttab"><thead><tr><th>Name</th><th>Tage</th><th>Stunden</th><th>Offen</th></tr></thead><tbody>${sm.map(x => `<tr><td>${esc(personName(x.pid))}</td><td>${x.days}</td><td class="num">${x.mins || !x.open ? fmtHours(x.mins) : "–"}</td><td>${x.open || ""}</td></tr>`).join("")}</tbody></table></div></section>
    </div>${state.timesEdit ? renderTimeEdit() : ""}`;
  }
  function renderTimeEdit() {
    const ed = state.timesEdit;
    return `<div class="overlay inmain" role="dialog" aria-modal="true"><div class="dialog">
      <h2>${ed.id ? "Eintrag korrigieren" : "Eintrag hinzufügen"}</h2>
      <div class="trow"><label>Datum <input type="date" id="te-date" class="in" value="${ed.date}" ${ed.id ? "disabled" : ""}></label>
        <label>Person <select id="te-pid">${state.cfg.people.map(p => `<option value="${esc(p.id)}"${ed.e.pid === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
        <label>Rolle <select id="te-role">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}"${ed.e.role === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <div class="trow"><label>Ein ${timeSelect("te-in", ed.e.in)}</label><label>Aus ${timeSelect("te-out", ed.e.out || "", { allowOpen: true })}</label><label>Pause ${pauseSelect("te-pause", ed.e.pause || 0)}</label></div>
      <label class="tnote">Notiz <input class="in" id="te-note" maxlength="200" value="${esc(ed.e.note || "")}"></label>
      ${ed.e.orig ? `<p class="muted">Ursprünglich: ${esc([ed.e.orig.in, ed.e.orig.out].filter(Boolean).join("–"))}${ed.e.orig.pause !== null ? `, Pause ${ed.e.orig.pause} Min.` : ""}</p>` : ""}
      <div class="row">${ed.id ? `<button class="btn ghost danger" data-act2="te-del">${state.confirm === "te-del" ? "Wirklich löschen?" : "Löschen"}</button>` : ""}<button class="btn ghost" data-act2="te-cancel">Abbrechen</button><button class="btn primary" data-act2="te-save">Speichern</button></div>
    </div></div>`;
  }
  function saveTimeEdit() {
    const ed = state.timesEdit; if (!ed) return;
    const val = (id) => ($(id) || {}).value;
    const date = ed.id ? ed.date : val("te-date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) { setStatus("Bitte ein Datum wählen", true); return; }
    const e = { ...ed.e, pid: val("te-pid"), role: val("te-role"), in: val("te-in"), out: val("te-out") || null, pause: Number(val("te-pause") || 0), note: String(val("te-note") || "").trim().slice(0, 200) };
    if (ed.id) {
      const before = ed.e;
      if (before.in !== e.in || before.out !== e.out || (before.pause || 0) !== e.pause) {
        e.orig = before.orig || { in: before.in, out: before.out, pause: before.pause };
        e.editedAt = new Date().toISOString();
      }
    } else { e.at = new Date().toISOString(); e.orig = { in: null, out: null, pause: null }; e.editedAt = e.at; }
    persistTime(date, ed.id || newId("t"), e);
    state.timesEdit = null; state.confirm = null;
    render();
    setStatus("Zeit gespeichert");
  }

  // Export-Dateien ohne Fremdbibliothek: XLSX (ZIP mit SpreadsheetML) und PDF (A4 quer, Helvetica).
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    for (const [name, text] of files) {
      const data = enc.encode(text), nameB = enc.encode(name), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameB.length, true);
      parts.push(new Uint8Array(lh.buffer), nameB, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const csize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let o = 0;
    for (const p of all) { out.set(p, o); o += p.length; }
    return out;
  }
  const xmlEsc = (v) => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function sheetXml(rows, widths) {
    const col = (i) => String.fromCharCode(65 + i);
    const cells = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === null || v === "" ? "" : typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"${ri === 0 ? ' s="1"' : ""}><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t>${xmlEsc(v)}</t></is></c>`).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${cells}</sheetData></worksheet>`;
  }
  function exportTables() {
    const rows = timeRows(state.timesPerson || null), [y, m] = (state.timesMonth || state.date.slice(0, 7)).split("-").map(Number);
    const detail = [["Datum", "Name", "Rolle", "Ein", "Aus", "Pause (Min.)", "Stunden", "Stunden (dezimal)", "Geplant", "Korrigiert", "Notiz"]]
      .concat(rows.map(r => [`${dateLabel(r.date)}${y}`, personName(r.e.pid), ROLE_LABEL[r.e.role], r.e.in, r.e.out || "offen", r.e.pause ?? "", fmtHours(r.mins), r.mins === null ? "" : Math.round(r.mins / 60 * 100) / 100, plannedFor(r.date, r.e.pid, r.e.role) || "", r.e.orig ? "ja" : "", timeNote(r.e)]));
    const summary = [["Name", "Tage", "Stunden", "Stunden (dezimal)", "Offene Einträge"]]
      .concat(sums(rows).map(x => [personName(x.pid), x.days, x.mins || !x.open ? fmtHours(x.mins) : "–", Math.round(x.mins / 60 * 100) / 100, x.open || ""]));
    const who = state.timesPerson ? personName(state.timesPerson) : "Alle";
    return { detail, summary, title: `Arbeitszeiten ${MONTHS[m - 1]} ${y} – ${who}`, base: `Zeiten-${y}-${pad(m)}-${who.replace(/[^\wÄÖÜäöüß-]+/g, "_")}` };
  }
  function buildXlsx() {
    const t = exportTables();
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Zeiten" sheetId="1" r:id="rId1"/><sheet name="Summe" sheetId="2" r:id="rId2"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
      ["xl/worksheets/sheet1.xml", sheetXml(t.detail, [14, 16, 10, 8, 8, 12, 9, 16, 14, 11, 40])],
      ["xl/worksheets/sheet2.xml", sheetXml(t.summary, [18, 8, 10, 16, 15])],
    ];
    return { name: t.base + ".xlsx", bytes: zipStore(files), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  function buildPdf() {
    const t = exportTables();
    // WinAnsi: Umlaute/ß liegen wie Latin-1; Gedankenstrich auf 0x96.
    const enc = (str) => { const out = []; for (const ch of String(str)) { const c = ch.codePointAt(0); out.push(c === 0x2013 ? 0x96 : c === 0x2026 ? 0x85 : c < 256 ? c : 0x3f); } return out; };
    const pdfStr = (str) => "(" + enc(str).map(b => b === 0x28 || b === 0x29 || b === 0x5c ? "\\" + String.fromCharCode(b) : b < 32 || b > 126 ? "\\" + b.toString(8).padStart(3, "0") : String.fromCharCode(b)).join("") + ")";
    const W = 842, H = 595, M = 36, RH = 16;
    const cols = [[0, "Datum"], [80, "Name"], [190, "Rolle"], [255, "Ein"], [305, "Aus"], [355, "Pause"], [410, "Stunden"], [465, "Geplant"], [540, "Korr."], [580, "Notiz"]];
    const pages = []; let ops = [], y = 0;
    const newPage = () => { if (ops.length) pages.push(ops.join("\n")); ops = []; y = H - M; text(M, y, t.title, 14, true); text(W - M - 160, y, `erstellt ${new Date().toLocaleDateString("de-DE")}`, 9); y -= 26; };
    const text = (x, yy, s2, size = 9, bold = false) => ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${yy} Td ${pdfStr(s2)} Tj ET`);
    const line = (yy) => ops.push(`0.8 G 0.5 w ${M} ${yy} m ${W - M} ${yy} l S`);
    const header = (labels, xs) => { labels.forEach((l, i) => text(M + xs[i], y, l, 9, true)); y -= 5; line(y); y -= RH - 5; };
    newPage();
    header(cols.map(c => c[1]), cols.map(c => c[0]));
    for (const r of t.detail.slice(1)) {
      if (y < M + RH) { newPage(); header(cols.map(c => c[1]), cols.map(c => c[0])); }
      const v = [r[0], r[1], r[2], r[3], r[4], r[5] === "" ? "–" : r[5] + " Min.", r[6], r[8] || "–", r[9], r[10]];
      v.forEach((s2, i) => text(M + cols[i][0], y, String(s2).slice(0, i === 9 ? 48 : 22)));
      y -= RH;
    }
    y -= 12;
    if (y < M + RH * (t.summary.length + 2)) newPage();
    text(M, y, "Summe", 11, true); y -= 18;
    const scol = [0, 160, 220, 300];
    header(["Name", "Tage", "Stunden", "Offen"], scol);
    for (const r of t.summary.slice(1)) { [r[0], r[1], r[2], r[4]].forEach((s2, i) => text(M + scol[i], y, String(s2))); y -= RH; }
    pages.push(ops.join("\n"));
    // Objekte: 1 Katalog, 2 Seitenbaum, 3/4 Schriften, danach je Seite Seite + Inhalt
    const objs = [];
    const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
    objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
    objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
    pages.forEach((content, i) => {
      objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
      objs[6 + i * 2] = { stream: content };
    });
    const bytes = []; const push = (str) => { for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff); };
    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    const offsets = [];
    for (let n = 1; n < objs.length; n++) {
      offsets[n] = bytes.length;
      const o = objs[n];
      if (typeof o === "string") push(`${n} 0 obj\n${o}\nendobj\n`);
      else push(`${n} 0 obj\n<< /Length ${o.stream.length} >>\nstream\n${o.stream}\nendstream\nendobj\n`);
    }
    const xref = bytes.length;
    push(`xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return { name: t.base + ".pdf", bytes: new Uint8Array(bytes), type: "application/pdf" };
  }
  async function saveExport(file) {
    try {
      if (NATIVE && NATIVE.saveExport) {
        const r = await NATIVE.saveExport(file.name, file.bytes);
        if (r && r.ok) setStatus("Gespeichert: " + r.path); else if (r && r.canceled) setStatus(statusLine()); else setStatus("Export fehlgeschlagen" + (r && r.error ? ": " + r.error : ""), true);
        return;
      }
      if (await offerFile(file.name, file.bytes, file.type)) setStatus("Export erstellt: " + file.name);
    } catch (e) { setStatus("Export fehlgeschlagen: " + ((e && e.message) || "Fehler"), true); }
  }
  // Datei anbieten: in claude.ai über die downloads-Fähigkeit (Rückfrage beim Nutzer), sonst als normaler Download.
  // Liefert false, wenn der Nutzer ablehnt.
  async function offerFile(name, data, type) {
    const dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads").catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: name, data: new Blob([data], { type }) }); return true; }
      catch (e) {
        if (e && e.code === "declined") { setStatus(statusLine()); return false; }
        if (e && e.code === "rate_limited") { setStatus("Bitte kurz warten und erneut versuchen", true); return false; }
        throw new Error((e && e.message) || "Download nicht möglich");
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  }

  // ---------- Aufgaben-Plan (Editor) ----------
  // Ein Plan für alle Tage: gleiche Abschnitte und Aufgaben, eigene Uhrzeiten für Mo–Fr (im Plan selbst) und Sa+So (cfg.master.we).
  // Jede Änderung gilt sofort. Gespeichert wird der Plan zusätzlich als Wochentag-Vorlage für alle 7 Tage und als Standard –
  // so gilt er über resolvePlan unverändert (auch in älteren Versionen). Vergangene Tage behalten ihren festgehaltenen Stand (snap).
  const WEEKEND = [0, 6];
  // Nächstes Datum ab dem angezeigten Tag mit diesem Wochentag – liefert den Plan, der dort ohne Tagesanpassung gilt.
  function dateForWeekday(wd) {
    let d = state.date;
    for (let i = 0; i < 7 && parseIso(d).getDay() !== wd; i++) d = addDays(d, 1);
    return d;
  }
  // Schichtbeginn/-ende wachsen mit, wenn ein Abschnitt früher beginnt oder später endet.
  function fitShift(s) {
    s.phases = sortPhases(s.phases);
    if (!s.phases.length) return;
    const first = Math.min(...s.phases.map(p => toMin(p.from))), last = Math.max(...s.phases.map(p => toMin(p.to)));
    if (first < toMin(s.start)) s.start = fmtMin(first);
    if (last > toMin(s.end)) s.end = fmtMin(last);
  }
  function normalizeMaster(raw) {
    if (!raw || typeof raw !== "object") return null;
    const plan = normalizePlan(raw.plan);
    if (!plan) return null;
    const src = raw.we && typeof raw.we === "object" ? raw.we : {};
    const we = { phases: {}, remind: {} };
    for (const k of KEYS) {
      const s = (src[k] && typeof src[k] === "object") ? src[k] : {};
      we[k] = { start: TIME_RE.test(s.start) ? s.start : plan[k].start, end: TIME_RE.test(s.end) ? s.end : plan[k].end };
      for (const p of plan[k].phases) {
        const t = src.phases && src.phases[p.id];
        we.phases[p.id] = t && TIME_RE.test(t.from) && TIME_RE.test(t.to) && toMin(t.to) > toMin(t.from) ? { from: t.from, to: t.to } : { from: p.from, to: p.to };
        for (const i of p.items) if (i.remind) { const r = src.remind && src.remind[i.id]; we.remind[i.id] = TIME_RE.test(r) ? r : i.remind; }
      }
    }
    return { plan, we };
  }
  // Plan für Mo–Fr ("wk") oder Sa+So ("we") aus dem gemeinsamen Plan bauen.
  function materialize(master, which) {
    const plan = clone(master.plan);
    if (which !== "we") return plan;
    for (const k of KEYS) {
      for (const p of plan[k].phases) {
        const t = master.we.phases[p.id]; if (t) { p.from = t.from; p.to = t.to; }
        for (const i of p.items) if (i.remind) i.remind = master.we.remind[i.id] || i.remind;
      }
      plan[k].start = master.we[k].start; plan[k].end = master.we[k].end;
      fitShift(plan[k]);
    }
    return plan;
  }
  // Erster Start des neuen Editors: bisherige Vorlagen zusammenführen (Montag = Zeiten Mo–Fr, Samstag = Zeiten Sa+So).
  // Aufgaben, die es bisher nur an einem Tag gab, gelten danach an allen Tagen.
  function masterFromTemplates() {
    const wk = clone(resolvePlan(dateForWeekday(1), null, true).plan), sat = resolvePlan(dateForWeekday(6), null, true).plan;
    const we = { phases: {}, remind: {} };
    for (const k of KEYS) {
      we[k] = { start: sat[k].start, end: sat[k].end };
      const ids = new Set(wk[k].phases.flatMap(p => p.items.map(i => i.id)));
      for (const sp of sat[k].phases) {
        let mp = wk[k].phases.find(p => p.id === sp.id);
        if (!mp) { mp = { ...clone(sp), items: [] }; wk[k].phases.push(mp); }
        we.phases[mp.id] = { from: sp.from, to: sp.to };
        for (const i of sp.items) if (!ids.has(i.id)) { mp.items.push(clone(i)); ids.add(i.id); }
      }
      const aids = new Set(wk.always[k].map(a => a.id));
      for (const a of sat.always[k]) if (!aids.has(a.id)) wk.always[k].push(clone(a));
      fitShift(wk[k]);
    }
    return normalizeMaster({ plan: wk, we });
  }
  const getMaster = () => state.cfg.master || masterFromTemplates();
  // Beim Öffnen ist der erste Abschnitt aufgeklappt, die übrigen sind eine Zeile.
  function openFirstPhase() { const p = getMaster().plan[state.edShift].phases[0]; state.edOpen = new Set(p ? [p.id] : []); }
  // Änderung anwenden und sofort speichern. mutator bekommt eine Arbeitskopie; false = abbrechen.
  function editMaster(mutator) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return false; }
    if (!isUnlocked()) { requireAdmin("plan"); return false; }
    const m = clone(getMaster());
    if (mutator(m) === false) return false;
    for (const k of KEYS) {
      fitShift(m.plan[k]);
      const t = m.plan[k].phases.map(p => m.we.phases[p.id]).filter(Boolean);
      if (t.length) {
        const first = Math.min(...t.map(x => toMin(x.from))), last = Math.max(...t.map(x => toMin(x.to)));
        if (first < toMin(m.we[k].start)) m.we[k].start = fmtMin(first);
        if (last > toMin(m.we[k].end)) m.we[k].end = fmtMin(last);
      }
    }
    const master = normalizeMaster(m);
    if (!master) { setStatus("Plan ungültig – bitte Uhrzeiten prüfen", true); return false; }
    const wk = materialize(master, "wk"), we = materialize(master, "we"), weekday = {};
    for (let d = 0; d < 7; d++) weekday[String(d)] = WEEKEND.includes(d) ? we : wk;
    state.unlockedUntil = Date.now() + 10 * 60000;
    state.cfg = { ...state.cfg, master, weekday, base: wk };
    persistCfg({ master, weekday, base: wk }).then(ok => { if (ok) setStatus("Aufgaben-Plan gespeichert – gilt ab sofort"); });
    refreshTodaySnap();
    return true;
  }
  const findPhase = (m, key, pid) => m.plan[key].phases.find(p => p.id === pid);
  function findItem(m, key, id) {
    for (const p of m.plan[key].phases) { const i = p.items.findIndex(x => x.id === id); if (i >= 0) return { phase: p, idx: i, item: p.items[i] }; }
    return null;
  }

  const BELL_SVG = '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"></path></svg>';
  const KIND_LABEL = { rhythm: "regelmäßig", confirm: "Pflicht", hint: "Hinweis" };
  function timesLabel(wk, we) {
    return wk.from === we.from && wk.to === we.to ? `täglich ${wk.from}–${wk.to}` : `Mo–Fr ${wk.from}–${wk.to} · Sa+So ${we.from}–${we.to}`;
  }
  function renderEditor() {
    const m = getMaster(), key = state.edShift, s = m.plan[key], wes = m.we[key];
    const shiftTimes = timesLabel({ from: s.start, to: s.end }, { from: wes.start, to: wes.end });
    const seg = KEYS.map(k => `<button class="segbtn${k === key ? " on" : ""}" data-edshift="${k}" aria-pressed="${k === key}">${SHIFT_META[k].label}</button>`).join("");
    const phases = s.phases.map(p => {
      const open = state.edOpen.has(p.id) || state.edAdd === p.id;
      const rows = p.items.map(i => {
        const rem = i.remind ? `<span class="badge rem">${BELL_SVG}${esc(i.remind === m.we.remind[i.id] ? i.remind : `${i.remind} / ${m.we.remind[i.id]}`)}${i.remindAlways ? " · immer" : ""}</span>` : "";
        return `<li data-id="${esc(i.id)}"${state.edNew === i.id ? ' class="new"' : ""}><span class="grip" data-grip="1" aria-hidden="true" title="Ziehen zum Sortieren">⋮⋮</span>
          <button class="edtxt${i.important ? " imp" : ""}" data-editem="${esc(i.id)}">${esc(i.t)}${i.s ? `<small>${esc(i.s)}</small>` : ""}</button>
          ${i.optional ? '<span class="badge">darf entfallen</span>' : ""}${rem}</li>`;
      }).join("");
      const add = state.edAdd === p.id
        ? `<form class="edadd" data-addto="${esc(p.id)}"><label for="ed-new">Neue Aufgabe</label><input class="in" id="ed-new" maxlength="200" autocomplete="off" placeholder="Text eingeben, Enter"><button class="btn primary" type="submit">Hinzufügen</button><button class="btn ghost" type="button" data-edaddclose="1">Fertig</button></form>`
        : `<button class="addrow" data-edadd="${esc(p.id)}">+ Aufgabe</button>`;
      return `<section class="card edphase">
        <div class="edhead"><button class="edtoggle" data-edopen="${esc(p.id)}" aria-expanded="${open}"><span class="ttl">${esc(p.title)}</span><span class="tm">${timesLabel(p, m.we.phases[p.id])}</span>${open ? "" : `<span class="cnt">${p.items.length} ${p.items.length === 1 ? "Aufgabe" : "Aufgaben"} ›</span>`}</button>
          <button class="btn ghost sm" data-edphase="${esc(p.id)}">Abschnitt bearbeiten</button></div>
        ${open ? `<ul class="edlist" data-list="phase:${esc(p.id)}">${rows}</ul>${add}` : ""}
      </section>`;
    }).join("");
    const always = m.plan.always[key].map(a => `<li data-id="${esc(a.id)}"><span class="grip" data-grip="1" aria-hidden="true" title="Ziehen zum Sortieren">⋮⋮</span><button class="edtxt${a.important ? " imp" : ""}" data-edalways="${esc(a.id)}">${esc(a.t)}</button><span class="badge">${a.kind === "rhythm" ? `alle ${a.every} Min.` : KIND_LABEL[a.kind]}</span></li>`).join("");
    return `<div class="edtop"><h2>Aufgaben-Plan</h2><div class="seg" role="group" aria-label="Schicht">${seg}</div>
        <button class="btn" data-edshifttimes="1">Schichtzeiten: ${shiftTimes}</button></div>
      <div class="edgrid">
        <div class="edcol">${phases || '<p class="empty">Noch keine Abschnitte.</p>'}<button class="btn addphase" data-ednewphase="1">+ Abschnitt</button></div>
        <section class="card edalways"><div class="chead"><h2>Immer im Blick · ${SHIFT_META[key].short}</h2></div><ul class="edlist" data-list="always">${always}</ul><button class="addrow" data-ednewalways="1">+ Daueraufgabe</button></section>
      </div>${state.edPop ? renderEdPop(m) : ""}`;
  }
  // Uhrzeit als Textfeld (HH:MM, auch „730“ oder „7.30“) – type="time" zeigt je nach Systemsprache AM/PM.
  const timeIn = (id, v, label) => `<input class="in tin" id="${id}" value="${v}" inputmode="numeric" maxlength="5" placeholder="HH:MM" autocomplete="off" aria-label="${label}">`;
  function renderEdPop(m) {
    const pop = state.edPop, key = state.edShift, del = state.edConfirmDel;
    const frame = (title, body, canDel, delText) => `<div class="overlay inmain" role="dialog" aria-modal="true" aria-labelledby="ep-title"><form class="dialog edpop" id="edpop">
      <h2 id="ep-title">${title}</h2>${body}<p class="perr" id="ep-err" role="alert"></p>
      <div class="row">${canDel ? `<button type="button" class="btn ghost danger left" data-epdel="1">${del ? delText : "Löschen"}</button>` : ""}<button type="button" class="btn ghost" data-epclose="1">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form></div>`;
    const fld = (label, inner) => `<label class="fld"><span>${label}</span>${inner}</label>`;
    if (pop.type === "item") {
      const f = findItem(m, key, pop.id); if (!f) return "";
      const i = f.item, wkT = m.plan[key].phases.find(p => p.id === f.phase.id), weT = m.we.phases[f.phase.id];
      return frame("Aufgabe bearbeiten", `
        ${fld("Aufgabe", `<input class="in" id="ep-t" maxlength="200" value="${esc(i.t)}" required>`)}
        ${fld("Hinweis (optional)", `<input class="in" id="ep-s" maxlength="300" value="${esc(i.s || "")}">`)}
        ${fld("Abschnitt", `<select class="in" id="ep-phase">${m.plan[key].phases.map(p => `<option value="${esc(p.id)}"${p.id === f.phase.id ? " selected" : ""}>${esc(p.from)} ${esc(p.title)}</option>`).join("")}</select>`)}
        <div class="checks"><label><input type="checkbox" id="ep-imp" ${i.important ? "checked" : ""}> Wichtig (rot)</label><label><input type="checkbox" id="ep-opt" ${i.optional ? "checked" : ""}> Darf entfallen</label></div>
        <fieldset class="remfs"><legend>Erinnerung als Popup</legend>
          <label><input type="checkbox" id="ep-rem" ${i.remind ? "checked" : ""}> Erinnern</label>
          <label>Mo–Fr um ${timeIn("ep-remwk", i.remind || wkT.from, "Erinnerung Mo–Fr")}</label>
          <label>Sa+So um ${timeIn("ep-remwe", m.we.remind[i.id] || weT.from, "Erinnerung Sa+So")}</label>
          <div class="remwhen" role="radiogroup" aria-label="Wann erinnern">
            <label><input type="radio" name="ep-remwhen" id="ep-remopen" ${i.remindAlways ? "" : "checked"}> nur wenn noch offen</label>
            <label><input type="radio" name="ep-remwhen" id="ep-remalways" ${i.remindAlways ? "checked" : ""}> immer – auch wenn schon erledigt (zur Sicherheit)</label></div></fieldset>`, true, "Wirklich löschen?");
    }
    if (pop.type === "phase") {
      const p = pop.id ? findPhase(m, key, pop.id) : null;
      const s = m.plan[key], last = s.phases.length ? Math.max(...s.phases.map(x => toMin(x.to))) : toMin(s.start);
      const lastWe = s.phases.length ? Math.max(...s.phases.map(x => toMin(m.we.phases[x.id].to))) : toMin(m.we[key].start);
      const d = p ? { title: p.title, hint: p.hint, wk: p, we: m.we.phases[p.id] } : { title: "", hint: "", wk: { from: fmtMin(Math.min(last, 1409)), to: fmtMin(Math.min(last + 30, 1439)) }, we: { from: fmtMin(Math.min(lastWe, 1409)), to: fmtMin(Math.min(lastWe + 30, 1439)) } };
      const n = p ? p.items.length : 0;
      return frame(p ? "Abschnitt bearbeiten" : "Neuer Abschnitt", `
        ${fld("Name", `<input class="in" id="ep-t" maxlength="60" value="${esc(d.title)}" placeholder="z. B. Nachmittag" required>`)}
        ${fld("Hinweis (optional)", `<input class="in" id="ep-s" maxlength="80" value="${esc(d.hint || "")}" placeholder="z. B. direkt bei Schichtbeginn">`)}
        <div class="tgrid"><span></span><b>von</b><b>bis</b>
          <b>Mo–Fr</b>${timeIn("ep-wkf", d.wk.from, "Mo–Fr von")}${timeIn("ep-wkt", d.wk.to, "Mo–Fr bis")}
          <b>Sa + So</b>${timeIn("ep-wef", d.we.from, "Sa+So von")}${timeIn("ep-wet", d.we.to, "Sa+So bis")}</div>`, !!p, n ? `Mit ${n} ${n === 1 ? "Aufgabe" : "Aufgaben"} löschen?` : "Wirklich löschen?");
    }
    if (pop.type === "shift") {
      const s = m.plan[key], we = m.we[key];
      return frame(`Schichtzeiten · ${SHIFT_META[key].label}`, `<div class="tgrid"><span></span><b>Beginn</b><b>Ende</b>
          <b>Mo–Fr</b>${timeIn("ep-wkf", s.start, "Mo–Fr Beginn")}${timeIn("ep-wkt", s.end, "Mo–Fr Ende")}
          <b>Sa + So</b>${timeIn("ep-wef", we.start, "Sa+So Beginn")}${timeIn("ep-wet", we.end, "Sa+So Ende")}</div>
        <p class="hint">Abschnitte außerhalb dieser Zeiten verlängern die Schicht automatisch.</p>`, false);
    }
    if (pop.type === "always") {
      const a = pop.id ? m.plan.always[key].find(x => x.id === pop.id) : null;
      const kind = a ? a.kind : "confirm";
      return frame(a ? "Daueraufgabe bearbeiten" : "Neue Daueraufgabe", `
        ${fld("Aufgabe", `<input class="in" id="ep-t" maxlength="200" value="${esc(a ? a.t : "")}" required>`)}
        ${fld("Hinweis (optional)", `<input class="in" id="ep-s" maxlength="200" value="${esc(a ? a.s || "" : "")}">`)}
        ${fld("Art", `<select class="in" id="ep-kind"><option value="confirm"${kind === "confirm" ? " selected" : ""}>Pflicht – einmal pro Schicht bestätigen</option><option value="rhythm"${kind === "rhythm" ? " selected" : ""}>Regelmäßig – mit Zähler</option><option value="hint"${kind === "hint" ? " selected" : ""}>Nur Hinweis</option></select>`)}
        <div id="ep-everyf"${kind === "rhythm" ? "" : " hidden"}>${fld("Alle … Minuten", `<input class="in" type="number" id="ep-every" min="5" max="480" step="5" value="${a && a.every ? a.every : 60}">`)}</div>
        <div class="checks"><label><input type="checkbox" id="ep-imp" ${a && a.important ? "checked" : ""}> Wichtig (rot)</label></div>`, !!a, "Wirklich löschen?");
    }
    return "";
  }
  function closeEdPop() { state.edPop = null; state.edConfirmDel = false; render(); }
  // Fenster „Speichern“: Felder lesen, prüfen, übernehmen.
  function submitEdPop() {
    const pop = state.edPop; if (!pop) return;
    const key = state.edShift, v = (id) => { const el = $(id); return el ? el.value : ""; }, c = (id) => { const el = $(id); return !!(el && el.checked); };
    const tv = (id) => normTime(v(id)) || "";
    const err = (msg) => { const e = $("ep-err"); if (e) e.textContent = msg; };
    const range = (a, b) => TIME_RE.test(a) && TIME_RE.test(b) && toMin(b) > toMin(a);
    const t = v("ep-t").replace(/\s+/g, " ").trim();
    let ok = true;
    if (pop.type === "item") {
      if (!t) return err("Bitte einen Text eingeben.");
      const rem = c("ep-rem"), rwk = tv("ep-remwk"), rwe = tv("ep-remwe");
      if (rem && (!TIME_RE.test(rwk) || !TIME_RE.test(rwe))) return err("Bitte beide Erinnerungszeiten angeben.");
      ok = editMaster(m => {
        const f = findItem(m, key, pop.id); if (!f) return false;
        const i = f.item;
        i.t = t; i.s = v("ep-s").trim(); i.important = c("ep-imp"); i.optional = c("ep-opt");
        if (rem) { i.remind = rwk; m.we.remind[i.id] = rwe; if (c("ep-remalways")) i.remindAlways = true; else delete i.remindAlways; }
        else { delete i.remind; delete i.remindAlways; delete m.we.remind[i.id]; }
        const target = findPhase(m, key, v("ep-phase"));
        if (target && target !== f.phase) { f.phase.items.splice(f.idx, 1); target.items.push(i); }
      });
    } else if (pop.type === "phase") {
      if (!t) return err("Bitte einen Namen eingeben.");
      const wk = { from: tv("ep-wkf"), to: tv("ep-wkt") }, we = { from: tv("ep-wef"), to: tv("ep-wet") };
      if (!range(wk.from, wk.to) || !range(we.from, we.to)) return err("Bitte Uhrzeiten als HH:MM eingeben – „bis“ muss nach „von“ liegen.");
      ok = editMaster(m => {
        let p = pop.id ? findPhase(m, key, pop.id) : null;
        if (!p) { p = { id: newId("p"), items: [] }; m.plan[key].phases.push(p); state.edOpen.add(p.id); }
        Object.assign(p, { title: t, hint: v("ep-s").trim(), from: wk.from, to: wk.to });
        m.we.phases[p.id] = we;
      });
    } else if (pop.type === "shift") {
      const wk = { from: tv("ep-wkf"), to: tv("ep-wkt") }, we = { from: tv("ep-wef"), to: tv("ep-wet") };
      if (!range(wk.from, wk.to) || !range(we.from, we.to)) return err("Bitte Uhrzeiten als HH:MM eingeben – das Ende muss nach dem Beginn liegen.");
      ok = editMaster(m => { m.plan[key].start = wk.from; m.plan[key].end = wk.to; m.we[key].start = we.from; m.we[key].end = we.to; });
    } else if (pop.type === "always") {
      if (!t) return err("Bitte einen Text eingeben.");
      const kind = v("ep-kind"), every = Math.min(480, Math.max(5, parseInt(v("ep-every"), 10) || 60));
      ok = editMaster(m => {
        const list = m.plan.always[key];
        let a = pop.id ? list.find(x => x.id === pop.id) : null;
        if (!a) { a = { id: newId("a") }; list.push(a); }
        Object.assign(a, { t, s: v("ep-s").trim(), kind, every: kind === "rhythm" ? every : 0, important: c("ep-imp") });
      });
    }
    if (ok) closeEdPop();
  }
  function deleteEdPop() {
    const pop = state.edPop, key = state.edShift;
    if (!pop || !pop.id) return;
    if (!state.edConfirmDel) { state.edConfirmDel = true; render(); return; }
    const ok = editMaster(m => {
      if (pop.type === "item") { const f = findItem(m, key, pop.id); if (!f) return false; f.phase.items.splice(f.idx, 1); delete m.we.remind[pop.id]; }
      else if (pop.type === "phase") { m.plan[key].phases = m.plan[key].phases.filter(p => p.id !== pop.id); delete m.we.phases[pop.id]; }
      else if (pop.type === "always") m.plan.always[key] = m.plan.always[key].filter(a => a.id !== pop.id);
      else return false;
    });
    if (ok) closeEdPop();
  }
  // Neue Aufgabe aus der Eingabezeile: gilt sofort an jedem Tag; die Zeile bleibt für die nächste offen.
  function addTask(pid, raw) {
    const t = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 200), key = state.edShift;
    if (!t) return;
    const id = newId(SHIFT_META[key].prefix);
    if (editMaster(m => { const p = findPhase(m, key, pid); if (!p) return false; p.items.push({ id, t, s: "", important: false, optional: false }); })) {
      state.edNew = id; render();
      const inp = $("ed-new"); if (inp) inp.focus();
    }
  }
  // Sortieren per Ziehen am Griff ⋮⋮ (Maus und Touch); gespeichert wird die neue Reihenfolge beim Loslassen.
  function startSort(e, grip) {
    const li = grip.closest("li"), ul = li && li.parentElement;
    if (!ul || !ul.dataset.list) return;
    e.preventDefault();
    drag = { kind: "sort" };
    li.classList.add("dragging");
    // Auf Dokument-Ebene lauschen: Das Verschieben der Zeile im DOM beendet einen Pointer-Capture am Griff.
    const doc = grip.ownerDocument || document;
    const move = (ev) => {
      const sibs = [...ul.children].filter(x => x !== li);
      const after = sibs.find(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      if (after) { if (li.nextElementSibling !== after) ul.insertBefore(li, after); } else if (ul.lastElementChild !== li) ul.appendChild(li);
    };
    const up = () => {
      doc.removeEventListener("pointermove", move); doc.removeEventListener("pointerup", up); doc.removeEventListener("pointercancel", up);
      drag = null; li.classList.remove("dragging");
      const ids = [...ul.children].map(x => x.dataset.id), list = ul.dataset.list, key = state.edShift;
      editMaster(m => {
        const arr = list === "always" ? m.plan.always[key] : (findPhase(m, key, list.slice(6)) || {}).items;
        if (!arr) return false;
        const byId = new Map(arr.map(x => [x.id, x]));
        const next = ids.map(id => byId.get(id)).filter(Boolean);
        if (next.length !== arr.length || next.every((x, i) => x === arr[i])) return false;
        arr.splice(0, arr.length, ...next);
      });
      render();
    };
    doc.addEventListener("pointermove", move); doc.addEventListener("pointerup", up); doc.addEventListener("pointercancel", up);
  }

  // ---------- Erinnerungs-Popups (Aufgaben mit Uhrzeit) ----------
  // Fällig: heutige Aufgabe der laufenden Schicht mit Erinnerungszeit, nicht weggedrückt – und noch offen,
  // außer die Aufgabe soll „zur Sicherheit“ immer erinnern (remindAlways), dann auch, wenn sie schon erledigt ist.
  function taskRemTarget() {
    const today = isoDate(new Date());
    if (state.date !== today || !currentPerson()) return null;
    const plan = P(), now = nowMin(), key = activeShift(plan, now);
    if (!key) return null;
    const snz = LS.get("rz2taskrem", {}), sn = snz && snz.date === today ? snz.until || {} : {};
    for (const p of plan[key].phases) for (const i of p.items) {
      if (i.remind && (i.remindAlways || !state.checks[i.id]) && now >= toMin(i.remind) && !(sn[i.id] > Date.now())) return { id: i.id, key, item: i };
    }
    return null;
  }
  function snoozeTaskRem(id, ms) {
    const today = isoDate(new Date()), s = LS.get("rz2taskrem", {}), until = s && s.date === today ? { ...(s.until || {}) } : {};
    until[id] = Date.now() + ms;
    LS.set("rz2taskrem", { date: today, until });
  }

  // ---------- Rendering ----------
  function renderHeader() {
    const d = parseIso(state.date), plan = P(), ctx = timeCtx();
    const { source } = resolvePlan(state.date, state.dayPlan, false, state.daySnap);
    $("weekday").textContent = WD[d.getDay()] + (state.date === isoDate(new Date()) ? " · heute" : "");
    $("datelabel").textContent = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    $("datesrc").textContent = source === "day" ? "angepasst" : source === "snap" ? "Stand vom Tag" : source === "weekday" && !state.cfg.master ? WD[d.getDay()].slice(0, 2) + "-Plan" : "";
    $("datepick").value = state.date;
    const act = activeShift(plan, ctx);
    $("clock").innerHTML = `${fmtMin(nowMin())}${act ? `<small>${SHIFT_META[act].label} bis ${plan[act].end}</small>` : ""}`;
    { const k = lockedShift() || state.shiftSel || focusShift(plan, ctx), pr = progress(plan, k, state.checks); $("meta-shift").textContent = `${SHIFT_META[k].short} ${pr.done}/${pr.total}`; }
    root.querySelector('[data-view="erstattung"]').hidden = !checkinsOn();
    const tabView = ["plan", "pin", "monat"].includes(state.view) ? "admin" : state.view;
    root.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.view === tabView)));
    const p = currentPerson(), pres = presentPeople(), bar = $("presence");
    bar.hidden = !state.cfg.people.length;
    bar.innerHTML = pres.map(({ person, entry }) => {
      const on = p && p.id === person.id;
      return `<button class="pchip${on ? " on" : ""}" data-pres="${esc(person.id)}" aria-pressed="${!!on}" title="${on ? "Gerade aktiv – Haken laufen auf diesen Namen" : "Antippen: " + esc(person.name) + " wird aktiv"}"><span class="av">${esc(initials(person.name))}</span><span>${esc(person.name)}<small>${ROLE_LABEL[entry.role] || ""} · ${entry.in}</small></span></button>`;
    }).join("") + `<button class="pchip add" data-pres-add="1" title="Weitere Person einchecken">${pres.length ? "+" : "+ Einchecken"}</button>`;
    $("outBtn").hidden = !p;
    $("outBtn").textContent = p && pres.length > 1 ? `${p.name.split(" ")[0]} auschecken` : "Auschecken";
    const vo = state.viewOnly && !p && !!state.cfg.people.length;
    $("vobar").hidden = !vo;
    container.classList.toggle("viewonly", vo);
    const mc = $("mk-clock");
    if (mc) mc.textContent = fmtMin(nowMin());
  }

  function render() {
    const active = root.activeElement;
    const typing = active && $("main").contains(active) && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && !["checkbox", "radio", "file", "button", "submit"].includes(active.type)));
    if (typing || drag) { renderPending = true; renderHeader(); return; }
    renderPending = false;
    if (state.view === "erstattung" && !checkinsOn()) state.view = "schicht";
    renderHeader();
    const v = state.view, main = $("main");
    main.hidden = v === "erstattung"; $("ciwrap").hidden = v !== "erstattung";
    if (v === "erstattung") return showCheckinTool();
    if ((v === "plan" || v === "admin" || v === "monat") && !isUnlocked()) { state.pinStage = { mode: state.cfg.adminPin ? "unlock" : "set", next: v }; state.view = "pin"; return render(); }
    main.className = ["plan", "monat", "dienst", "admin", "pin", "zeiten"].includes(v) ? "scroll" : "";
    main.innerHTML = v === "monat" ? renderMonth() : v === "plan" ? renderEditor()
      : v === "dienst" ? renderRoster() : v === "admin" ? renderAdmin() : v === "pin" ? renderPin() : v === "zeiten" ? renderTimes() : renderSchicht();
    maybeAskPerson();
    // Offene Anmeldemaske mit frischen Daten neu zeichnen (z. B. wer inzwischen eingecheckt ist), außer beim Eintippen.
    if (state.pickerOpen && !state.checkin && !state.pickAdd) {
      // Maske ging vor dem Laden auf, inzwischen ist jemand eingecheckt → diese Person übernimmt, Maske zu.
      if (state.pickerMode === "login" && presentPeople().length) { ensureActive(); closePicker(); renderHeader(); }
      else renderPicker();
    }
    maybeRemind();
    if (v === "schicht") scrollToNow();
    if (v === "dienst") applyRosterHi();
  }
  // ---------- Erstattung (Check-in-Erstattung) ----------
  // Eigene Seite im iframe, einmal geladen und danach nur ein-/ausgeblendet: Prüfergebnisse liegen nur im Speicher der Seite.
  let ciFrame = null;
  function showCheckinTool() {
    const locked = state.viewOnly && !currentPerson();
    let lock = $("ciwrap").querySelector(".cilock");
    if (locked && !lock) {
      lock = document.createElement("div"); lock.className = "cilock";
      lock.innerHTML = `<div><b>Nur ansehen</b><p>Für die Check-ins bitte einchecken.</p><button class="btn primary" data-pres-add="1">Einchecken</button></div>`;
      $("ciwrap").appendChild(lock);
    } else if (!locked && lock) lock.remove();
    if (!ciFrame) {
      ciFrame = document.createElement("iframe");
      ciFrame.src = opts.checkinUrl;
      ciFrame.title = "Check-ins";
      ciFrame.setAttribute("allow", "clipboard-write");
      ciFrame.addEventListener("load", postCheckinUser);
      $("ciwrap").appendChild(ciFrame);
    } else postCheckinUser();
  }
  // Eingecheckte Person („Bearbeitet von“) und Farbschema an die Seite melden.
  function postCheckinUser() {
    if (!ciFrame || !ciFrame.contentWindow) return;
    const p = currentPerson();
    ciFrame.contentWindow.postMessage({ type: "rz-theme", theme: host.getAttribute("data-theme") }, "*");
    ciFrame.contentWindow.postMessage({ type: "rz-user", name: p ? p.name : "" }, "*");
  }
  const onCheckinMessage = async (ev) => {
    if (!ciFrame || ev.source !== ciFrame.contentWindow || !ev.data) return;
    if (ev.data.type === "rz-status") {
      const open = Number(ev.data.open) || 0;
      $("meta-ci").textContent = Number(ev.data.total) ? (open ? `${open} offen` : "alles gebucht") : "";
      return;
    }
    if (ev.data.type !== "rz-download") return;
    const { name, data, mime } = ev.data;
    if (typeof name !== "string" || !/^[\w.\-ÄÖÜäöüß ]{1,120}\.(xlsx|csv|json)$/.test(name) || data == null) return;
    try { if (await offerFile(name, data, typeof mime === "string" ? mime : "application/octet-stream")) setStatus("Gespeichert: " + name); }
    catch (e) { setStatus("Download fehlgeschlagen: " + ((e && e.message) || "Fehler"), true); }
  };
  window.addEventListener("message", onCheckinMessage);
  cleanups.push(() => window.removeEventListener("message", onCheckinMessage));

  // Querformat: aktuelle Spalte ins Bild holen.
  function scrollToNow() {
    // Erster offener Abschnitt (überfällig oder aktuell) in Zeitreihenfolge.
    const el = root.querySelector(".stop.is-late, .stop.is-now");
    if (!el) return;
    const board = root.querySelector(".board");
    if (board && board.scrollHeight > board.clientHeight) board.scrollTop = Math.max(0, el.offsetTop - board.offsetTop - 8);
    else if (!scrolledOnce) {
      const head = root.querySelector("header.top");
      if (head) host.style.setProperty("--rz-head", head.offsetHeight + 8 + "px");
      el.scrollIntoView({ block: "start" });
      scrolledOnce = true;
    }
  }



  // ---------- Interaktion ----------
  function goDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    state.date = date;
    state.expanded.clear();
    state.confirm = null;
    subscribeMonth();
    subscribeDay();
  }
  function setView(v) {
    if (v !== "plan") { state.edPop = null; state.edAdd = null; state.edNew = null; }
    if (v !== "admin") state.adminPop = null;
    else if (state.view !== "plan") openFirstPhase();
    if (v === "admin" || v === "plan" || v === "monat") { if (!requireAdmin(v)) return; }
    if (v === "schicht") state.shiftSel = null; // Tab „Schicht“ zeigt immer die laufende Schicht
    if (v !== "dienst") state.rosterEdit = false;
    if (v === "dienst") { state.rosterMonth = state.date.slice(0, 7); state.rosterDay = null; }
    if (v === "zeiten") { state.timesMonth = state.date.slice(0, 7); state.timesPerson = null; state.timesAll = false; state.timesEdit = null; state.timesData = null; }
    state.view = v; state.confirm = null; scrolledOnce = false;
    if (opts.standalone) window.scrollTo(0, 0);
    render();
  }
  function shiftMonths(n) { const d = parseIso(state.date); d.setDate(1); d.setMonth(d.getMonth() + n); goDate(isoDate(d)); }

  $("prev").addEventListener("click", () => goDate(addDays(state.date, -1)));
  $("next").addEventListener("click", () => goDate(addDays(state.date, 1)));
  $("today").addEventListener("click", () => goDate(isoDate(new Date())));
  $("datepick").addEventListener("change", (e) => goDate(e.target.value));
  root.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));

  const main = $("main");
  main.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.adminpop) { blurActive(); state.adminPop = t.dataset.adminpop; state.confirm = null; render(); return; }
    if (t.dataset.encDone) { blurActive(); state.encCode = null; state.adminPop = "backup"; render(); return; }
    if (t.dataset.decCancel) { blurActive(); state.pendingImport = null; state.adminPop = null; render(); return; }
    if (t.dataset.adminpopClose) { blurActive(); state.adminPop = null; state.confirm = null; render(); return; }
    // Aufgaben-Plan
    if (t.dataset.edshift) { state.edShift = t.dataset.edshift; state.edAdd = null; state.edNew = null; openFirstPhase(); render(); return; }
    if (t.dataset.edopen) { const id = t.dataset.edopen; state.edOpen.has(id) ? state.edOpen.delete(id) : state.edOpen.add(id); if (state.edAdd === id) state.edAdd = null; render(); return; }
    if (t.dataset.edadd) { state.edAdd = t.dataset.edadd; state.edOpen.add(t.dataset.edadd); state.edNew = null; render(); const i = $("ed-new"); if (i) i.focus(); return; }
    if (t.dataset.edaddclose) { state.edAdd = null; state.edNew = null; render(); return; }
    if (t.dataset.editem) { state.edPop = { type: "item", id: t.dataset.editem }; state.edConfirmDel = false; render(); return; }
    if (t.dataset.edphase) { state.edPop = { type: "phase", id: t.dataset.edphase }; state.edConfirmDel = false; render(); return; }
    if (t.dataset.ednewphase) { state.edPop = { type: "phase", id: null }; state.edConfirmDel = false; render(); return; }
    if (t.dataset.edshifttimes) { state.edPop = { type: "shift", id: null }; render(); return; }
    if (t.dataset.edalways) { state.edPop = { type: "always", id: t.dataset.edalways }; state.edConfirmDel = false; render(); return; }
    if (t.dataset.ednewalways) { state.edPop = { type: "always", id: null }; state.edConfirmDel = false; render(); return; }
    if (t.dataset.epclose) { closeEdPop(); return; }
    if (t.dataset.epdel) { deleteEdPop(); return; }
    if (t.dataset.act2) {
      const a = t.dataset.act2;
      if (a === "roster-edit") { if (requireAdmin("dienst-edit")) { state.rosterEdit = true; render(); } return; }
      if (a === "roster-done") { state.rosterEdit = false; render(); return; }
      if (a === "rday-close") { state.rosterDay = null; render(); return; }
      if (a === "rhi-clear") { state.rosterHi = ""; render(); return; }
      if (a === "t-all") { if (requireAdmin("zeiten-all")) { state.timesAll = true; state.timesPerson = ""; render(); } return; }
      if (a === "t-back") { if (!timesOwnOnly()) state.timesPerson = null; render(); return; }
      if (a === "t-add") { if (isUnlocked()) { state.timesEdit = { id: null, date: state.date, e: { pid: (state.cfg.people[0] || {}).id, role: "frueh", in: "08:30", out: null, pause: 0 } }; render(); } return; }
      if (a === "te-cancel") { state.timesEdit = null; state.confirm = null; render(); return; }
      if (a === "te-save") { if (isUnlocked()) saveTimeEdit(); return; }
      if (a === "te-del") {
        if (!isUnlocked() || !state.timesEdit || !state.timesEdit.id) return;
        if (state.confirm !== "te-del") { state.confirm = "te-del"; render(); return; }
        persistTime(state.timesEdit.date, state.timesEdit.id, null); state.timesEdit = null; state.confirm = null; render(); setStatus("Eintrag gelöscht"); return;
      }
      if (a === "t-xlsx") { if (isUnlocked()) saveExport(buildXlsx()); return; }
      if (a === "t-pdf") { if (isUnlocked()) saveExport(buildPdf()); return; }
      if (a === "pin-cancel") { state.pinStage = null; state.view = "schicht"; render(); return; }
      if (a === "open-plan") return setView("plan");
      if (a === "cleanup-ask") { state.confirm = "cleanup"; render(); return; }
      if (a === "cleanup-run") { if (isUnlocked()) runCleanup(); return; }
      if (a === "enc-off-ask") { state.confirm = "enc-off"; render(); return; }
      if (a === "enc-off") { if (!isUnlocked()) return; state.confirm = null; state.cfg = { ...state.cfg, backupKey: null }; persistCfg({ backupKey: null }); setStatus("Verschlüsselung der Sicherungen ausgeschaltet"); render(); return; }
      if (a === "feat-checkins") {
        if (!isUnlocked()) return;
        const features = { ...(state.cfg.features || {}), checkins: !checkinsOn() };
        state.cfg = { ...state.cfg, features };
        persistCfg({ features });
        render(); return;
      }
      if (["open-plan", "open-roster", "open-month", "open-times", "pin-change", "lock"].includes(a)) state.adminPop = null;
      if (a === "open-month") return setView("monat");
      if (a === "open-times") { setView("zeiten"); if (isUnlocked()) { state.timesAll = true; state.timesPerson = ""; render(); } return; }
      if (a === "open-roster") { state.view = "dienst"; state.rosterMonth = state.date.slice(0, 7); state.rosterEdit = true; render(); return; }
      if (a === "export") return downloadBackup();
      if (a === "import-cancel") { state.importPreview = null; render(); return; }
      if (a === "import-apply") { if (isUnlocked()) applyImport(); return; }
      if (a === "backup-dir") return chooseBackupDir();
      if (a === "backup-now") return writeBackup("manual");
      if (a === "backup-open") { if (NATIVE) NATIVE.openBackupDir(); return; }
      if (a === "backup-forget") return forgetBackupDir();
      if (a === "person-del") return deletePerson(t.dataset.pid);
      if (a === "pin-off-ask") { state.confirm = "pin-off"; render(); return; }
      if (a === "pin-off") {
        // Vom PIN-Festlegen-Bildschirm (noch keine PIN) oder aus der Verwaltung (entsperrt).
        if (state.cfg.adminPin && !isUnlocked()) return;
        state.confirm = null;
        state.cfg = { ...state.cfg, adminPin: PIN_OFF };
        persistCfg({ adminPin: PIN_OFF });
        const next = (state.pinStage && state.pinStage.next) || "admin";
        state.pinStage = null;
        if (next === "dienst-edit") { state.view = "dienst"; state.rosterEdit = true; }
        else if (next === "zeiten-all") { state.view = "zeiten"; state.timesAll = true; state.timesPerson = ""; }
        else state.view = state.view === "pin" ? next : state.view;
        setStatus("Leitungs-PIN deaktiviert");
        render(); return;
      }
      if (a === "pin-change") { state.pinStage = { mode: "set", next: "admin" }; state.view = "pin"; render(); setTimeout(() => { const el = $("pin-in"); if (el) el.focus(); }, 0); return; }
      if (a === "lock") { state.unlockedUntil = 0; state.view = "schicht"; render(); return; }
      return;
    }
    if (t.dataset.roster) { if (isUnlocked()) { state.unlockedUntil = Date.now() + 10 * 60000; toggleRoster(t.dataset.roster, t.dataset.shift, t.dataset.pid); } else { state.rosterEdit = false; render(); } return; }
    if (t.id === "mrprev" || t.id === "mrnext") {
      const [yy, mm] = (state.rosterMonth || state.date.slice(0, 7)).split("-").map(Number);
      const nd = new Date(yy, mm - 1 + (t.id === "mrprev" ? -1 : 1), 1);
      state.rosterMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; state.rosterDay = null; render(); return;
    }
    if (t.dataset.tperson) { if (!timesOwnOnly()) state.timesPerson = t.dataset.tperson; render(); return; }
    if (t.dataset.tedit) {
      if (!isUnlocked()) return;
      state.unlockedUntil = Date.now() + 10 * 60000;
      const [date, id] = t.dataset.tedit.split("|"); const e = ((state.timesData.days || {})[date] || {})[id];
      if (e) { state.timesEdit = { id, date, e }; render(); }
      return;
    }
    if (t.dataset.tstep) { const sel = $(t.dataset.tstep); if (sel) { sel.selectedIndex = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + Number(t.dataset.dir))); } return; }
    if (t.id === "tprev" || t.id === "tnext") {
      const [yy, mm] = (state.timesMonth || state.date.slice(0, 7)).split("-").map(Number);
      const nd = new Date(yy, mm - 1 + (t.id === "tprev" ? -1 : 1), 1);
      state.timesMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; state.timesData = null; render(); return;
    }
    if (t.dataset.rday) { if (isUnlocked()) { state.unlockedUntil = Date.now() + 10 * 60000; state.rosterDay = t.dataset.rday; render(); } return; }
    if (t.dataset.shiftsel) { if (lockedShift()) return; const k = t.dataset.shiftsel; const plan = P(); state.shiftSel = k === focusShift(plan, timeCtx()) ? null : k; state.expanded.clear(); scrolledOnce = false; render(); return; }
    if (t.dataset.goview) return setView(t.dataset.goview);
    if (t.dataset.hread) { markHandRead(t.dataset.hread); render(); return; }
    if (t.dataset.hopen) { state.handPop = t.dataset.hopen; renderRemind(); return; }
    if (t.dataset.noteedit) { if (needPerson()) return; state.notePop = t.dataset.noteedit; renderRemind(); return; }
    if (t.dataset.log) return logAlways(t.dataset.shift, t.dataset.log);
    if (t.dataset.unlog) return unlogAlways(t.dataset.shift, t.dataset.unlog);
    if (t.dataset.sideopen) { const k = t.dataset.sideopen; state.sideOpen.has(k) ? state.sideOpen.delete(k) : state.sideOpen.add(k); render(); return; }
    if (t.dataset.toggle) { const id = t.dataset.toggle; state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id); render(); return; }
    if (t.id === "mprev") return shiftMonths(-1);
    if (t.id === "mnext") return shiftMonths(1);
    if (t.dataset.date) { const sh = t.dataset.shift; goDate(t.dataset.date); state.view = "schicht"; state.shiftSel = sh; render(); return; }
    const stamp = (s) => ({ s, by: actorId(), at: new Date().toISOString() });
    if (t.dataset.id) { const c = state.checks[t.dataset.id]; if (c && c.s === "na") return; setCheck(t.dataset.id, c && c.s === "done" ? null : stamp("done")); }
    else if (t.dataset.skip) { const c = state.checks[t.dataset.skip]; setCheck(t.dataset.skip, c && c.s === "na" ? null : stamp("na")); }
  });
  main.addEventListener("pointerdown", (e) => {
    const sp = e.target.closest && e.target.closest("[data-split]"); if (sp && e.button === 0) return startDrag(e, sp);
    const gr = e.target.closest && e.target.closest("[data-grip]"); if (gr && e.button === 0 && isUnlocked()) startSort(e, gr);
  });
  main.addEventListener("dblclick", (e) => {
    const sp = e.target.closest && e.target.closest("[data-split]"); if (!sp) return;
    saveLayout({ [sp.dataset.split]: LAYOUT_DEFAULT[sp.dataset.split] }); render();
  });
  main.addEventListener("keydown", (e) => {
    const kind = e.target.dataset && e.target.dataset.split; if (!kind) return;
    const step = kind === "side" ? { ArrowLeft: 20, ArrowRight: -20 }[e.key] : { ArrowUp: 20, ArrowDown: -20 }[e.key];
    if (!step) return;
    e.preventDefault();
    if (kind === "side") saveLayout({ side: clampSide(getLayout().side + step) });
    else {
      const card = root.querySelector(".side > .card.hand");
      saveLayout({ hand: clampHand((getLayout().hand || (card ? card.getBoundingClientRect().height : 240)) + step) });
    }
    render(); const sp = root.querySelector(`[data-split="${kind}"]`); if (sp) sp.focus();
  });
  main.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "rhi") { state.rosterHi = el.value.slice(0, 40); return applyRosterHi(); }
  });
  main.addEventListener("change", (e) => {
    if (e.target.dataset && e.target.dataset.rnote) return setRosterNote(e.target.dataset.rnote, e.target.dataset.shift, e.target.value);
    if (e.target.id === "enc-noted") { const b = $("enc-done"); if (b) b.disabled = !e.target.checked; }
    if (e.target.id === "ep-kind") { const f = $("ep-everyf"); if (f) f.hidden = e.target.value !== "rhythm"; }
  });
  main.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "pinform") return submitPin($("pin-in").value);
    if (e.target.id === "addperson") return addPerson($("newperson").value);
    if (e.target.id === "edpop") return submitEdPop();
    if (e.target.id === "decform") { const i = $("dec-secret"); decryptPendingImport(i ? i.value : ""); return; }
    if (e.target.id === "encform") return setupEncryption();
    if (e.target.dataset && e.target.dataset.addto) { const i = $("ed-new"); addTask(e.target.dataset.addto, i ? i.value : ""); return; }
  });
  main.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.person) return renamePerson(el.dataset.person, el.value);
    if (el.id === "t-person") { state.timesPerson = el.value; render(); return; }
    if (el.id === "autostart" && NATIVE) {
      NATIVE.setAutoStart(el.checked).then((on) => { nativeInfo = { ...(nativeInfo || {}), autoStart: !!on }; setStatus(on ? "Startet künftig beim Anmelden" : "Autostart aus"); }).catch(() => setStatus("Autostart konnte nicht geändert werden", true));
      return;
    }
    if (state.importPreview && !state.importPreview.error) {
      const ip = state.importPreview;
      if (el.id === "imp-month") { ip.month = Number(el.value); render(); return; }
      if (el.id === "imp-year") { const y = parseInt(el.value, 10); if (y >= 2020 && y <= 2100) ip.year = y; render(); return; }
    }
  });
  main.addEventListener("focusout", () => setTimeout(() => { if (renderPending) render(); }, 0));
  // Anwesend-Leiste und „Nur ansehen“-Leiste
  container.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-pres],[data-pres-add]");
    if (!b || !container.contains(b) || b.closest("#picker")) return;
    if (b.dataset.presAdd) { state.viewOnly = false; state.byeSeen = true; openPicker(); return; }
    const id = b.dataset.pres, open = openEntry(isoDate(new Date()), id);
    if (!open || (state.who && state.who.id === id)) return;
    setActive(id, open.entry.role); render();
    toast(`${personName(id)} ist jetzt aktiv`);
  });
  // „Nur ansehen“: in Schicht und Erstattung nur Anzeige-Bedienelemente zulassen.
  const VIEW_OK = "[data-shiftsel],[data-toggle],[data-sideopen],[data-split],[data-view]";
  const blockViewOnly = (e) => {
    if (!state.viewOnly || currentPerson() || !["schicht", "erstattung"].includes(state.view)) return;
    const el = e.target.closest && e.target.closest("button, input, textarea, select, label, a");
    if (!el || el.closest(VIEW_OK)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === "click") pulseViewOnly();
  };
  for (const ev of ["click", "focusin"]) { $("main").addEventListener(ev, blockViewOnly, true); }

  // Uhr, Fälligkeiten und „mitlaufende" Spalten jede Minute aktualisieren (nur Anzeige).
  timers.push(setInterval(() => {
    if (["plan", "monat", "admin", "pin", "dienst", "zeiten"].includes(state.view)) { renderHeader(); maybeAskPerson(); maybeRemind(); }
    else render();
  }, 30000));

  // ---------- Start ----------
  render();
  (async () => {
    const api = opts.mode === "auto" && window.claude && typeof window.claude.use === "function" ? window.claude : null;
    if (opts.mode === "sharepoint") {
      db = createSpDb(opts);
      try { await db.ready(); }
      catch (e) { setStatus("SharePoint-Speicher nicht erreichbar: " + ((e && e.message) || "Fehler"), true); state.readOnly = true; }
    } else if (api) {
      try { db = await api.use("db"); } catch { db = null; }
      try { user = await api.use("user"); } catch { user = null; }
    }
    if (user) { try { myId = await user.id(); } catch { myId = null; } }
    state.mode = db ? "shared" : "local";
    if (user && typeof user.can === "function") {
      try { if ((await user.can("data.write")) === false) state.readOnly = true; } catch { /* unbekannt */ }
    }
    loadWho();
    if (state.mode === "local" && NATIVE) { try { nativeInfo = await NATIVE.info(); } catch { nativeInfo = null; } }
    else if (state.mode === "local") await loadBackupDir();
    setStatus(statusLine(), state.readOnly || !!backupHint());
    if (disposed) return;
    subscribeCfg();
    migrateSnaps();
    subscribeMonth();
    subscribeDay();
  })();

  return () => {
    disposed = true;
    timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    cleanups.forEach((f) => { try { f(); } catch { /* egal */ } });
    try { if (unsubDay) unsubDay(); if (unsubMonth) unsubMonth(); if (unsubCfg) unsubCfg(); } catch { /* egal */ }
    container.innerHTML = "";
  };
}
