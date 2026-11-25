# Änderungen – Rezeption Schichtcheck

Version = `version` in `mac/package.json`. Neueste zuerst. Neue Einträge oben anfügen.

## 1.27.9 – 25.11.2026
- Feierabend- und Anmeldebildschirm zeigen oben links das padel-amigos-Logo groß (statt „Rezeption“), rechts Uhrzeit mit Datum darunter.

## 1.27.8 – 25.11.2026
- Das Zeichen ↶ („letzten Eintrag zurücknehmen“) ist überall entfernt – bei Rundgängen im Erinnerungs-Bereich und in der Liste an anderen Tagen. Pflicht-Punkte nimmt man über den Haken zurück.

## 1.27.7 – 25.11.2026
- Fehler behoben: Als „Wichtig“ markierte Punkte bekamen im Aufgaben-Plan eine Leerzeile davor (CSS-Regel des Dienstplan-Imports griff auch dort).
- Mehr Abstand zwischen Zeitstrahl und Karten im Tagesablauf.
- Jetzt-Linie durchgehend in Blau statt gestrichelt.

## 1.27.6 – 25.11.2026
- Leiste „Den ganzen Tag“: Der Zähler hat gleich breite Ziffern – beim Abhaken verrutschen die Felder nicht mehr.

## 1.27.5 – 25.11.2026
- Mitlaufende Uhrzeit dezenter: Vergangenes im Tagesablauf leicht getönt, gestrichelte graublaue Linie hinter den Karten, Uhrzeit in einer graublauen Marke, Punkt mit hellem Ring auf der Zeitlinie (statt schwarzem Strich).

## 1.27.4 – 25.11.2026
- Der Fortschrittsbalken („0/18“) im Kopf des Fahrplans entfällt heute. Im Rückblick auf andere Tage bleibt „n/m erledigt“ stehen.

## 1.27.3 – 25.11.2026
- Leiste „Den ganzen Tag“: Bestätigen und Zurücknehmen über denselben Haken. Das Zeichen ↶ rechts entfällt.

## 1.27.2 – 25.11.2026
- Heute zeigt der Fahrplan nicht mehr an, wie viele Aufgaben die andere Schicht offen gelassen hat (Feld „Früh: n offen“ und rote Leiste für die Leitung entfallen). Im Rückblick auf vergangene Tage bleibt der Hinweis.

## 1.27.1 – 25.11.2026
- Liegen Erinnerungen oder Rundgänge dicht beieinander, zeigt die Zeitlinie nur noch eine Glocke mit einer Linie und der Anzahl statt mehrerer Linien untereinander.
- Pflicht-Punkte („Den ganzen Tag“) stehen als Leiste oben im Fahrplan und sind die ganze Schicht sichtbar: offen neutral, in den letzten 30 Min. orange, nach „Zurück zur Schicht“ rot, bestätigt grün (↶ nimmt zurück), „ab …“ gestrichelt. Der Kasten vor Schluss entfällt.

## 1.27.0 – 25.11.2026
- Schicht heute ohne rechte Spalte: Der Fahrplan nutzt die volle Breite, alles steht nach Uhrzeit im Tagesablauf.
- Rundgänge im Takt stehen grün im Erinnerungs-Bereich mit ihrer nächsten Uhrzeit (Kreislauf-Zeichen auf der Zeitlinie). Abhaken trägt ein und rückt die Karte zur nächsten Zeit, ↶ nimmt den letzten Eintrag zurück; fällig orange, überfällig rot.
- Pflicht vor Schichtende steht als Kasten 30 Min. vor Schluss im Tagesablauf.
- Hinweise („Im Blick behalten“) hinter dem Knopf „ⓘ n Hinweise“ im Kopf des Fahrplans.
- Übergabe unten rechts im Fahrplan: „Übergabe von Früh/Spät“ öffnet die Nachricht jederzeit wieder (mit „neu“, solange ungelesen), daneben „Übergabe schreiben“ bzw. „bearbeiten“. Die Leiste oben verschwindet nach „Gelesen“. Die Zeile „Dienst Früh/Spät“ entfällt.
- Andere Tage behalten die bisherige Ansicht mit rechter Spalte.

## 1.26.2 – 25.11.2026
- Oben links steht das ganze padel-amigos-Logo mit Schriftzug (Graublau). In schmalen Fenstern unter 1100 px nur das Zeichen, damit die Kopfzeile in eine Zeile passt.

## 1.26.1 – 25.11.2026
- Eigene Erinnerungen lassen sich ändern: Antippen des Textes im Erinnerungs-Bereich öffnet „Erinnerung ändern“ mit Text und Uhrzeit. Ändern darf, wer sie angelegt hat, oder die Leitung – wie beim Löschen.

## 1.26.0 – 25.11.2026
- Kopfzeile neu: Oben links steht das padel-amigos-Zeichen in Graublau statt des Schriftzugs „Rezeption“. Wochentag und Datum stehen klein unter der Uhrzeit.
- Tag wechseln: Klick auf das Datum öffnet einen eigenen Monatskalender direkt darunter (Gestern/Heute als Schnellwahl, Esc oder Klick daneben schließt). Das bisherige Kalender-Symbol und das System-Datumsfeld, das auf dem Mac an falscher Stelle aufging, sind entfernt.
- Anderer Tag: Datum orange, unten an der Leiste eine orange Kante, daneben ‹ › und „↩ Heute“. Heute bleiben Pfeile und Knopf ausgeblendet.
- Schriftgröße und Verwaltung stehen direkt neben den Reitern, die Namen rechts. Unter 1100 px Fensterbreite heißen die Reiter „Plan“ und „Zeiten“.
- Neben der Uhrzeit steht nicht mehr „Spät bis …“.

## 1.25.1 – 25.11.2026
- Das Schrift-Symbol bleibt neutral, auch wenn die Schriftgröße nicht 100 % ist. Blau ist es nur, solange das Regler-Fenster offen ist.

## 1.25.0 – 25.11.2026
- Schriftgröße stufenlos: Das Schrift-Symbol oben rechts öffnet ein Fenster mit Schieberegler von 80 % bis 160 % (dazu „A“-Knöpfe für 5 % kleiner/größer und „Zurück auf 100 %“). Text, Haken, Knöpfe und Abstände wachsen gemeinsam. Gilt pro Person; die alte Einstellung „groß“ wird zu 115 %.
- Lange Abschnitts-Namen brechen um, statt die Markierung „überfällig“ zu überdecken.

## 1.24.3 – 25.11.2026
- Erledigte eigene Erinnerungen sind im Erinnerungs-Bereich rechts zunächst ausgeblendet. Der Knopf „✓ n erledigte“ im Kopf des Bereichs zeigt sie, „erledigte ausblenden“ versteckt sie wieder.

## 1.24.2 – 25.11.2026
- Erledigte eigene Erinnerungen bleiben im Erinnerungs-Bereich rechts an ihrer Uhrzeit stehen – abgehakt, grau und durchgestrichen, Glocke grau. Haken antippen öffnet sie wieder. Die Zeile „✓ … erledigt“ links zählt nur noch Abschnitte.

## 1.24.1 – 25.11.2026
- Fehler behoben: „Neue Erinnerung“ zeigte beim zweiten Öffnen den Text der vorigen Erinnerung. Das Feld ist jetzt immer leer.
- Aufgaben-Plan: Im Fenster „Abschnitt bearbeiten“ lässt sich die Schicht wählen – der Abschnitt wandert samt Aufgaben von Früh nach Spät oder umgekehrt.
- Aufgaben-Plan: Abschnitte lassen sich ausblenden. Sie bleiben im Plan (durchgestrichen, „ausgeblendet“), erscheinen aber nicht im Fahrplan und zählen nicht zum Fortschritt.

## 1.24.0 – 25.11.2026
- Erinnerungen haben im Tagesablauf einen eigenen Bereich rechts neben den Abschnitten. Jede steht genau auf der Höhe ihrer Uhrzeit – nach derselben Rechnung wie die mitlaufende Uhrzeit. Links auf der Zeitlinie sitzt eine Glocke, eine gepunktete Linie verbindet beides. Erreicht die Uhrzeit-Marke die Glocke, ist die Erinnerung fällig.
- Gilt für eigene Erinnerungen (mit Haken und ×) und für Aufgaben mit Uhrzeit aus dem Plan (gestrichelter Rahmen, antippen springt zur Aufgabe).
- Die gestrichelte Trennlinie zwischen Abschnitten und Erinnerungen lässt sich nach links und rechts ziehen (auch Pfeiltasten); die Breite gilt pro Person, Doppelklick stellt den Standard wieder her.
- Erinnerungen stehen nicht mehr in den Abschnitten.

## 1.23.1 – 25.11.2026
- Eigene Erinnerungen, die in die Zeit eines offenen Abschnitts fallen, stehen in diesem Abschnitt (nach den offenen Aufgaben). Bei einem zugeklappten späteren Abschnitt zählt die Zeile mit („· 1 Erinnerung“).
- Ist der Abschnitt erledigt und zugeklappt, bleibt eine offene Erinnerung als eigene Zeile an ihrer Uhrzeit stehen.
- Fehler behoben: An vergangenen Tagen brach der Fahrplan ab (Skriptfehler); die mitlaufende Uhrzeit landete fälschlich in der Erledigt-Zeile.

## 1.23.0 – 25.11.2026
- Eigene Erinnerungen stehen heute direkt im Tagesablauf an ihrer Uhrzeit – mit Haken und Löschen (×). Fällige haben einen orangen Punkt. Erledigte wandern in die Zeile „✓ … erledigt“ (z. B. „1 Abschnitt · 2 Erinnerungen erledigt“) und erscheinen beim Aufklappen.
- Der eigene Bereich „Eigene Erinnerungen“ unten im Fahrplan entfällt für heute; an anderen Tagen bleibt er.

## 1.22.9 – 25.11.2026
- Beginn/Schluss geändert: Es steht nur noch „geändert von Name“ (mit Grund), ohne Uhrzeit – im Tagesablauf und im Fenster „… heute ändern“.

## 1.22.8 – 25.11.2026
- Übergabe: Der Name steht als Unterschrift („– Name“) direkt unter der Nachricht – in der Karte, im Fenster nach dem Einchecken und in der Leiste über dem Fahrplan. Keine Uhrzeit mehr, auch nicht bei „Gelesen“.
- Feierabend-Bildschirm ohne „Ausgecheckt um … – du kannst den Laptop jetzt zuklappen.“

## 1.22.7 – 25.11.2026
- Zusammengeklappte Zeile „✓ n Abschnitte erledigt“ ohne Aufzählung der Abschnittsnamen.

## 1.22.6 – 25.11.2026
- Keine Uhrzeit mehr beim Abhaken: Aufgaben, Pflichtpunkte und eigene Erinnerungen zeigen nur noch „erledigt · Name“ bzw. „bestätigt · Name“. Die Zeit wird weiter intern gespeichert (z. B. für den Rundgang-Takt), aber nicht angezeigt.
- Rundgänge zeigen „zuletzt HH:MM“ und „nächster um HH:MM“, ohne Namen – als Orientierung für die Person an der Rezeption.

## 1.22.5 – 25.11.2026
- Monatsstatistik: Wer einen Tag öffnet, sieht oben „‹ Zurück zur Monatsstatistik“ und kommt mit einem Klick zurück (statt über die Verwaltung).
- Der Hinweis „Stand vom Tag“ neben dem Datum vergangener Tage entfällt. Die Funktion bleibt: Vergangene Tage zeigen weiter den Plan, der an dem Tag galt.

## 1.22.4 – 25.11.2026
- Knopf für die Schriftgröße als Liniensymbol (großes und kleines A) im Stil von Kalender und Zahnrad statt Text „AA“.

## 1.22.3 – 25.11.2026
- Verwaltung ist ein Zahnrad-Knopf neben Kalender und Schriftgröße (statt Reiter mit Text). Aktiv blau; der rote Punkt bei überfälliger Sicherung sitzt am Zahnrad.

## 1.22.2 – 25.11.2026
- Kopfzeile: „Auschecken“ sitzt wie im Mockup im Namens-Chip der aktiven Person (Name · Rolle | Auschecken), kein eigener roter Knopf mehr.
- Kein Sicherungs-Text mehr oben rechts („Noch keine Sicherung …“). Ist die Sicherung wirklich überfällig (Ordner fehlt oder 7+ Tage alt), zeigt ein roter Punkt am Reiter Verwaltung das an; Details unter Verwaltung › Datensicherung.

## 1.22.1 – 25.11.2026
- Die aktuelle Uhrzeit läuft links stufenlos am Tagesablauf entlang: Liegt jetzt innerhalb eines Abschnitts, steht sie anteilig darin (z. B. ein Viertel tief bei 18:45 in 18:30–19:30), sonst anteilig in der Lücke zur nächsten Zeile. So ist sofort zu sehen, ob man im Zeitrahmen liegt.

## 1.22.0 – 25.11.2026
- Fahrplan als Tagesablauf: Uhrzeit links, Punkt auf einer senkrechten Linie, schwarze Jetzt-Linie zwischen Vergangenem und Kommendem. Die Leiste „Jetzt“ mit dem waagerechten Zeitstrahl und die Kacheln Danach · Später · Erledigt sind entfernt – mehr Platz für den Fahrplan.
- Beginn und Schluss sind die erste und letzte Zeile, „ändern“ direkt dort. Sonnenuntergang und kommende Erinnerungen stehen an ihrer Uhrzeit.
- Erledigtes klappt zu einer grünen Zeile „✓ n Abschnitte erledigt“ zusammen; antippen zeigt die Abschnitte klein.
- Der nächste Abschnitt öffnet sich 15 Minuten vor Beginn von selbst.
- Fortschritt als schmaler Balken in der Kopfzeile des Fahrplans, daneben „Früh/Spät: n offen“. Überfällige Abschnitte heißen „überfällig“.

## 1.21.1 – 25.11.2026
- Farben: Der laufende Abschnitt ist grün, solange Zeit ist. Orange („knapp“) erst in den letzten 15 Minuten bis zum Ablauf des Puffers, danach rot (überfällig). Gilt für Fahrplan, Zeitstrahl und Jetzt-Leiste.
- Aufgaben-Plan: Abschnitte in Stunden und halben Stunden statt Minuten (z. B. „1,5–0,5 Std. vor Schluss“), auch am Sonnenuntergang. Erinnerungen bleiben in Minuten.
- Kacheln unter dem Fahrplan: „Danach · Später · Erledigt“ – Erledigt steht rechts.
- Erste Version, die als Update-Datei kommt (`Rezeption-1.21.1.rzupdate`, braucht installierte 1.21.0).

## 1.21.0 – 25.11.2026
- Updates ohne Neuinstallation: Verwaltung › System › **App-Update** › „Update-Datei wählen“ spielt eine Datei `Rezeption-x.y.z.rzupdate` ein (etwa 1 MB). Die App prüft die digitale Unterschrift, nimmt nur neuere Versionen an und lädt neu. Daten bleiben unverändert. Notausgang: Menü Ansicht › „Eingespieltes Update entfernen“. Diese Version muss einmal per ZIP installiert werden.
- Sonnenuntergang als Bezug: Abschnitte („von 15 Min. vor bis 30 Min. nach Sonnenuntergang“), Erinnerungen an Aufgaben und Pflichtpunkte („10 Min. vor Sonnenuntergang“, „zum Sonnenuntergang“) wandern jeden Tag mit. Abschnitte am Sonnenuntergang verlängern die Schicht nicht.

## 1.20.0 – 24.11.2026
- Flexible Zeiten: Abschnitte richten sich nach **Beginn** („0–30 Min. nach Beginn“) oder **Schluss** („90–60 Min. vor Schluss“). Nur „Licht aus“ behält eine feste Uhrzeit. Bestehende Pläne stellen sich ohne Zutun um: vordere Abschnitte hängen an Beginn, hintere an Schluss.
- Beginn = Einchecken der Früh-/Spätschicht, Schluss = Dienstplan bzw. Plan. Beides lässt sich heute in der Jetzt-Leiste ändern („ändern“, Schnellknöpfe −30/−15/+15/+30, optionaler Grund) – von jeder eingecheckten Person, mit Name und Uhrzeit festgehalten. Abbau, Abschließen, Erinnerungen und „Noch da?“ ziehen mit.
- Alle Zeiten sind Richtwerte („ca.“). Rot erst 15 Min. nach der Zeit; der Puffer ist unter Verwaltung › Zeiten & Sonnenuntergang einstellbar.
- Erinnerungen an Aufgaben und Pflichtpunkten: „mit dem Abschnitt“, „x Min. nach Beginn“, „x Min. vor Schluss“ oder feste Uhrzeit.
- Sonnenuntergang (ohne Internet berechnet, Standort Halstenbek, änderbar): in der Jetzt-Leiste, als Sonne im Zeitstrahl und als Schnellknopf „zum Sonnenuntergang“ in „Neue Erinnerung“.
- Aufgaben-Plan: jeder Abschnitt zeigt „nach Beginn“, „vor Schluss“ oder „feste Uhrzeit“; im Fenster „Richtet sich nach“ mit Minutenfeldern.

## 1.19.0 – 24.11.2026
- Neue Übersicht in der Schicht-Ansicht: Jetzt-Leiste mit Fortschrittsring, „Jetzt: … bis …“ und antippbaren Hinweisen (offene Aufgaben, Überfälliges, fällige Rundgänge, nächste Erinnerung, Übergabe gelesen, andere Schicht). Darunter ein Zeitstrahl der ganzen Schicht mit Jetzt-Markierung und Glocken für Erinnerungen.
- Fahrplan: groß nur der laufende (und überfällige) Abschnitt, der Rest als Kacheln „Danach“, „Erledigt“, „Später“. Ist gerade nichts dran: „Alles erledigt bis … – als Nächstes …“. Erledigtes rutscht im Abschnitt nach unten.
- Rechts „Als Nächstes“: Rundgänge und Aufgaben-Erinnerungen nach Uhrzeit, darunter „Pflicht vor Schichtende · x von y“.
- Feste Farben: Rot nur für Überfälliges, Gelb für jetzt dran und Erinnerungen, Grau für später, Grün für erledigt. Offene Pflichtpunkte sind erst in den letzten 30 Minuten gelb. „Andere Schicht offen geblieben“ ist ein kleiner Hinweis; die rote Leiste sieht nur die entsperrte Leitung.
- Kopfzeile ruhiger: Datum hinter dem Kalender-Knopf, Statuszeile nur bei Problemen. Neuer Knopf für große Schrift, gespeichert pro Person.
- Fehler behoben: Aufgaben-Plan – neue Aufgabe mit Enter war unsichtbar und ließ sich doppelt anlegen. Einchecken – Grund und „Nicht nachtragen“ verschwanden beim Wechsel von Rolle oder Zeit. Leitungsbereich sperrte sich nach 10 Minuten auch während der Eingabe; jetzt zählt jede Aktion, und offene Eingaben überstehen die PIN-Abfrage. Arbeitszeiten-Korrektur speichert mit Enter.
- Grundsätzlich: Jedes Fenster merkt sich Eingaben beim Neuzeichnen, Enter speichert überall. Neuer Test `tools/test-fenster.cjs`.
- SharePoint komplett entfernt (Webpart, Speicher-Anbindung, Test-Nachbau).

## 1.18.6 – 23.11.2026
- Neue Erinnerung: Enter speichert und schließt das Fenster (vorher blieb es offen und die Erinnerung erschien erst nach „Speichern“). Gleiches im Aufgaben-Plan-Fenster. Hinweistext im Fenster entfernt.

## 1.18.5 – 23.11.2026
- Eigene Erinnerungen: Erledigte verschwinden aus der Liste, offene bleiben oben. „n erledigte anzeigen“ blendet sie bei Bedarf darunter wieder ein.

## 1.18.4 – 23.11.2026
- Fehler behoben: Die erste eigene Erinnerung nach dem Start ging beim Speichern verloren (Fenster leer, nichts gespeichert). Ursache: Ein aufgeschobenes Neuzeichnen ersetzte das Fenster zwischen Drücken und Loslassen von „Speichern“. Neuzeichnen wartet jetzt, bis die Maus losgelassen ist; Eingaben im Fenster bleiben auch beim Neuzeichnen erhalten.

## 1.18.3 – 23.11.2026
- „Eigene Erinnerungen“ ist ein eigener Bereich unten in der Fahrplan-Karte: erscheint nur, wenn es Erinnerungen gibt, wächst mit dem Inhalt nach oben (höchstens knapp die halbe Karte, darüber scrollt die Liste) und lässt sich an der Trennlinie in der Höhe ziehen (pro Person gespeichert, Doppelklick = wieder automatisch).

## 1.18.2 – 23.11.2026
- Eigene Erinnerungen stehen gesammelt in einem eigenen Abschnitt „Eigene Erinnerungen“ unter dem Fahrplan (nur wenn welche da sind), nicht mehr in den Abschnitten des Plans. Sind alle erledigt, klappt der Abschnitt zu.

## 1.18.1 – 23.11.2026
- Fahrplan: Ist ein Abschnitt komplett (erledigt oder „entfällt“), klappt er zu – auch wenn er vorher von Hand aufgeklappt wurde.

## 1.18.0 – 18.11.2026
- Eigene Erinnerungen: „+ Erinnerung“ im Fahrplan (Text und Uhrzeit, gilt nur heute). Sie stehen im passenden Abschnitt, öffnen zur Uhrzeit ein Fenster und zählen nicht zum Fortschritt.
- Immer im Blick: Bestätigte Pflichtpunkte bleiben sichtbar (grau mit Uhrzeit und Name). Pflichtpunkte können „fällig ab“ einer Uhrzeit sein – früher Bestätigtes steht ab dann wieder offen (z. B. Laptop und Handy laden). Pflichtpunkte bekommen Erinnerungen zur Uhrzeit (Mo–Fr / Sa+So, nur wenn offen oder immer), Rundgänge auf Wunsch ein Fenster, sobald sie überfällig sind.
- Erinnerungen holen die Mac-App nach vorn (auch aus dem Dock) und spielen einen kurzen Ton; abschaltbar unter Verwaltung › Ton bei Erinnerungen. Die Webversion lässt nur den Titel blinken.
- „Noch da?“: 30 Minuten nach dem geplanten Schichtende fragt die App die eingecheckte Früh- oder Spätschicht, ob sie auschecken möchte.
- Vergessenes Auschecken trägt man beim nächsten Einchecken selbst nach (Ende, Pause, Grund) oder überlässt es der Leitung. Der Eintrag steht in den Arbeitszeiten als „nachgetragen“.
- Dienstplan und Arbeitszeiten im gleichen Rahmen: Monat mit Pfeilen, „Heute“, Personenwahl, Aktionen rechts; Früh/Spät als Farbmarke. In den Arbeitszeiten stehen eingeplante Tage ohne Eintrag gelb.
- Reiter „Zeiten“ heißt „Arbeitszeiten“; der Reiter „Schicht“ zeigt keine Zahl mehr.
- Verwaltung in drei Spalten nebeneinander.
- Check-ins ausgebaut (kein Reiter, kein Schalter, keine Knöpfe); Check-in-Aufgaben werden einmalig aus dem Aufgaben-Plan genommen. Code und Check-in-Daten bleiben erhalten (`CHECKINS_ENABLED`).

## 1.17.0 – 04.11.2026
- Sicherungen verschlüsseln (einschaltbar unter Verwaltung › Datensicherung): Passwort der Leitung plus einmal angezeigter Wiederherstellungscode. Die automatische Sicherung läuft weiter ohne Eingabe; beim Einspielen fragt die App nach Passwort oder Code. Unverschlüsselte Sicherungen lassen sich weiter einspielen.
- Alte Daten löschen nach dem Löschkonzept (Verwaltung › System): Protokoll und Übergaben nach 3 Monaten, Dienstplan nach 1 Jahr, Arbeitszeiten 2 Jahre nach Jahresende – mit Anzeige, was fällig ist, Bestätigung und Nachweis. Check-in-Fortschritt wird nach 3 Monaten automatisch entfernt.
- Leitungs-PIN sicherer gespeichert (gesalzen, langsamer Hash; Umstellung beim nächsten Entsperren) und nach 5 Fehlversuchen kurz gesperrt.

## 1.16.0 – 04.11.2026
- Erinnerungen „zur Sicherheit“: Pro Aufgabe wählbar, ob die Erinnerung nur bei offener Aufgabe kommt oder immer – dann auch, wenn sie schon erledigt ist („Schon erledigt … – bitte kurz kontrollieren“, Knopf „Kontrolliert“). Im Aufgaben-Plan steht dann „· immer“ an der Glocke.

## 1.15.0 – 03.11.2026
- Check-ins neu gegliedert: Ablauf in drei Schritten (Dateien laden · Prüfen · Wallet buchen), jeder Schritt zeigt seinen Stand. Nach „Prüfen“ geht es automatisch weiter. „Wird erstattet“ und „Keine Erstattung“ sind eingeklappt, solange noch etwas zu entscheiden ist. Regeln & Preise und Hansefit-Liste liegen hinter „Einstellungen“.

## 1.14.0 – 02.11.2026
- Verwaltung übersichtlich: eine Liste in drei Gruppen (Planung, Auswertung, System), jede Zeile mit Status (z. B. Aufgaben pro Schicht, eingeteilte Tage, letzte Sicherung, PIN aktiv). Team, Datensicherung und Leitungs-PIN öffnen ein Fenster; „Arbeitszeiten aller“ führt direkt zu Korrektur und Export.

## 1.13.0 – 02.11.2026
- Auschecken mit offenen Punkten geht jetzt für alle – aber nur mit Grund. Der Grund steht in den Zeiten (Notiz-Spalte und Export) als „Offen gelassen (n): …“.
- Wer als Früh- oder Spätschicht eingecheckt ist, sieht nur die eigene Schicht; der Umschalter Früh/Spät entfällt dann.
- Aufgaben-Plan: Beim Öffnen ist der erste Abschnitt aufgeklappt.
- Beispieltexte in Eingabefeldern allgemein gehalten (keine Namen oder Einzelfälle); „Check-ins“ ohne Zusatz.

## 1.12.0 – 02.11.2026
- Übersicht: Der Fahrplan ist einspaltig; aufgeklappt sind nur der laufende und überfällige Abschnitte, erledigte und spätere stehen als eine Zeile zum Aufklappen. Rechts sind nur fällige Rundgänge und offene Pflicht-Punkte sichtbar, der Rest steckt in aufklappbaren Zeilen. Die Spalten-Umschaltung (Auto/1/2) entfällt.
- Eigene Übergabe wird im Fenster geschrieben (mit „Wichtig“), in der Karte steht nur noch die Vorschau.
- Aufgaben-Plan neu: ein Plan für alle Tage mit getrennten Uhrzeiten für Mo–Fr und Sa+So. Neue Aufgaben in einer Zeile (Enter), Bearbeiten und Löschen im Fenster, Sortieren per Ziehen, Änderungen gelten sofort (kein Speichern-Knopf). Bisherige Vorlagen werden beim ersten Bearbeiten zusammengeführt.
- Erinnerungs-Popups: Jede Aufgabe kann zu einer Uhrzeit (Mo–Fr und Sa+So getrennt) ein Fenster öffnen, solange sie offen ist – mit „Erledigt“ und „In 10 Minuten erinnern“.

## 1.11.0 – 02.11.2026
- Vergangene Tage behalten ihren Stand: Jeder Tag hält beim ersten Eintrag seinen Plan fest (`snap`). Spätere Änderungen am Aufgaben-Plan verändern Aufgaben und Prozente vergangener Tage nicht mehr. Bestehende Tage mit Einträgen werden beim ersten Start einmalig mit dem dann gültigen Plan festgehalten.
- Auschecken als Früh- oder Spätschicht erst, wenn die Schicht bei 100 % ist (Aufgaben und Pflicht-Bestätigungen, egal wer sie erledigt hat). Das Fenster listet die offenen Punkte zum direkten Abhaken; „Zurück zur Schicht“ markiert sie rot im Fahrplan. Keine Ausnahme.
- Übergabe: erscheint nach jedem Einchecken als Fenster – auch ohne Übergabe (Hinweis „Keine Übergabe hinterlassen“) – mit optionaler Rückmeldung. Bis „Gelesen“ steht sie als Leiste über dem Fahrplan. Die Namensauswahl zeigt keine Übergabe-Hinweise mehr.
- Kopfzeile größer (Name, Uhr, Reiter, Anwesende, Auschecken).
- Check-ins sind standardmäßig ausgeschaltet; Verwaltung › Funktionen schaltet sie wieder ein (Daten bleiben erhalten).

## 1.10.0 – 02.11.2026
- Zeiten: Ist eine Leitungs-PIN festgelegt, sieht jede Person nur ihre eigenen Zeiten (die gerade eingecheckte Person); die Zeiten anderer nur die Leitung. Ohne PIN bleibt die Namenswahl.
- Datenschutz: Schriften (Barlow, Barlow Condensed) lokal eingebettet statt von Google Fonts geladen. SheetJS nur noch lokal (kein cdnjs), pdf.js nur noch im SharePoint-Betrieb von jsDelivr. Mac-App und Webversion rufen damit keine fremden Server mehr ab.
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
