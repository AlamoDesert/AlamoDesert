/* Courtside – Texte zu Modi, Leveln und Regeln. Reiner Inhalt, keine Logik. */
window.CONTENT = {
  levels: {
    beginner: 'Erste Turniere, die Grundschläge sitzen.',
    intermediate: 'Du spielst regelmäßig, Ballwechsel und Wände klappen.',
    pro: 'Turniererfahrung, schnelles Netzspiel.'
  },

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
        ['Rally Scoring', '2026 als vorläufige Option erlaubt: Jeder Ballwechsel zählt, Spiele bis 11, 15 oder 21.'],
        ['Two-Bounce-Regel', 'Aufschlag und Return müssen je einmal aufspringen. Erst danach sind Volleys erlaubt.'],
        ['Kitchen', 'In der Non-Volley-Zone (2,13 m vor dem Netz) darf kein Volley gespielt werden.']
      ]
    },
    tennis: {
      name: 'Tennis',
      rules: [
        ['Fast4', 'Tennis Australia: Sätze bis 4, No-Ad, Tiebreak bei 3:3 bis 5 Punkte, kein Let beim Aufschlag.'],
        ['Match-Tiebreak', 'ITF-Regeln: Ein Tiebreak bis 10 mit 2 Punkten Vorsprung kann den Entscheidungssatz ersetzen.'],
        ['No-Ad', 'Bei Einstand entscheidet ein Punkt. Das rückschlagende Team wählt die Seite.']
      ]
    }
  },

  // tag: ein Satz für Listen. teams: wie die App feste Teams aus den Leveln bildet.
  modes: {
    americano: {
      name: 'Americano', icon: 'shuffle', tag: 'Jede Runde neue Partner, die Punkte zählen für dich allein.',
      who: '8, 12 oder 16 Personen ideal', time: '90–120 min',
      about: 'Der Klassiker im Padel. Du spielst jede Runde mit jemand anderem zusammen. Gespielt wird auf eine feste Gesamtpunktzahl, zum Beispiel 24. Beide im Team bekommen ihre Punkte gutgeschrieben. Am Ende gewinnt, wer insgesamt die meisten Punkte hat.',
      steps: [
        'Die App lost alle Runden aus. Bei 8, 12 oder 16 Personen spielst du genau einmal mit jeder anderen Person.',
        'Gespielt wird, bis die Gesamtpunktzahl erreicht ist, zum Beispiel 15:9 bei 24 Punkten.',
        'Mit Level-Angaben lost die App so aus, dass beide Teams eines Spiels möglichst gleich stark sind.',
        'Nach der letzten Runde steht die Einzelwertung fest.'
      ],
      scoring: 'Summe der eigenen Punkte, bei Gleichstand zählen Siege, dann die Differenz. Wer pausiert, bekommt den eigenen Punkteschnitt gutgeschrieben.',
      tips: ['16, 24 oder 32 Punkte: Dann schlägt jede Person gleich oft auf.', 'Lieber nach Zeit? „Punkte auf Zeit“ wählen, es zählt der Stand beim Abpfiff.']
    },
    mexicano: {
      name: 'Mexicano', icon: 'chart', tag: 'Wie Americano, aber ab Runde 2 spielen Gleichstarke zusammen.',
      who: 'ab 8 Personen', time: '5–8 Runden, meist 90 min',
      about: 'Ab Runde 2 teilt die App nach dem Tabellenstand ein: Die besten vier spielen auf Platz 1, die nächsten vier auf Platz 2. Auf jedem Platz spielt Rang 1 mit Rang 4 gegen Rang 2 mit Rang 3. So werden die Spiele von Runde zu Runde enger.',
      steps: [
        'Runde 1 teilt die App nach Level ein, ohne Level-Angaben per Zufall.',
        'Gespielt und gezählt wird wie beim Americano.',
        'Die nächste Runde entsteht, sobald alle Ergebnisse drin sind.',
        'Wer zweimal hintereinander zusammenspielen würde, wird anders aufgeteilt.'
      ],
      scoring: 'Wie beim Americano: Summe der eigenen Punkte, dann Siege, dann Differenz.',
      tips: ['Manche Clubs spielen 1+3 gegen 2+4. Das lässt sich umstellen.']
    },
    kotc: {
      name: 'King of the Court', icon: 'crown', tag: 'Feste Teams. Sieger steigen auf, Verlierer steigen ab.',
      aka: 'Rey de la pista, Pozo, Up and Down the River',
      who: '4–12 Teams, ab 2 Plätzen', time: '60–90 min',
      about: 'Die Plätze bilden eine Rangleiter, Platz 1 ist der Königsplatz. Jede Runde läuft auf Zeit. Beim Abpfiff gewinnt, wer vorne liegt, bei Gleichstand entscheidet ein letzter Punkt. Die Sieger rücken einen Platz nach oben, die Verlierer einen nach unten. Wer am Ende auf Platz 1 gewinnt, ist König.',
      steps: [
        'Die App bildet die Teams aus gleich starken Partnern. Die stärksten Teams starten auf Platz 1.',
        'Der Timer läuft für alle Plätze gleichzeitig, meist 10 bis 15 Minuten.',
        'Nach dem Abpfiff auf jedem Platz das Siegerteam antippen.',
        'Die App zeigt, wer wohin wechselt. Gibt es mehr Teams als Plätze, tauscht der Verlierer des untersten Platzes mit dem nächsten wartenden Team.'
      ],
      scoring: 'Es zählt die Position auf der Leiter nach der letzten Runde. Gleichstand: mehr Siege.',
      tips: ['Gleich starke Partner machen die Leiter aussagekräftig. Gemischte Teams geben eher zufällige Sieger.']
    },
    team: {
      name: 'Team-Turnier', icon: 'people', tag: 'Feste Teams, jedes Team spielt einmal gegen jedes andere.',
      aka: 'Jeder gegen jeden',
      who: '4–10 Teams', time: 'je nach Anzahl, 60–150 min',
      about: 'Ihr bleibt das ganze Turnier als Team zusammen und trefft nacheinander auf alle anderen Teams. Gezählt werden wie beim Americano die Punkte. Bei ungerader Teamzahl setzt jede Runde ein Team aus.',
      steps: [
        'Die App bildet ausgeglichene Teams: eine stärkere mit einer schwächeren Person.',
        'Alle Paarungen werden auf die Plätze verteilt.',
        'Die Punkte jedes Spiels gehen aufs Teamkonto.'
      ],
      scoring: 'Summe der Teampunkte, dann Siege, dann Differenz.',
      tips: ['Ausgeglichene Teams sorgen dafür, dass jedes Spiel spannend bleibt.']
    }
  }
};
