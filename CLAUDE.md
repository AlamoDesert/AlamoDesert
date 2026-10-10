# CLAUDE.md

## Projekt

Digitale Abhak-Checkliste für Früh- und Spätschicht an der Rezeption (Vorlage: Papier-Aushang „Checkliste neue Rezeption").

- `index.html` – komplette App, kein Build. Wird als claude.ai-Artifact veröffentlicht (Capabilities `db` + `user`); lokal im Browser geöffnet fällt sie auf `localStorage` zurück.
- Checklisteninhalt und Uhrzeiten stehen im Objekt `SHIFTS` oben im Script. Item-IDs (`f_*`, `s_*`, `*_rund_HH`) sind Schlüssel in der Datenbank – nie umbenennen, nur neue hinzufügen.
- Datenmodell: ein Dokument pro Tag `days/YYYY-MM-DD` = `{ month: "YYYY-MM", checks: { <itemId>: { s: "done"|"na", by: <userId>, at: <ISO> } | null } }`.

## Testen

Kein Test-Setup. `index.html` direkt im Browser öffnen (lokaler Modus) und Früh/Spät/Monat durchklicken.
