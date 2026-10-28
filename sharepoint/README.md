# Rezeption Schichtcheck – SharePoint-Webpart

SPFx-1.23.2-Webpart ohne Framework. Es zeigt dieselbe App wie die Mac-App, speichert aber in einer SharePoint-Dokumentbibliothek. **Status: vorbereitet, nicht im Einsatz** – der Echtbetrieb läuft über die Mac-App.

## Wie es funktioniert

- `src/webparts/rezeption/RezeptionWebPart.ts` bindet `app.gen.ts` ein und ruft `mount(container, { mode: "sharepoint", … })` auf.
- `src/webparts/rezeption/app.gen.ts` ist **generiert** aus `app/app.js` + `app/app.css` (`node tools/build.mjs` im Hauptordner) – nie direkt bearbeiten.
- Speicher: Bibliothek `RezeptionDaten` mit `config/plan.json` und `days/JJJJ-MM/JJJJ-MM-TT.json`. Schreiben per Lesen-Mergen-Schreiben mit ETag/If-Match, Abgleich alle 15 s. Der Versionsverlauf der Bibliothek dient als Sicherung.
- Der Reiter „Check-ins“ erscheint hier nicht (kein `checkinUrl`).
- Zugriffsschutz kommt aus den **SharePoint-Berechtigungen** der Website bzw. Bibliothek; die Leitungs-PIN der App schützt nur vor Versehen.

## Bauen

```sh
nvm use                         # Node 22 (Hauptordner .nvmrc; hier gefordert: >=22.14 <23)
node ../tools/build.mjs         # app.gen.ts aktualisieren (aus dem Hauptordner: node tools/build.mjs)
npm install
npm run build
```

Ergebnis: `sharepoint/solution/rezeption-checkliste.sppkg` (wird committet).

**Neue Version:** `version` in `config/package-solution.json` erhöhen (Solution und Feature), dazu `mac/package.json` und [`../CHANGELOG.md`](../CHANGELOG.md).

## Testen ohne Tenant

```sh
node ../tools/sp-mock.mjs 8899
```

Öffnet unter `http://localhost:8899/sites/rez/test.html` die App im SharePoint-Modus (Abgleich jede Sekunde). `/__dump` zeigt die gespeicherten Dateien, `/__fail?n=3` lässt die nächsten Schreibzugriffe scheitern. Mit `PDFJS_DIR=<pdfjs-dist>/build` liefert der Nachbau pdf.js lokal aus.

## Einrichtung im Tenant

Siehe [ANLEITUNG-ADMIN.md](ANLEITUNG-ADMIN.md).

## Weitere Unterlagen

[`../README.md`](../README.md) · [`../ENTWICKLUNG.md`](../ENTWICKLUNG.md) · [`../CLAUDE.md`](../CLAUDE.md)
