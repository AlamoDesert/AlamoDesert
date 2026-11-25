// Rezeption – Mac-App (Electron-Hülle um app/app.js).
// Lädt die App über das eigene Schema rezeption://app/ (feste Herkunft → Daten bleiben dauerhaft im App-Speicher),
// schreibt Sicherungen ohne Rückfrage nach ~/Dokumente/Rezeption Sicherungen und schaltet den Autostart.
"use strict";
const { app, BrowserWindow, ipcMain, protocol, net, shell, Menu, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const upd = require("./update-format.js");

const APP_DIR = path.join(__dirname, "app");
const KEEP_DAILY_BACKUPS = 120;
// Öffentlicher Schlüssel für Update-Dateien (.rzupdate). Der private Schlüssel liegt nur beim Entwickler (nie im Repo).
const UPDATE_PUBKEY = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEApj7kzS8I9J86wvMfwQf6IARgepB5O/0Xk+nPKdKC8y4=\n-----END PUBLIC KEY-----\n";
const updateFile = () => path.join(app.getPath("userData"), "update", "aktuell.rzupdate");
// Eingespieltes Update im Speicher: { version, created, files: { name: Buffer } } – nur wenn neuer als die installierte App.
let active = null;
function loadUpdate() {
  active = null;
  try {
    const f = updateFile();
    if (!fs.existsSync(f)) return;
    const r = upd.verify(fs.readFileSync(f, "utf8"), UPDATE_PUBKEY);
    if (r.ok && upd.cmpVersion(r.version, app.getVersion()) > 0) active = r;
    // Ungültig oder durch eine neuere Installation überholt: Datei entfernen, die installierte App gilt.
    else fs.rmSync(f, { force: true });
  } catch { active = null; }
}
const appVersion = () => (active ? active.version : app.getVersion());

protocol.registerSchemesAsPrivileged([
  { scheme: "rezeption", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
const backupDir = () => path.join(app.getPath("documents"), "Rezeption Sicherungen");

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    title: "Rezeption", backgroundColor: "#eef2f6", show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, autoplayPolicy: "no-user-gesture-required", backgroundThrottling: false },
  });
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  win.loadURL("rezeption://app/index.html");
  // Externe Links im Standardbrowser öffnen, sonst nirgendwohin navigieren.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("rezeption://app/")) e.preventDefault(); });
  win.on("closed", () => { win = null; });
}

function buildMenu() {
  const template = [
    { label: "Rezeption", submenu: [
      { role: "about", label: "Über Rezeption" }, { type: "separator" },
      { role: "hide", label: "Rezeption ausblenden" }, { role: "hideOthers", label: "Andere ausblenden" }, { type: "separator" },
      { role: "quit", label: "Rezeption beenden" },
    ] },
    { label: "Bearbeiten", submenu: [
      { role: "undo", label: "Widerrufen" }, { role: "redo", label: "Wiederholen" }, { type: "separator" },
      { role: "cut", label: "Ausschneiden" }, { role: "copy", label: "Kopieren" }, { role: "paste", label: "Einsetzen" }, { role: "selectAll", label: "Alles auswählen" },
    ] },
    { label: "Ansicht", submenu: [
      { role: "reload", label: "Neu laden" },
      // Notausgang, falls ein eingespieltes Update nicht startet.
      { label: "Eingespieltes Update entfernen", click: async () => {
        if (!active) { dialog.showMessageBox(win, { message: "Kein Update eingespielt.", detail: `Es läuft die installierte Version ${app.getVersion()}.` }); return; }
        const r = await dialog.showMessageBox(win, { type: "question", buttons: ["Entfernen", "Abbrechen"], defaultId: 1, message: `Update ${active.version} entfernen?`, detail: `Danach läuft wieder die installierte Version ${app.getVersion()}. Deine Daten bleiben erhalten.` });
        if (r.response !== 0) return;
        try { fs.rmSync(updateFile(), { force: true }); } catch { /* egal */ }
        active = null;
        if (win) win.webContents.reloadIgnoringCache();
      } },
      { type: "separator" },
      { role: "resetZoom", label: "Originalgröße" }, { role: "zoomIn", label: "Vergrößern" }, { role: "zoomOut", label: "Verkleinern" }, { type: "separator" },
      { role: "togglefullscreen", label: "Vollbild" },
    ] },
    { label: "Fenster", submenu: [{ role: "minimize", label: "Im Dock ablegen" }, { role: "zoom", label: "Zoomen" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Atomar schreiben: erst Temp-Datei, dann umbenennen – eine abgebrochene Sicherung hinterlässt keine halbe Datei.
function writeAtomic(file, text) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}

function registerIpc() {
  // Erinnerung: Fenster nach vorn holen (auch aus dem Dock oder hinter anderen Programmen) und vorn halten,
  // bis die App das Fenster beantwortet meldet (rz:attentionEnd). Das Dock-Symbol hüpft zusätzlich, falls macOS das Vordrängeln blockiert.
  ipcMain.handle("rz:attention", () => {
    if (!win) return false;
    if (process.platform === "darwin") app.show();
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.setAlwaysOnTop(true, "floating");
    win.moveTop();
    app.focus({ steal: true });
    win.focus();
    if (process.platform === "darwin" && app.dock && !win.isFocused()) app.dock.bounce("critical");
    return true;
  });
  ipcMain.handle("rz:attentionEnd", () => { if (win) win.setAlwaysOnTop(false); return true; });
  ipcMain.handle("rz:info", () => ({ backupDir: backupDir(), autoStart: app.getLoginItemSettings().openAtLogin, version: appVersion(), baseVersion: app.getVersion(), updateVersion: active ? active.version : null, updateCreated: active ? active.created : null, shell: upd.SHELL }));

  // Update-Datei einspielen: Unterschrift prüfen, nur neuere Versionen, atomar speichern, danach neu laden.
  ipcMain.handle("rz:installUpdate", (_e, text) => {
    const r = upd.verify(text, UPDATE_PUBKEY);
    if (!r.ok) return { ok: false, error: r.error };
    if (upd.cmpVersion(r.version, appVersion()) <= 0) return { ok: false, error: `Version ${r.version} ist nicht neuer als die laufende Version ${appVersion()}.` };
    try {
      fs.mkdirSync(path.dirname(updateFile()), { recursive: true });
      writeAtomic(updateFile(), text);
    } catch (err) { return { ok: false, error: "Speichern fehlgeschlagen: " + String((err && err.message) || err) }; }
    active = r;
    setTimeout(() => { if (win) win.webContents.reloadIgnoringCache(); }, 1200);
    return { ok: true, version: r.version };
  });
  // Eingespieltes Update entfernen → zurück zur installierten Version.
  ipcMain.handle("rz:removeUpdate", () => {
    try { fs.rmSync(updateFile(), { force: true }); } catch { /* egal */ }
    active = null;
    setTimeout(() => { if (win) win.webContents.reloadIgnoringCache(); }, 800);
    return { ok: true, version: app.getVersion() };
  });

  ipcMain.handle("rz:saveBackup", (_e, text, date) => {
    try {
      if (typeof text !== "string" || text.length > 50 * 1024 * 1024) throw new Error("Ungültige Sicherung");
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ungültiges Datum");
      JSON.parse(text); // nur gültiges JSON speichern
      const dir = backupDir();
      fs.mkdirSync(dir, { recursive: true });
      writeAtomic(path.join(dir, `rezeption-sicherung-${date}.json`), text);
      writeAtomic(path.join(dir, "rezeption-sicherung-aktuell.json"), text);
      // Alte Tagesdateien aufräumen, die neuesten KEEP_DAILY_BACKUPS bleiben.
      const daily = fs.readdirSync(dir).filter((n) => /^rezeption-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
      for (const n of daily.slice(0, Math.max(0, daily.length - KEEP_DAILY_BACKUPS))) fs.rmSync(path.join(dir, n), { force: true });
      return { ok: true, dir };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle("rz:openBackupDir", async () => {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
  });

  // Export (Zeiten als PDF/XLSX): „Sichern unter“, Vorschlag ~/Dokumente/Rezeption Zeiten/<name>.
  ipcMain.handle("rz:saveExport", async (_e, name, bytes) => {
    try {
      if (typeof name !== "string" || !/^[\w.\-ÄÖÜäöüß ]{1,120}\.(pdf|xlsx)$/.test(name)) throw new Error("Ungültiger Dateiname");
      if (!(bytes instanceof Uint8Array) || bytes.length > 50 * 1024 * 1024) throw new Error("Ungültige Datei");
      const dir = path.join(app.getPath("documents"), "Rezeption Zeiten");
      fs.mkdirSync(dir, { recursive: true });
      const r = await dialog.showSaveDialog(win, { defaultPath: path.join(dir, name), filters: [{ name: name.endsWith(".pdf") ? "PDF" : "Excel", extensions: [name.split(".").pop()] }] });
      if (r.canceled || !r.filePath) return { ok: false, canceled: true };
      fs.writeFileSync(r.filePath, Buffer.from(bytes));
      return { ok: true, path: r.filePath };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle("rz:setAutoStart", (_e, on) => {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return app.getLoginItemSettings().openAtLogin;
  });
}

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => app.quit());

app.whenReady().then(() => {
  // App-Dateien ausliefern, nur innerhalb von APP_DIR.
  loadUpdate();
  protocol.handle("rezeption", (req) => {
    const { pathname } = new URL(req.url);
    // Dateien aus einem eingespielten Update haben Vorrang (nur die erlaubten Namen, geprüft beim Laden).
    const name = decodeURIComponent(pathname).replace(/^\/+/, "");
    if (active && active.files[name]) return new Response(active.files[name], { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    const file = path.normalize(path.join(APP_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(APP_DIR + path.sep) || !fs.existsSync(file)) return new Response("Nicht gefunden", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  registerIpc();
  buildMenu();
  createWindow();
});
