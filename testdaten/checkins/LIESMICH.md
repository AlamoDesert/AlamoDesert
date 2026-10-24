# Testdaten für den Reiter „Check-ins“

Alle Namen und E-Mail-Adressen sind erfunden. Prüftag: **Freitag, 23.10.2026**.

## So testest du

1. Reiter **Check-ins** › **Hansefit-Liste** › Datei `hansefit-liste.csv` wählen.
2. **1 · Tagesprüfung** › Playtomic-Export: `playtomic-export_2026-10-23.csv` wählen.
3. Den Inhalt der vier Textdateien in die passenden Felder kopieren:
   `1-usc.txt` → Urban Sports Club, `2-wellpass.txt` → Wellpass, `3-wellhub.txt` → Wellhub, `4-hansefit.txt` → Hansefit.
4. **Prüfen** tippen.

## Erwartetes Ergebnis (Standard-Regeln)

16 Check-ins: **7 Erstatten · 5 Prüfen · 4 Keine**, Buchungsliste **58,00 €**.

| Anbieter | Name | Ergebnis | Betrag | Warum |
|---|---|---|---|---|
| USC | Max Mustermann | Erstatten | 9,00 € | normale Padel-Buchung, Festbetrag |
| Wellpass | Erika Beispiel | Erstatten | 7,50 € | Platzanteil Indoor Off-Peak 30 €/h ÷ 4 |
| USC | Anton Meier | Erstatten | 9,00 € | in Playtomic „Toni M.“ – Treffer über die E-Mail |
| USC | Greta Griff | Erstatten | 5,00 € | Privatunterricht |
| Wellhub | Sophie Schmetterball | Erstatten | 9,00 € | Platzanteil Outdoor Peak 36 €/h ÷ 4 |
| Hansefit | Paul Volley (ID 26DZT9EB) | Erstatten | 9,50 € | Name kommt aus der Hansefit-Liste |
| USC | Nina Netz | Erstatten | 9,00 € | Event „Afterwork Padel“, Preis geschätzt |
| USC | Jonas Wand | Prüfen | 18,00 € | Squash: Regel verlangt Prüfung, Faktor ×2 |
| Wellpass | Katharina Schmidt | Prüfen | 7,50 € | in Playtomic „Katharina Schmid“ – nur ähnlich |
| USC | Hannes Aufschlag | Prüfen | – | Tennis: keine Regel hinterlegt |
| Hansefit | ID 24XQ7K2P | Prüfen | – | ID fehlt in der Hansefit-Liste → „Name zuordnen“ |
| Wellhub | Rita Rückhand | Prüfen | 10,50 € | Zahlung in Playtomic noch offen |
| USC | Clara Ecke | Keine | – | Squash: nur der Bucher bekommt die Gutschrift |
| USC | Felix Allein | Keine | – | allein gebucht, kein Splitpayment |
| USC | Otto Storno | Keine | – | Buchung storniert, zählt nicht („Keine Buchung …“) |
| USC | Unbekannt Gast | Keine | – | keine Buchung am Prüftag |

Danach lohnt es sich, unter **2 · Wallet buchen** die Buchungsliste durchzuklicken und eine „Prüfen“-Zeile freizugeben.
