# Entwicklung – Rezeption Schichtcheck

Kurzanleitung für Entwicklerinnen und Entwickler. Details zu Datenmodell, Ansichten und Stolperfallen stehen in [CLAUDE.md](CLAUDE.md). Courtside (`courtside/`) ist ein eigenes Projekt, siehe dort und CLAUDE.md.

## Voraussetzungen

- **Node 22** (`.nvmrc`).
- Für die Mac-App: macOS oder die Variablen `ELECTRON_ZIP_DIR` und `RCODESIGN` (siehe unten).
- Kein Framework, keine Laufzeit-Abhängigkeiten in `app/`. Fremdcode nur gebündelt: pdf.js 4.4.168 und SheetJS 0.18.5 (devDependencies in `mac/package.json`).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `app/app.js`, `app/app.css` | **Quelle** der App: `mount(container, opts)` und `createSpDb(opts)` |
| `app/checkin.html` | **Quelle** der Check-in-Erstattung (eigene Seite, im iframe) |
| `app/fonts/` | Barlow-Schriften (woff2) und Lizenztexte (SIL OFL 1.1); werden beim Bauen eingebettet |
| `tools/build.mjs` | erzeugt `index.html`, `checkin.html` (Schriften eingebettet), `pdfjs/`, `vendor/` |
| `index.html`, `checkin.html` | **generiert** – nie direkt bearbeiten |
| `mac/` | Electron-Hülle: `main.js` (Schema `rezeption://app/`, Sicherungen, Export), `preload.js` (Brücke `window.rezeptionNative`), `build-mac.mjs` |
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

**Update-Datei** (statt neuer ZIP, wenn sich nur `app/` geändert hat; ab Mac-App 1.21):

```sh
RZ_UPDATE_KEY=/pfad/rezeption-update-key.pem node tools/make-update.mjs   # → mac/dist/Rezeption-<version>.rzupdate
```

Version vorher in `mac/package.json` erhöhen. Der private Schlüssel gehört nie ins Repository. Änderungen an `mac/main.js`, `mac/preload.js` oder `mac/update-format.js` brauchen eine neue ZIP.

**Webversion** (claude.ai-Artifact, nur Testbetrieb): `index.html` veröffentlichen mit `files: {checkin.html, pdfjs/pdf.min.mjs, pdfjs/pdf.worker.min.mjs, vendor/xlsx.full.min.js}` (`pdfjs/` und `vendor/` entstehen nur nach `cd mac && npm install`) und den Fähigkeiten `db`, `user`, `downloads`.

## Testen

Mindestens prüfen:

1. `node tools/build.mjs` läuft ohne Fehler, danach `node tools/test-fenster.cjs` (Playwright/Chromium): spielt alle Eingabefenster durch – Enter speichert, Eingaben überleben Neuzeichnen und PIN-Sperre, kein doppeltes Anlegen. Bei Änderungen an der Mac-Hülle oder am Update-Format zusätzlich `node tools/test-update.cjs`.
2. `index.html` im Browser: Einchecken, Haken setzen, Übergabe schreiben, Auschecken, Zeiten-Ansicht.
3. Bei Änderungen am Speicher: alte Sicherung einspielen (Verwaltung › Datensicherung) – muss weiter funktionieren.
4. Check-ins (nur falls wieder eingeschaltet): Dateien aus `testdaten/checkins/` einlesen, Ergebnis mit `LIESMICH.md` vergleichen.
5. Monatsplan-Import: PDF und XLSX; auf dem iPad (Safari) wenn möglich.

## Regeln

- **`index.html` und `checkin.html` nie direkt bearbeiten**, nur `app/` und dann `node tools/build.mjs`.
- **Item-IDs** im Plan (`f_*`, `s_*`, `*_x…`) nie umbenennen – sie sind Schlüssel der gespeicherten Haken.
- **Datenformat abwärtskompatibel** halten: Sicherungen (`app: "rezeption-schichtcheck"`, `version: 1`) älterer Versionen müssen sich weiter laden lassen. Neue Felder optional, alles aus dem Speicher läuft durch `normalize…`-Funktionen.
- **Version erhöhen** bei jeder App-Änderung: `mac/package.json` (`version`). Eintrag in [CHANGELOG.md](CHANGELOG.md), Commit-Titel „Rezeption X.Y.Z: …“.
- **CLAUDE.md mitpflegen**, wenn sich Verhalten, Datenmodell oder Build ändern.
- **Eingabefenster:** Formulare mit `<form id=…>` und Submit-Handler (Enter = Speichern), Felder mit `id` in einem `.overlay` werden automatisch gemerkt (`rememberDraft`/`restoreDrafts`). Nach dem Speichern `blurActive()`, sonst schiebt `render()` das Neuzeichnen auf.
- Keine `prompt()`/`confirm()` (Electron hat kein `prompt`) – `ask()` nutzen. Keine Emojis in der Oberfläche.
- Texte der Oberfläche auf Deutsch, Du-Form.

## Datenschutz beim Entwickeln

- **Keine echten Daten** ins Repository, in Issues, Commits oder Screenshots. `.gitignore` schließt Sicherungen (`rezeption-sicherung-*.json`) und Exporte aus; trotzdem vor jedem Commit `git status` prüfen.
- Zum Nachstellen von Fehlern nur erfundene Daten oder eine vom Betreiber geschwärzte Sicherung verwenden.
- Die **Webversion** enthält nur Testdaten. Keine Mac-Sicherung dort einspielen.
- **Keine externen Abrufe** (Schriften, CDNs, APIs): Sie übertragen die IP-Adresse an Dritte. Schriften liegen in `app/fonts/`, Fremdbibliotheken werden lokal gebündelt. 
- Sicherungen enthalten die gesamte Historie inkl. Check-in-Kundendaten (`cir.*`) und den PIN-Hash. Die Leitung kann sie verschlüsseln (`version: 2`, siehe CLAUDE.md). Das Einspielen muss für `version: 1` (Klartext) und `version: 2` funktionieren. Änderungen an `backupPayload()` / `rz:saveBackup` mit dem Betreiber abstimmen.
