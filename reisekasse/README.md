# Reisekasse

Web-App (PWA, kein Build) zum Erfassen und Aufteilen von Urlaubskosten. Zugang per Link ohne Konto, Bon-Scan auf dem Gerät (Tesseract), mehrere Währungen, Ausgleich mit möglichst wenigen Überweisungen inkl. PayPal.me-Link und GiroCode.

## Aufbau
- `public/engine.js` – reine Rechenlogik (Beträge als Ganzzahlen in Cent, Aufteilung per Größter-Rest-Verfahren, Salden, Ausgleich, Bon-Auswertung `parseReceipt`, GiroCode `epcPayload`, CSV-Export).
- `public/app.js` – Oberfläche, lokaler Speicher (`localStorage` `reisekasse.v1`, Bons in IndexedDB), Warteschlange für Änderungen (offline nutzbar), Abgleich alle 15 s, Texterkennung.
- `server/core.mts` – API `/api/*` mit austauschbarem Speicher; `server/d1-store.mts` (Cloudflare D1), `server/memory-store.mjs` (lokal/Tests).
- `functions/api/[[path]].ts` – Cloudflare-Pages-Anbindung (Binding `DB`).

## Zugriff
Neue Reise → Server erzeugt `id` + Schlüssel (gespeichert nur als SHA-256). Einladungslink `#/j/<id>/<schlüssel>` (Schlüssel im Fragment, nie in Server-Logs). Alle Mitreisenden dürfen alles ändern; jede Änderung landet mit altem und neuem Stand im Protokoll und lässt sich wiederherstellen. Positionen eines Bons ordnet sich jede Person selbst zu („Meins“, atomar per CAS auf dem Server).

## Aufteilung
- **Gleich**: nach Gewicht der Personen (z. B. Kind ×0,5) auf die gewählten Personen.
- **Beträge**: feste Beträge pro Person, Summe muss stimmen.
- **Positionen**: zugeordnete Positionen zu gleichen Teilen auf ihre Personen, Rest (offene Positionen, Trinkgeld) nach Gewicht auf die gewählten Personen.
- Fremdwährung: Kurs pro Ausgabe (EZB-Kurs vom Tag über frankfurter.dev oder von Hand), Anteile werden so umgerechnet, dass die Summe exakt stimmt.

## Lokal
```
npm run vendor   # Tesseract nach public/vendor/tesseract/ (~16 MB, nicht committet)
npm test         # Engine + API (Speicher im Arbeitsspeicher und D1-Nachbau auf node:sqlite)
npm run dev      # http://localhost:8892 mit Speicher im Arbeitsspeicher
```

## Veröffentlichen (Cloudflare Pages + D1)
Einmalig: `npx wrangler@4 d1 create reisekasse` → `database_id` in `wrangler.toml` eintragen; Pages-Projekt `reisekasse` anlegen und das D1-Binding `DB` setzen; eigene Domain `kosten.domenic-boe.de` (CNAME → `reisekasse.pages.dev`). Die Tabellen legt die Funktion beim ersten Aufruf selbst an (`schema.sql` zum Nachlesen).
Danach: `npm run deploy` (lädt Tesseract und veröffentlicht mit `--branch main`). Der Token braucht dafür zusätzlich **D1: Edit**.

## Lizenzen
tesseract.js / tesseract.js-core / Sprachdaten: Apache-2.0. QR-Code-Generator (`vendor/qrcode.js`): MIT, Kazuhiko Arase.
