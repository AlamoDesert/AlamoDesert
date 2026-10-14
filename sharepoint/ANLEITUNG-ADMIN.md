# Rezeption Schichtcheck – Einrichtung in SharePoint Online

Für die Person mit SharePoint-Adminrechten. Dauer: ca. 15 Minuten.

## Was das Paket macht

- Ein SharePoint-Framework-Webpart (SPFx 1.23.2, ohne React), Datei `sharepoint/sharepoint/solution/rezeption-checkliste.sppkg` (im Repository).
- Keine API-Berechtigungen, kein Microsoft Graph, kein externer Server, kein Custom Script.
- Daten: JSON-Dateien in der Dokumentbibliothek **RezeptionDaten** der Website, auf der das Webpart liegt. Die App legt die Bibliothek beim ersten Öffnen selbst an (Benutzer braucht dafür die Berechtigung „Bearbeiten“, wie Websitemitglieder). Sicherung über den Versionsverlauf der Bibliothek.

## 1. Paket hochladen (Admin)

1. SharePoint Admin Center › **Weitere Features** › **Apps** › **Öffnen** (App-Katalog).
2. **Apps für SharePoint** › **Hochladen** › `rezeption-checkliste.sppkg` wählen.
3. Im Dialog **„Diese App allen Websites zur Verfügung stellen“** aktivieren (das Paket ist dafür vorbereitet) › **Bereitstellen**.

## 2. Seite anlegen (Websitebesitzer)

Variante A – ganze Seite nur für die Checkliste (empfohlen):
1. Auf der gewünschten Website: **Neu** › **App** › „Rezeption Schichtcheck“ wählen, Seite benennen (z. B. „Checkliste“), veröffentlichen.

Variante B – auf einer bestehenden Seite:
1. Seite bearbeiten › **+** › Webpart **„Rezeption Schichtcheck“** (Gruppe „Rezeption“) einfügen. Am besten in einen **Abschnitt mit voller Breite**.
2. Veröffentlichen.

Danach die Seite in der Navigation verlinken oder als Lesezeichen auf dem Rezeptions-MacBook ablegen.

## 3. Erster Start

1. Seite öffnen. Oben rechts sollte „Gespeichert in SharePoint“ stehen. In den Websiteinhalten erscheint die Bibliothek **RezeptionDaten**.
2. **Verwaltung** › Leitungs-PIN festlegen › Team anlegen › Dienstplan eintragen.
3. Vorhandene Daten vom Mac übernehmen (optional): In der bisherigen Mac-Version unter Verwaltung › Datensicherung eine Sicherung herunterladen, dann in SharePoint unter Verwaltung › Datenspeicher › **Sicherung übernehmen** einspielen.

## PDF-Import des Arbeitsplans (optional)

Unter Dienstplan › Bearbeiten › „Arbeitsplan einlesen“ liest die App Arbeitspläne als **Excel (.xlsx)** oder **PDF**.
- Excel funktioniert ohne weitere Einstellung.
- Für PDF lädt die App beim Import den PDF-Leser pdf.js von `https://cdn.jsdelivr.net`. Blockiert SharePoint das (Meldung „PDF-Leser konnte nicht geladen werden“), im SharePoint Admin Center unter **Erweitert › Vertrauenswürdige Skriptquellen** `https://cdn.jsdelivr.net` eintragen – oder weiter die Excel-Datei verwenden.

## Empfohlen

- Bibliothek **RezeptionDaten** › Einstellungen › Versionsverwaltung: Hauptversionen behalten (Standard 500 ist ausreichend).
- Die Dateien in der Bibliothek nicht von Hand bearbeiten. Zum Zurückdrehen: Datei › **Versionsverlauf** › gewünschten Stand **wiederherstellen**.

## Fehlerbilder

| Anzeige | Ursache | Lösung |
| --- | --- | --- |
| „SharePoint-Speicher nicht erreichbar: Bibliothek … konnte nicht angelegt werden“ | Benutzer darf keine Bibliotheken anlegen | Bibliothek „RezeptionDaten“ (Dokumentbibliothek) einmal von Hand anlegen |
| „Keine Berechtigung in SharePoint“ / „Nur Lesezugriff“ | Benutzer hat nur Leserechte | Benutzer zu den Websitemitgliedern hinzufügen |
| Webpart fehlt in der Auswahl | Paket nicht für alle Websites bereitgestellt | Schritt 1.3 wiederholen oder App auf der Website hinzufügen (Neu › App) |

## Neu bauen (Entwickler)

```
node tools/build.mjs            # app/ → index.html + sharepoint/src/webparts/rezeption/app.gen.ts
cd sharepoint && npm install && npm run build
# Ergebnis: sharepoint/sharepoint/solution/rezeption-checkliste.sppkg
```
Vor dem Hochladen einer neuen Version `version` in `sharepoint/config/package-solution.json` erhöhen.
