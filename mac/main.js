// Rezeption – Mac-App (Electron-Hülle um app/app.js).
// Lädt die App über das eigene Schema rezeption://app/ (feste Herkunft → Daten bleiben dauerhaft im App-Speicher),
// schreibt Sicherungen ohne Rückfrage nach ~/Dokumente/Rezeption Sicherungen und schaltet den Autostart.
"use strict";
const { app, BrowserWindow, ipcMain, protocol, net, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const APP_DIR = path.join(__dirname, "app");
const KEEP_DAILY_BACKUPS = 120;

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
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
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
      { role: "reload", label: "Neu laden" }, { type: "separator" },
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
  ipcMain.handle("rz:info", () => ({ backupDir: backupDir(), autoStart: app.getLoginItemSettings().openAtLogin, version: app.getVersion() }));

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

  ipcMain.handle("rz:setAutoStart", (_e, on) => {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return app.getLoginItemSettings().openAtLogin;
  });
}

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => app.quit());

app.whenReady().then(() => {
  // App-Dateien ausliefern, nur innerhalb von APP_DIR.
  protocol.handle("rezeption", (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(APP_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(APP_DIR + path.sep) || !fs.existsSync(file)) return new Response("Nicht gefunden", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  registerIpc();
  buildMenu();
  createWindow();
});
