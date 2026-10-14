# CLAUDE.md

## Projekt

Digitale Abhak-Checkliste für Früh- und Spätschicht an der Rezeption (Vorlage: Papier-Aushang „Checkliste neue Rezeption").

- `index.html` – komplette App, kein Build. Hauptnutzung: lokal auf dem Rezeptions-MacBook (Chrome, `file://`), Daten in `localStorage` (Schlüssel `rz2*`). Automatische Sicherung per File System Access API in einen einmal gewählten Ordner (Handle in IndexedDB `rz2fs`; Ziel: per OneDrive synchronisierter SharePoint-Ordner): `rezeption-sicherung-aktuell.json` + eine Datei pro Tag, bei jeder Namenswahl und beim letzten Spätschicht-Haken. Ohne Ordner nur manueller Download. Import in der Verwaltung. Als claude.ai-Artifact (Capabilities `db` + `user`) läuft derselbe Code mit geteilter DB.
- Personen ohne Login: Team (`cfg.people`) und Dienstplan (`cfg.roster[datum] = {frueh, spaet}`) in der Konfiguration; zu Schichtbeginn Namensauswahl, aktive Person pro Gerät in `rz2who`. `by` in Haken/Notizen/Logs = Personen-ID.
- Verwaltung, Aufgaben-Plan und Dienstplan-Bearbeitung hinter Leitungs-PIN (`cfg.adminPin`, FNV-Hash) – nur Schutz vor versehentlichen Änderungen, keine echte Zugriffskontrolle.
- `DEFAULT_PLAN` im Script ist der Ausgangsplan (Aushang). Unter Verwaltung › Aufgaben-Plan lässt er sich ändern; welcher Plan gilt, entscheidet `resolvePlan`: Tagesanpassung (`days/<datum>.plan`) > Wochentag-Vorlage (`config/plan.weekday["0"-"6"]`, 0 = Sonntag) > Standard (`config/plan.base`) > `DEFAULT_PLAN`. Alles aus der DB läuft durch `normalizePlan`.
- Item-IDs (`f_*`, `s_*`, neue `*_x…`) sind Schlüssel für die Haken – nie umbenennen. Daueraufgaben (`always`) sind beliebig oft abhakbar: jeder Tipp ist ein Eintrag in `logs`; optional `every` (Minuten) für Fälligkeit, z. B. Rundgang = 60.
- Ansichten: Übersicht (Jetzt dran, Schichtplan + Dienst heute, Immer im Blick, Übergabe), Früh/Spät (Fahrplan: chronologische Liste, erledigte Abschnitte als eine Zeile, aktueller hervorgehoben; im Querformat zweispaltig), Dienstplan (Woche), Monat, Verwaltung (Team, Aufgaben-Plan, Datensicherung, PIN). Im Querformat ≥ 900 px passt alles auf einen Bildschirm, nur Karten scrollen intern.
- Datenmodell: ein Dokument pro Tag `days/YYYY-MM-DD` = `{ month: "YYYY-MM", checks: { <itemId>: { s: "done"|"na", by: <userId>, at: <ISO> } | null }, notes: { frueh|spaet: { text, by, at } }, logs: { frueh|spaet: { <alwaysId>: { <key>: { at, by } | null } } }, plan?: Plan|null }`. Die Frühschicht liest die Spät-Notiz vom Vortag.

## Courtside (`courtside/`)

Eigene Web-App (PWA, kein Build) für Turniere in Padel (Schwerpunkt), Pickleball und Tennis. Unabhängig von der Checkliste. Netlify-Basisverzeichnis ist `courtside/` (`netlify.toml`).

Live unter https://courtside-turniere.netlify.app (Netlify-Site-ID `5bae8eb4-f745-4e26-83f0-40e6d65e26ac`, nur die Produktion ist öffentlich, Vorschauen brauchen Netlify-Login). Neu veröffentlichen: Netlify-Connector `deploy-site` mit dieser `siteId`, den gelieferten Befehl im Ordner `courtside/` ausführen. Die Cloud-Umgebung darf Netlify nicht erreichen; der Befehl läuft deshalb in einer Sitzung auf dem Raspberry Pi des Nutzers.

- `public/` – die App. `engine.js` ist reine Logik ohne DOM: vier Modi (Americano, Mexicano, King of the Court, Team-Turnier) auf zwei Motoren (`rotation`, `ladder`), Spielstärke (`LEVELS`, Playtomic 0–7 hat Vorrang), Teambildung (`buildTeams`: `similar` = gut mit gut, `balanced` = gut mit schwächer), Tabellen und `next()` = „Was kommt als Nächstes“.
- `public/app.js` – Oberfläche, Speicher (`localStorage` `courtside.v1`, Spieler-Links in `courtside.me`), Undo per Snapshot, Timer, Navigation mit History-API. Turniere mit `status: 'draft'` sind offene Online-Anmeldungen; erst beim Start entsteht daraus ein Engine-Turnier.
- Spielerseite: `?anmeldung=<eventId>` (gemeinsamer Link), persönlicher Link zusätzlich `&ich=<playerId>#k=<token>`.
- `netlify/functions/api/` – Anmelde-API unter `/api/*`: `core.mts` ist die Logik mit austauschbarem Speicher, `api.mts` bindet Netlify Blobs an (Region `eu-central-1`). Jede Anmeldung ist ein eigener Blob-Schlüssel (`e/<id>/p/<pid>`), Admin- und Spieler-Schlüssel liegen nur als SHA-256 vor.
- `public/index.html` – CSS mit zwei Designsprachen über `html[data-platform="ios"|"android"]`. Spielfelder im echten Seitenverhältnis (Padel 20 × 10 m).
- `public/sw.js` – Offline-Cache, `/api/*` geht immer ans Netz. Bei Änderungen an Dateien `CACHE` hochzählen.
- `public/vendor/qrcode.js` – QR-Code-Generator (Kazuhiko Arase, MIT), unverändert.

## Testen

Checkliste: kein Test-Setup. `index.html` direkt im Browser öffnen (lokaler Modus) und Früh/Spät/Monat durchklicken.

Courtside (im Ordner `courtside/`): `npm test` prüft Engine und API. `npm run dev` startet `dev/server.mjs` auf Port 8888: liefert `public/` aus und beantwortet `/api/*` mit einem Speicher im Arbeitsspeicher, so lässt sich die Online-Anmeldung lokal mit mehreren Browserfenstern durchspielen.
