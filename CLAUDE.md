# CLAUDE.md

## Projekt

Digitale Abhak-Checkliste für Früh- und Spätschicht an der Rezeption (Vorlage: Papier-Aushang „Checkliste neue Rezeption").

- `index.html` – komplette App, kein Build. Wird als claude.ai-Artifact veröffentlicht (Capabilities `db` + `user`); lokal im Browser geöffnet fällt sie auf `localStorage` zurück.
- `DEFAULT_PLAN` im Script ist der Ausgangsplan (Aushang). Im Tab „Plan anpassen“ lässt er sich ändern; welcher Plan gilt, entscheidet `resolvePlan`: Tagesanpassung (`days/<datum>.plan`) > Wochentag-Vorlage (`config/plan.weekday["0"-"6"]`, 0 = Sonntag) > Standard (`config/plan.base`) > `DEFAULT_PLAN`. Alles aus der DB läuft durch `normalizePlan`.
- Item-IDs (`f_*`, `s_*`, neue `*_x…`) sind Schlüssel für die Haken – nie umbenennen. Daueraufgaben (`always`) sind beliebig oft abhakbar: jeder Tipp ist ein Eintrag in `logs`; optional `every` (Minuten) für Fälligkeit, z. B. Rundgang = 60.
- Ansichten: Übersicht (Jetzt dran, Schichtplan, Immer im Blick, Übergabe), Früh/Spät (Fahrplan: chronologische Liste, erledigte Abschnitte als eine Zeile, aktueller hervorgehoben; im Querformat zweispaltig), Monat, Plan anpassen. Im Querformat ≥ 900 px passt alles auf einen Bildschirm, nur Karten scrollen intern.
- Datenmodell: ein Dokument pro Tag `days/YYYY-MM-DD` = `{ month: "YYYY-MM", checks: { <itemId>: { s: "done"|"na", by: <userId>, at: <ISO> } | null }, notes: { frueh|spaet: { text, by, at } }, logs: { frueh|spaet: { <alwaysId>: { <key>: { at, by } | null } } }, plan?: Plan|null }`. Die Frühschicht liest die Spät-Notiz vom Vortag.

## Courtside (`courtside/`)

Eigene Web-App (PWA, kein Build) für Turniere in Padel (Schwerpunkt), Pickleball und Tennis. Unabhängig von der Checkliste.

- `engine.js` – reine Logik ohne DOM (Formate, Modi, Auslosung, Tabellen, `next()` = „Was kommt als Nächstes“). Vier Motoren: `rotation` (Americano, Mexicano, Mixed, Team-Varianten), `ladder` (King of the Court), `queue` (Gewinner bleibt), `rally` (Königsseite), `pool` (Jeder gegen jeden, K.-o., Gruppen + K.-o., Kompass; Spiele als Graph mit `sa`/`sb`-Quellen, Plätze werden frei vergeben).
- `app.js` – Oberfläche, Speicher (`localStorage` Schlüssel `courtside.v1`), Undo per Snapshot, Timer, Navigation mit History-API (Android-Zurück).
- `content.js` – Texte zu Modi und Regeln. `index.html` – CSS mit zwei Designsprachen über `html[data-platform="ios"|"android"]` (iOS 26 / Material 3 Expressive), automatisch erkannt, in den Einstellungen umschaltbar.
- `sw.js` + `manifest.webmanifest` – offline und installierbar. Bei Änderungen an Dateien `CACHE` in `sw.js` hochzählen.
- `vendor/qrcode.js` – QR-Code-Generator (Kazuhiko Arase, MIT), unverändert.

## Testen

Checkliste: kein Test-Setup. `index.html` direkt im Browser öffnen (lokaler Modus) und Früh/Spät/Monat durchklicken.

Courtside: `node --test courtside/tests/engine.test.js` prüft die Engine. Die App über einen lokalen Server öffnen (`python3 -m http.server` im Ordner `courtside/`), sonst greifen Service Worker und Manifest nicht.
