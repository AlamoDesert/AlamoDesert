# CLAUDE.md

## Projekt

Digitale Abhak-Checkliste für Früh- und Spätschicht an der Rezeption (Vorlage: Papier-Aushang „Checkliste neue Rezeption").

- `index.html` – komplette App, kein Build. Wird als claude.ai-Artifact veröffentlicht (Capabilities `db` + `user`); lokal im Browser geöffnet fällt sie auf `localStorage` zurück.
- Abhakbare Aufgaben und Uhrzeiten stehen in `SHIFTS`, Daueraufgaben ohne Haken (Rundgang, Wasserspender, Check-ins …) in `ALWAYS` oben im Script. Item-IDs (`f_*`, `s_*`) sind Schlüssel in der Datenbank – nie umbenennen, nur neue hinzufügen.
- Ansichten: Übersicht (Jetzt dran, Immer im Blick, Schichtplan, Übergabe), Früh, Spät, Monat.
- Datenmodell: ein Dokument pro Tag `days/YYYY-MM-DD` = `{ month: "YYYY-MM", checks: { <itemId>: { s: "done"|"na", by: <userId>, at: <ISO> } | null }, notes: { frueh|spaet: { text, by, at } } }`. Die Frühschicht liest die Spät-Notiz vom Vortag.

## Testen

Kein Test-Setup. `index.html` direkt im Browser öffnen (lokaler Modus) und Früh/Spät/Monat durchklicken.
