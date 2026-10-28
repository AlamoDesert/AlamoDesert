# Änderungen – Rezeption Schichtcheck

Version = `version` in `mac/package.json`. Neueste zuerst. Neue Einträge oben anfügen.

## Unveröffentlicht

- Entwickler-Unterlagen: `README.md`, `ENTWICKLUNG.md`, `CHANGELOG.md`, `.nvmrc` (Node 22), `sharepoint/README.md` neu; `.gitignore` schließt Sicherungen und Exporte aus.

## 1.9.3 – 25.10.2026
- Import-Protokoll entfernt, Monatspfeile direkt am Monat.

## 1.9.2 – 25.10.2026
- Reiter „Check-ins“ direkt nach „Schicht“.

## 1.9.1 – 25.10.2026
- Import-Vorschau wurde in niedrigen Fenstern auf 2 px zusammengedrückt.

## 1.9.0 – 25.10.2026
- Datei-Auswahl über festes Feld außerhalb von `<main>` (iPad-Safari verlor die Datei beim Neuzeichnen).
- Webversion: pdf.js-Legacy-Fassung für älteres Safari.

## 1.8.9 – 24.10.2026
- PDF-Import auf dem iPad; Eingecheckte in der Anmeldemaske hervorgehoben.

## 1.8.8 – 24.10.2026
- PDF-Leser in der Webversion mitgeliefert statt von jsDelivr geladen.

## 1.8.7 – 24.10.2026
- Monatsplan-Import robuster (Web ohne pdf.js-Worker, keine Anmeldemaske beim Bearbeiten).

## 1.8.6 – 24.10.2026
- Check-ins: Benefit deutlich anzeigen und vor dem Buchen prüfen.

## 1.8.5 – 24.10.2026
- Check-ins: Prüfung in Gruppen, Wallet in Schritten mit Notiz und Ablehnen; Testdaten für alle Prüffälle.

## 1.8.3 – 24.10.2026
- „Leitung“ statt „Schichtleitung“.

## 1.8.2 – 24.10.2026
- Reiter „Erstattung“ heißt jetzt „Check-ins“.

## 1.8.1 – 24.10.2026
- Leitungs-PIN lässt sich deaktivieren.

## 1.8.0 – 24.10.2026
- Anmeldemaske, Anwesend-Leiste, Nur-ansehen-Modus, Feierabend-Bildschirm.

## 1.7.1 – 24.10.2026
- Erstattung im Design der App, Anbindung an Fahrplan, Person und Farbschema.

## 1.7.0 – 24.10.2026
- Reiter „Erstattung“ (Check-in-Erstattung) in Mac-App und Webversion.

## 1.6.1 – 18.10.2026
- Nach dem Auschecken nicht sofort neu einchecken lassen.
- Webversion (20.10.): Downloads über claude.ai, Mac-Sicherung im Web übernehmen.

## 1.6.0 – 18.10.2026
- Plan-Zeiten wieder editierbar, Vorlagen für Mo–Fr und Sa+So.

## 1.5.1 – 18.10.2026
- „entfällt“ streicht durch und sperrt den Haken.

## 1.5.0 – 18.10.2026
- Dienstplan-Notizen bearbeiten, Tage einer Person hervorheben.

## 1.4.0 – 18.10.2026
- Übergabe als gelesen bestätigen und als wichtig markieren.

## 1.3.1 – 18.10.2026
- Höhe von „Dienst & Übergabe“ pro Person einstellbar.

## 1.3.0 – 18.10.2026
- Notizen beim Ein-/Auschecken, Rolle „Sonstiges“, Spaltenbreite pro Person.

## Vor 1.3.0 – 14.–18.10.2026
- Mac-App (Electron) mit automatischen Sicherungen, Autostart und PDF-Import ohne Internet.
- Ein- und Auschecken in 15-Minuten-Schritten, Zeitenübersicht mit Korrekturen, PDF/XLSX-Export.
- Eine Schicht-Ansicht, Monatskalender für den Dienstplan, drei Arten von Daueraufgaben.
- Monatsplan-Import aus PDF oder Excel.
- SharePoint-Webpart (App als Modul, Speicher in einer Dokumentbibliothek).
- Automatische Sicherung bei Schichtbeginn und Tagesabschluss in einen gewählten Ordner.
