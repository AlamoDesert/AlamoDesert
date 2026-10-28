# AlamoDesert

Zwei unabhängige Anwendungen für den Club:

| Ordner | Anwendung | Kurzbeschreibung |
| --- | --- | --- |
| `app/`, `mac/`, `sharepoint/`, `tools/` | **Rezeption Schichtcheck** | Digitale Checkliste für Früh- und Spätschicht mit Dienstplan, Zeiterfassung, Schichtübergabe und Check-in-Erstattung (USC, Wellpass, Wellhub, Hansefit gegen Playtomic). |
| `courtside/` | **Courtside** | Turnier-App (PWA) für Padel, Pickleball und Tennis mit Online-Anmeldung, live unter https://courtside-turniere.netlify.app. |

## Rezeption Schichtcheck – wo läuft was

| Variante | Zweck | Daten |
| --- | --- | --- |
| **Mac-App** (`mac/`) | Echtbetrieb auf dem Rezeptions-Mac (Apple M1) | lokal im App-Speicher, Sicherungen in `~/Documents/Rezeption Sicherungen` |
| **Webversion** (claude.ai-Artifact) | nur Test und Vorführung | **ausschließlich erfundene Testdaten** |
| **SharePoint-Webpart** (`sharepoint/`) | vorbereitet, nicht im Einsatz | Dokumentbibliothek `RezeptionDaten` |

Alle drei nutzen denselben Quellcode `app/app.js` + `app/app.css` (+ `app/checkin.html`).

## Schnellstart

```sh
nvm use                     # Node 22 (siehe .nvmrc)
node tools/build.mjs        # erzeugt index.html, checkin.html, SharePoint-Modul
open index.html             # App im Browser (Speicher: localStorage)
```

Mac-App bauen, SharePoint-Paket bauen, Testen und Regeln: **[ENTWICKLUNG.md](ENTWICKLUNG.md)**.
Änderungen pro Version: **[CHANGELOG.md](CHANGELOG.md)**.
Ausführliche Projektbeschreibung (Datenmodell, Stolperfallen): **[CLAUDE.md](CLAUDE.md)**.

Anleitungen für den Betrieb: [`mac/ANLEITUNG-MAC.md`](mac/ANLEITUNG-MAC.md) (Installation auf dem Mac), [`sharepoint/ANLEITUNG-ADMIN.md`](sharepoint/ANLEITUNG-ADMIN.md) (SharePoint-Admin).

## Datenschutz

Die App verarbeitet Arbeitszeiten von Mitarbeitenden und Namen von Kundinnen und Kunden. Deshalb:

- **Keine echten Daten ins Repository.** Sicherungen und Exporte sind per `.gitignore` ausgeschlossen; Testdaten unter `testdaten/` sind erfunden.
- **Webversion nur mit erfundenen Testdaten.**
- Datenschutz-Bestandsaufnahme und Vorlagen (Informationsblatt, Verarbeitungsverzeichnis, TOM, Löschkonzept) liegen außerhalb des Repositorys bei der Leitung der Rezeption.
