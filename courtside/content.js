/* Courtside – Texte zu Modi und Regeln. Reiner Inhalt, keine Logik. */
window.CONTENT = {
  sports: {
    padel: {
      name: 'Padel',
      rules: [
        ['Zählweise', '15, 30, 40, Spiel – wie im Tennis. Ein Satz geht bis 6 Spiele mit Tiebreak bei 6:6. Statt eines dritten Satzes spielen Turniere oft einen Match-Tiebreak bis 10 (2 Punkte Vorsprung).'],
        ['Star Point', 'Seit 2026 Standard bei FIP und Premier Padel: Beim ersten und zweiten Einstand wird mit Vorteil gespielt. Kommt es ein drittes Mal zum Einstand, entscheidet ein einziger Punkt.'],
        ['Goldener Punkt', 'Im Clubbetrieb weiter verbreitet: Bei 40:40 entscheidet der nächste Punkt. Das rückschlagende Team wählt die Seite.'],
        ['Aufschlag', 'Von unten, Ball unterhalb der Hüfte treffen, vorher einmal aufprallen lassen, diagonal ins Aufschlagfeld.'],
        ['Wände', 'Glas und Gitter sind im Spiel, sobald der Ball vorher im eigenen Feld aufgesprungen ist.']
      ]
    },
    pickleball: {
      name: 'Pickleball',
      rules: [
        ['Zählweise', 'Standard bei USA Pickleball: Spiel bis 11 mit 2 Punkten Vorsprung, nur das aufschlagende Team punktet (Side-out). Im Doppel wird der Spielstand mit drei Zahlen angesagt, z. B. „4–2–1“.'],
        ['Rally Scoring', '2026 als vorläufige Option erlaubt: Jeder Ballwechsel zählt, Spiele bis 11, 15 oder 21. Über die Zukunft entscheidet USA Pickleball 2027.'],
        ['Two-Bounce-Regel', 'Aufschlag und Return müssen je einmal aufspringen. Erst danach sind Volleys erlaubt.'],
        ['Kitchen', 'In der Non-Volley-Zone (2,13 m vor dem Netz) darf kein Volley gespielt werden.']
      ]
    },
    tennis: {
      name: 'Tennis',
      rules: [
        ['Fast4', 'Tennis Australia: Sätze bis 4, No-Ad, Tiebreak bei 3:3 bis 5 Punkte, kein Let beim Aufschlag. Die LTA spielt eine Variante mit Let und Tiebreak bis 7.'],
        ['Match-Tiebreak', 'ITF-Regeln: Ein Tiebreak bis 10 mit 2 Punkten Vorsprung kann den Entscheidungssatz ersetzen.'],
        ['No-Ad', 'Bei Einstand entscheidet ein Punkt. Das rückschlagende Team wählt die Seite.'],
        ['Pro-Satz', 'Ein langer Satz bis 8 Spiele mit 2 Spielen Vorsprung. Den Tiebreak bei 8:8 vorher absprechen.']
      ]
    }
  },

  // tag: kurz für Listen. best: für welche Sportarten besonders typisch.
  modes: {
    americano: {
      name: 'Americano', icon: 'shuffle', tag: 'Jede Runde neue Partner, die Punkte zählen für dich allein.',
      best: ['padel', 'pickleball'], who: '8, 12 oder 16 Personen ideal, sonst mit Pausen', time: '90–150 min',
      about: 'Der Klassiker im Padel-Sozialturnier. Du spielst jede Runde mit jemand anderem zusammen und gegen andere Gegner. Gespielt wird auf eine feste Gesamtpunktzahl, etwa 24. Beide im Team bekommen die erzielten Punkte gutgeschrieben. Am Ende gewinnt, wer insgesamt die meisten Punkte gesammelt hat.',
      steps: [
        'Namen eintragen und Anzahl der Plätze wählen.',
        'Die App lost alle Runden aus. Bei 8, 12 oder 16 Personen spielt jede Person genau einmal mit jeder anderen.',
        'Gespielt wird, bis die Gesamtpunktzahl erreicht ist, zum Beispiel 15:9 bei 24 Punkten.',
        'Ergebnis eintragen: ein Tipp auf die Punkte eines Teams genügt, den Rest rechnet die App.',
        'Nach der letzten Runde steht die Einzelwertung fest.'
      ],
      scoring: 'Summe der eigenen Punkte. Bei Gleichstand zählen Siege, dann die Differenz. Wer pausiert, bekommt den eigenen Punkteschnitt gutgeschrieben (abschaltbar).',
      tips: [
        '16, 24 oder 32 Punkte wählen: Dann schlägt jede Person gleich oft auf. 21 ist ungerade.',
        'Lieber nach Zeit? Format „Punkte auf Zeit“ wählen, dann zählt der Stand beim Abpfiff.',
        'Quellen nennen 24 Punkte als Standard. 32 Punkte dauern etwa 2 Stunden.'
      ]
    },
    mexicano: {
      name: 'Mexicano', icon: 'chart', tag: 'Wie Americano, aber ab Runde 2 spielen Gleichstarke zusammen.',
      best: ['padel'], who: 'ab 8 Personen', time: 'so lange die Zeit reicht, meist 5–8 Runden',
      about: 'Runde 1 wird ausgelost. Danach teilt die App nach dem aktuellen Tabellenstand ein: Die besten vier spielen auf dem ersten Platz, die nächsten vier auf dem zweiten. Auf jedem Platz spielen Rang 1 und 4 gegen Rang 2 und 3. So werden die Spiele von Runde zu Runde ausgeglichener.',
      steps: [
        'Namen eintragen, Runde 1 wird zufällig gemischt.',
        'Ergebnisse eintragen wie beim Americano.',
        'Die nächste Runde entsteht erst, wenn alle Ergebnisse drin sind.',
        'Wer zweimal hintereinander zusammenspielen würde, wird automatisch anders aufgeteilt.'
      ],
      scoring: 'Wie Americano: Summe der eigenen Punkte, dann Siege, dann Differenz.',
      tips: [
        'Die Einteilung 1+4 gegen 2+3 ist am weitesten verbreitet. Manche Clubs spielen 1+3 gegen 2+4, das kannst du einstellen.',
        'Die Stärksten treffen sich schnell auf Platz 1. Das macht die letzten Runden spannend.'
      ]
    },
    mixed: {
      name: 'Mixed-Americano', icon: 'people', tag: 'Jedes Team besteht aus einer Person aus Gruppe A und einer aus Gruppe B.',
      best: [], who: 'je 4, 6 oder 8 pro Gruppe', time: '60–120 min',
      about: 'Americano mit festen Gruppen, meist Damen und Herren. Jede Runde spielt eine Person aus Gruppe A mit einer Person aus Gruppe B zusammen. Die App rotiert so, dass jede Person aus A einmal mit jeder Person aus B spielt.',
      steps: [
        'Namen eintragen und jede Person Gruppe A oder B zuordnen.',
        'Beide Gruppen sollten gleich groß sein. Sonst pausieren in der größeren Gruppe Personen.',
        'Spielen und eintragen wie beim Americano.'
      ],
      scoring: 'Summe der eigenen Punkte, gemeinsame Tabelle für alle.',
      tips: ['Die Gruppen heißen in der App neutral A und B. Du entscheidest, wer wohin gehört.']
    },
    team_americano: {
      name: 'Team-Americano', icon: 'people', tag: 'Feste Teams, jede Runde ein neuer Gegner.',
      best: [], who: '4–12 Teams', time: '60–150 min',
      about: 'Ihr bleibt das ganze Turnier als Team zusammen. Jedes Team spielt einmal gegen jedes andere, gezählt werden wie beim Americano die Punkte. Bei ungerader Teamzahl setzt jede Runde ein Team aus.',
      steps: [
        'Teams eintragen, zum Beispiel „Anna / Ben“.',
        'Die App verteilt alle Paarungen auf die Plätze.',
        'Ergebnisse eintragen, die Punkte gehen aufs Teamkonto.'
      ],
      scoring: 'Summe der Teampunkte, dann Siege, dann Differenz.',
      tips: ['Im Formular kannst du aus einer Namensliste Teams auslosen lassen.']
    },
    team_mexicano: {
      name: 'Team-Mexicano', icon: 'chart', tag: 'Feste Teams, Gegner nach Tabelle: 1 gegen 2, 3 gegen 4.',
      best: [], who: '4–16 Teams', time: 'so lange die Zeit reicht',
      about: 'Feste Teams wie beim Team-Americano. Ab Runde 2 spielt das Team auf Rang 1 gegen Rang 2, Rang 3 gegen Rang 4 und so weiter. Direkte Revanchen aus der Vorrunde vermeidet die App.',
      steps: ['Teams eintragen.', 'Runde 1 wird ausgelost.', 'Jede weitere Runde wird nach der Tabelle gepaart.'],
      scoring: 'Summe der Teampunkte, dann Siege, dann Differenz.',
      tips: ['Gut für unterschiedlich starke Gruppen: Nach zwei, drei Runden passen die Paarungen.']
    },
    kotc: {
      name: 'King of the Court', icon: 'crown', tag: 'Sieger steigen auf, Verlierer steigen ab.',
      aka: 'Rey de la pista, Pozo, Up and Down the River',
      best: ['padel', 'pickleball'], who: '4–12 Teams oder 8–24 Personen, ab 2 Plätzen', time: '60–120 min',
      about: 'Die Plätze bilden eine Rangleiter, Platz 1 ist der Königsplatz. Jede Runde läuft auf Zeit. Beim Abpfiff gewinnt, wer vorne liegt. Bei Gleichstand entscheidet ein letzter Punkt. Die Sieger rücken einen Platz nach oben, die Verlierer einen nach unten. Auf dem Königsplatz bleiben die Sieger, auf dem untersten Platz die Verlierer.',
      steps: [
        'Teams in Stärke-Reihenfolge eintragen oder zufällig verteilen lassen.',
        'Runde starten, der Timer läuft für alle Plätze gleichzeitig.',
        'Nach dem Abpfiff auf jedem Platz das Siegerteam antippen.',
        'Die App zeigt, wer wohin wechselt. Mehr Teams als Plätze? Die Verlierer vom untersten Platz tauschen mit den Wartenden.',
        'Mit Partnerwechsel werden die Teams nach jeder Runde getrennt. In Pickleball heißt das „Claim the Throne“.'
      ],
      scoring: 'König ist, wer die letzte Runde auf Platz 1 gewinnt. Danach zählt die Position auf der Leiter. Alternativ: Punkte pro Sieg, auf höheren Plätzen mehr.',
      tips: [
        'Üblich sind 10 bis 15 Minuten pro Runde. „Rey de la pista“-Turniere laufen oft 90 Minuten am Stück.',
        'Ohne Timer geht es auch: Spiel bis 11 (Pickleball) als Zählweise wählen.'
      ]
    },
    winner_stays: {
      name: 'Gewinner bleibt', icon: 'queue', tag: 'Offenes Spiel: Sieger bleiben, Verlierer stellen sich hinten an.',
      best: ['pickleball'], who: 'ab 3 Teams, beliebig viele', time: 'offen',
      about: 'Typisch für Open Play im Pickleball. Die Sieger bleiben auf dem Platz, die Verlierer reihen sich hinten in die Warteschlange ein. Damit niemand ewig wartet, darf ein Team höchstens 2 Spiele in Folge bleiben. Danach gehen beide Teams raus. Mehrere Plätze teilen sich eine Warteschlange.',
      steps: [
        'Teams oder Einzelne eintragen, die Reihenfolge ist die Warteschlange.',
        'Nach jedem Spiel das Siegerteam antippen.',
        'Die App holt sofort das nächste Team auf den Platz und zeigt, wer sich bereitmachen soll.'
      ],
      scoring: 'Meiste Siege, dann längste Siegesserie.',
      tips: ['Viele Anlagen begrenzen auf 2 Siege in Folge. Das ist auch die Voreinstellung.']
    },
    rally_king: {
      name: 'Königsseite', icon: 'crown', tag: 'Trainingsspiel: Punkte gibt es nur auf der Königsseite.',
      best: [], who: '3–10 Teams oder Einzelne', time: '15–30 min',
      about: 'King of the Court als Trainingsspiel, Ballwechsel für Ballwechsel. Ein Team steht auf der Königsseite, gegenüber ein Herausforderer, die anderen warten. Gewinnt der König den Ballwechsel, gibt es einen Punkt und der nächste Herausforderer kommt. Gewinnt der Herausforderer, wechselt er auf die Königsseite. Punkte gibt es dafür nicht.',
      steps: [
        'Teams eintragen und Zielpunktzahl wählen.',
        'Nach jedem Ballwechsel antippen, wer ihn gewonnen hat.',
        'Die App zeigt, wer auf welche Seite muss und wer als Nächstes dran ist.'
      ],
      scoring: 'Wer zuerst die Zielpunktzahl erreicht, gewinnt.',
      tips: ['Das ist ein Format aus dem Training. Die Details unterscheiden sich von Club zu Club. Sprecht vorher ab, wer den Ball einspielt.']
    },
    round_robin: {
      name: 'Jeder gegen jeden', icon: 'grid', tag: 'Feste Teams, alle spielen gegen alle.',
      best: ['tennis', 'pickleball'], who: '3–10 Teams oder Einzelne', time: 'je nach Anzahl',
      about: 'Jedes Team trifft genau einmal auf jedes andere. Sobald ein Platz frei wird, schickt die App das nächste passende Spiel darauf. So entsteht keine Wartezeit, auch wenn Spiele unterschiedlich lang dauern.',
      steps: ['Teams oder Einzelne eintragen.', 'Zählweise wählen, zum Beispiel ein Satz bis 6.', 'Ergebnisse eintragen, die App vergibt die Plätze automatisch.'],
      scoring: 'Siege (Unentschieden zählt halb), dann Satzdifferenz, dann Spiel- oder Punktdifferenz.',
      tips: ['Bei mehr als 8 Teams lieber „Gruppen + K.-o.“ nehmen, sonst wird es lang.']
    },
    knockout: {
      name: 'K.-o.-System', icon: 'bracket', tag: 'Wer verliert, ist raus. Optional mit Spiel um Platz 3 und Trostrunde.',
      best: ['tennis'], who: '4–32 Teams oder Einzelne', time: 'kurz, viele schauen zu',
      about: 'Klassischer Turnierbaum. Die Reihenfolge der Eingabe ist die Setzliste: Die Ersten treffen erst spät aufeinander. Fehlen Teilnehmende bis zur nächsten Zweierpotenz, bekommen die Gesetzten ein Freilos.',
      steps: ['In Setz-Reihenfolge eintragen oder auslosen.', 'Ergebnisse eintragen, die Sieger rücken automatisch weiter.', 'Die Trostrunde fängt alle auf, die in der ersten Runde verlieren.'],
      scoring: 'Platzierung nach Ausscheiden. Ohne Spiel um Platz 3 teilen sich die Halbfinal-Verlierer Rang 3.',
      tips: ['Mit Trostrunde spielt jede Person mindestens zwei Spiele.']
    },
    groups_ko: {
      name: 'Gruppen + K.-o.', icon: 'groups', tag: 'Erst Gruppenphase, dann Finalrunde.',
      best: ['pickleball', 'tennis'], who: '8–32 Teams', time: '2–5 h',
      about: 'Das Standardformat für größere Turniere, bei USA Pickleball „Pool Play + Medal Round“. Die Teams spielen in Gruppen jeder gegen jeden. Die Besten jeder Gruppe ziehen in einen K.-o.-Baum ein. Teams aus derselben Gruppe treffen in der ersten K.-o.-Runde nicht aufeinander.',
      steps: ['Teams eintragen, die App verteilt sie per Schlange auf die Gruppen.', 'Gruppenspiele laufen auf allen freien Plätzen.', 'Wenn alle Gruppenspiele fertig sind: K.-o.-Runde auslosen.'],
      scoring: 'Gruppe: Siege, Satzdifferenz, Spieldifferenz. Danach Platzierung im K.-o.-Baum.',
      tips: ['4 Gruppen à 4 mit 2 Weiterkommenden ergibt ein Viertelfinale.']
    },
    compass: {
      name: 'Kompass-Turnier', icon: 'compass', tag: 'Alle spielen gleich oft: 3 Spiele bei 8, 4 Spiele bei 16.',
      best: ['tennis'], who: '5–16 Teams oder Einzelne', time: '3–4 Spiele pro Person',
      about: 'Beliebt im Club-Tennis. Alle starten im Feld Ost. Wer in Runde 1 verliert, wechselt nach West. Wer in Runde 2 von Ost verliert, geht nach Nord, Verlierer aus West nach Süd. So spielen alle bis zum Schluss gegen ähnlich starke Gegner, und jede Himmelsrichtung hat eine eigene Siegerin oder einen eigenen Sieger.',
      steps: ['In Setz-Reihenfolge eintragen.', 'Ergebnisse eintragen, die App schickt alle in die richtige Richtung.', 'Bei 16 kommen Nordost, Nordwest, Südost und Südwest dazu.'],
      scoring: 'Ost entscheidet die Plätze 1 und 2, dann folgen die anderen Felder.',
      tips: ['Unter 8 bzw. 16 Teilnehmenden gibt es Freilose.']
    }
  }
};
