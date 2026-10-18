# Rezeption – Mac-App installieren

Einmalig ca. 5 Minuten. Voraussetzung: macOS 13 (Ventura) oder neuer.

## 1. Richtige Datei wählen

Apple-Menü  › **Über diesen Mac**:
- steht dort **„Chip: Apple M1/M2/M3/M4 …“** → `Rezeption-AppleChip.zip`
- steht dort **„Prozessor: Intel …“** → `Rezeption-Intel.zip`

## 2. Installieren

1. ZIP-Datei doppelklicken – es erscheint **Rezeption**.
2. **Rezeption** in den Ordner **Programme** ziehen.

## 3. Erstes Öffnen (nur einmal)

Die App ist nicht bei Apple registriert, deshalb fragt macOS beim ersten Start nach:

- **macOS 13 oder 14:** Im Programme-Ordner **Rechtsklick auf Rezeption › Öffnen › Öffnen**.
- **macOS 15 oder neuer:** Rezeption doppelklicken, Meldung mit **Fertig** schließen. Dann **Systemeinstellungen › Datenschutz & Sicherheit**, ganz unten bei „Rezeption wurde blockiert“ auf **Dennoch öffnen** klicken und mit dem Mac-Passwort bestätigen.

Erscheint stattdessen „Rezeption ist beschädigt“: Programm **Terminal** öffnen, diese Zeile einfügen und Enter drücken:

```
xattr -cr /Applications/Rezeption.app
```

Danach startet die App mit Doppelklick – ab jetzt ohne Nachfrage.

## 4. Einrichten

1. Im Dock: **Rechtsklick auf das Rezeption-Symbol › Optionen › Im Dock behalten**.
2. **Daten aus der Testversion übernehmen:** Verwaltung › Datensicherung › **Sicherung einspielen** › `Rezeption-Startdaten.json` wählen. Danach sind Team, Aufgaben-Plan, Dienstplan und Leitungs-PIN wie in der Testversion.
   *(Ohne Startdatei: beim Öffnen der Verwaltung eine neue Leitungs-PIN festlegen.)*
3. Verwaltung › Datensicherung › Haken bei **„Beim Anmelden am Mac automatisch starten“**. Fragt macOS nach, unter Systemeinstellungen › Allgemein › Anmeldeobjekte „Rezeption“ erlauben.

## Im Alltag

- **Monatsplan:** Dienstplan › Bearbeiten › **Monatsplan einlesen** › PDF wählen › Vorschau prüfen › Übernehmen. Funktioniert ohne Internet.
- **Sicherungen** legt die App selbst ab: bei jedem Schichtbeginn und zum Tagesabschluss in **Dokumente › Rezeption Sicherungen** (`rezeption-sicherung-aktuell.json` + eine Datei pro Tag, die letzten 120 Tage).
- **Wiederherstellen:** Verwaltung › Datensicherung › Sicherung einspielen › `rezeption-sicherung-aktuell.json`.
- **Gut zu wissen:** Die Daten gehören zum macOS-Benutzer, mit dem die App läuft. Am Rezeptions-Mac also immer mit demselben Benutzer arbeiten.

## Update auf eine neue Version

Neue ZIP öffnen und **Rezeption** im Programme-Ordner ersetzen. Die Daten bleiben erhalten (sie liegen nicht in der App, sondern in `~/Library/Application Support/Rezeption`).
