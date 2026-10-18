// Brücke zwischen App (Seite) und Mac-App. Die Seite sieht nur diese Funktionen, keinen Node-Zugriff.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rezeptionNative", {
  pdfjsUrl: "rezeption://app/pdfjs/pdf.min.mjs",
  info: () => ipcRenderer.invoke("rz:info"),
  saveBackup: (text, date) => ipcRenderer.invoke("rz:saveBackup", text, date),
  openBackupDir: () => ipcRenderer.invoke("rz:openBackupDir"),
  setAutoStart: (on) => ipcRenderer.invoke("rz:setAutoStart", !!on),
});
