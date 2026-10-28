# Entwicklung – Rezeption Schichtcheck

Kurzanleitung für Entwicklerinnen und Entwickler. Details zu Datenmodell, Ansichten und Stolperfallen stehen in [CLAUDE.md](CLAUDE.md). Courtside (`courtside/`) ist ein eigenes Projekt, siehe dort und CLAUDE.md.

## Voraussetzungen

- **Node 22** (`.nvmrc`; das SharePoint-Projekt verlangt `>=22.14 <23`).
- Für die Mac-App: macOS oder die Variablen `ELECTRON_ZIP_DIR` und `RCODESIGN` (siehe unten).
- Kein Framework, keine Laufzeit-Abhängigkeiten in `app/`. Fremdcode nur gebündelt: pdf.js 4.4.168 und SheetJS 0.18.5 (devDependencies in `mac/package.json`).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `app/app.js`, `app/app.css` | **Quelle** der App: `mount(container, opts)` und `createSpDb(opts)` |
| `app/checkin.html` | **Quelle** der Check-in-Erstattung (eigene Seite, im iframe) |
| `tools/build.mjs` | erzeugt `index.html`, `checkin.html`, `pdfjs/` und `sharepoint/src/webparts/rezeption/app.gen.ts` |
| `index.html`, `checkin.html` | **generiert** – nie direkt bearbeiten |
| `mac/` | Electron-Hülle: `main.js` (Schema `rezeption://app/`, Sicherungen, Export), `preload.js` (Brücke `window.rezeptionNative`), `build-mac.mjs` |
| `sharepoint/` | SPFx-1.23.2-Webpart; `.sppkg` unter `sharepoint/sharepoint/solution/` wird committet |
| `tools/sp-mock.mjs` | Nachbau der SharePoint-REST-Endpunkte für Tests ohne Tenant |
| `testdaten/` | **erfundene** Testdaten (Check-in-Prüftag 23.10.2026) |

## Bauen

```sh
node tools/build.mjs                         # immer zuerst, nach jeder Änderung in app/
```

**Mac-App** (Echtbetrieb, Rezeptions-Mac = Apple M1):

```sh
cd mac && npm install && npm run build       # → mac/dist/Rezeption-AppleChip.zip
ARCHS=arm64,x64 npm run build                # zusätzlich Intel
```

Ohne Mac (Cloud/Linux): `ELECTRON_ZIP_DIR=<Ordner mit electron-v44.5.1-darwin-arm64.zip>` und `RCODESIGN=<Pfad zu rcodesign 0.29>` setzen – sonst lädt der Packer Electron selbst bzw. die App startet auf Apple-Chips nicht. Installation beim Nutzer: [`mac/ANLEITUNG-MAC.md`](mac/ANLEITUNG-MAC.md).

**SharePoint-Paket:**

```sh
node tools/build.mjs && cd sharepoint && npm install && npm run build
```

Ergebnis: `sharepoint/sharepoint/solution/rezeption-checkliste.sppkg`. Admin-Anleitung: [`sharepoint/ANLEITUNG-ADMIN.md`](sharepoint/ANLEITUNG-ADMIN.md).

**Webversion** (claude.ai-Artifact, nur Testbetrieb): `index.html` veröffentlichen mit `files: {checkin.html, pdfjs/pdf.min.mjs, pdfjs/pdf.worker.min.mjs}` und den Fähigkeiten `db`, `user`, `downloads`.

## Testen

Kein automatisiertes Test-Setup für die Rezeption. Mindestens prüfen:

1. `node tools/build.mjs` läuft ohne Fehler.
2. `index.html` im Browser: Einchecken, Haken setzen, Übergabe schreiben, Auschecken, Zeiten-Ansicht.
3. Bei Änderungen am Speicher: alte Sicherung einspielen (Verwaltung › Datensicherung) – muss weiter funktionieren.
4. Bei SharePoint-Änderungen: `node tools/sp-mock.mjs 8899` → `http://localhost:8899/sites/rez/test.html`; `/__dump` zeigt die Dateien, `/__fail?n=3` simuliert Schreibfehler.
5. Check-ins: Dateien aus `testdaten/checkins/` einlesen, Ergebnis mit `LIESMICH.md` vergleichen.
6. Monatsplan-Import: PDF und XLSX; auf dem iPad (Safari) wenn möglich.

## Regeln

- **`index.html` und `checkin.html` nie direkt bearbeiten**, nur `app/` und dann `node tools/build.mjs`.
- **Item-IDs** im Plan (`f_*`, `s_*`, `*_x…`) nie umbenennen – sie sind Schlüssel der gespeicherten Haken.
- **Datenformat abwärtskompatibel** halten: Sicherungen (`app: "rezeption-schichtcheck"`, `version: 1`) und SharePoint-Dateien älterer Versionen müssen sich weiter laden lassen. Neue Felder optional, alles aus dem Speicher läuft durch `normalize…`-Funktionen.
- **Version erhöhen** bei jeder App-Änderung: `mac/package.json` (`version`), bei SharePoint zusätzlich `sharepoint/config/package-solution.json`. Eintrag in [CHANGELOG.md](CHANGELOG.md), Commit-Titel „Rezeption X.Y.Z: …“.
- **CLAUDE.md mitpflegen**, wenn sich Verhalten, Datenmodell oder Build ändern.
- Keine `prompt()`/`confirm()` (Electron hat kein `prompt`) – `ask()` nutzen. Keine Emojis in der Oberfläche.
- Texte der Oberfläche auf Deutsch, Du-Form.

## Datenschutz beim Entwickeln

- **Keine echten Daten** ins Repository, in Issues, Commits oder Screenshots. `.gitignore` schließt Sicherungen (`rezeption-sicherung-*.json`) und Exporte aus; trotzdem vor jedem Commit `git status` prüfen.
- Zum Nachstellen von Fehlern nur erfundene Daten oder eine vom Betreiber geschwärzte Sicherung verwenden.
- Die **Webversion** enthält nur Testdaten. Keine Mac-Sicherung dort einspielen.
- Neue externe Abrufe (Schriften, CDNs, APIs) vermeiden: Sie übertragen die IP-Adresse an Dritte. Fremdbibliotheken lokal bündeln.
- Sicherungen enthalten die gesamte Historie inkl. Check-in-Kundendaten (`cir.*`) und den PIN-Hash. Änderungen an `backupPayload()` / `rz:saveBackup` mit dem Betreiber abstimmen.
