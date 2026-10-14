# CLAUDE.md

## Projekt

Digitale Abhak-Checkliste für Früh- und Spätschicht an der Rezeption (Vorlage: Papier-Aushang „Checkliste neue Rezeption").

- `index.html` – komplette App, kein Build. Hauptnutzung: lokal auf dem Rezeptions-MacBook (Chrome, `file://`), Daten in `localStorage` (Schlüssel `rz2*`, Export/Import in der Verwaltung). Als claude.ai-Artifact (Capabilities `db` + `user`) läuft derselbe Code mit geteilter DB.
- Personen ohne Login: Team (`cfg.people`) und Dienstplan (`cfg.roster[datum] = {frueh, spaet}`) in der Konfiguration; zu Schichtbeginn Namensauswahl, aktive Person pro Gerät in `rz2who`. `by` in Haken/Notizen/Logs = Personen-ID.
- Verwaltung, Aufgaben-Plan und Dienstplan-Bearbeitung hinter Leitungs-PIN (`cfg.adminPin`, FNV-Hash) – nur Schutz vor versehentlichen Änderungen, keine echte Zugriffskontrolle.
- `DEFAULT_PLAN` im Script ist der Ausgangsplan (Aushang). Im Tab „Plan anpassen“ lässt er sich ändern; welcher Plan gilt, entscheidet `resolvePlan`: Tagesanpassung (`days/<datum>.plan`) > Wochentag-Vorlage (`config/plan.weekday["0"-"6"]`, 0 = Sonntag) > Standard (`config/plan.base`) > `DEFAULT_PLAN`. Alles aus der DB läuft durch `normalizePlan`.
- Item-IDs (`f_*`, `s_*`, neue `*_x…`) sind Schlüssel für die Haken – nie umbenennen. Daueraufgaben (`always`) sind beliebig oft abhakbar: jeder Tipp ist ein Eintrag in `logs`; optional `every` (Minuten) für Fälligkeit, z. B. Rundgang = 60.
- Ansichten: Übersicht (Jetzt dran, Schichtplan + Dienst heute, Immer im Blick, Übergabe), Früh/Spät (Fahrplan: chronologische Liste, erledigte Abschnitte als eine Zeile, aktueller hervorgehoben; im Querformat zweispaltig), Dienstplan (Woche), Monat, Verwaltung (Team, Aufgaben-Plan, Datensicherung, PIN). Im Querformat ≥ 900 px passt alles auf einen Bildschirm, nur Karten scrollen intern.
- Datenmodell: ein Dokument pro Tag `days/YYYY-MM-DD` = `{ month: "YYYY-MM", checks: { <itemId>: { s: "done"|"na", by: <userId>, at: <ISO> } | null }, notes: { frueh|spaet: { text, by, at } }, logs: { frueh|spaet: { <alwaysId>: { <key>: { at, by } | null } } }, plan?: Plan|null }`. Die Frühschicht liest die Spät-Notiz vom Vortag.

## Testen

Kein Test-Setup. `index.html` direkt im Browser öffnen (lokaler Modus) und Früh/Spät/Monat durchklicken.
