/* Courtside – Turnier-Engine.
 * Reine Logik ohne DOM: Formate, Modi, Spielstärke, Teambildung, Auslosung, Wertung, „Was kommt als Nächstes“.
 * Läuft im Browser (window.Engine) und in Node (module.exports) für Tests.
 * Alle Mutationen arbeiten direkt auf dem Turnier-Objekt; Undo übernimmt die App per Snapshot.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- Hilfsfunktionen ---------- */

  let seq = 0;
  const uid = (p) => p + Date.now().toString(36).slice(-5) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  const clock = () => Date.now();
  const pk = (x, y) => (x < y ? x + '|' + y : y + '|' + x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Sportarten, Regeln, Formate, Modi ---------- */

  const SPORTS = {
    padel: { id: 'padel', name: 'Padel', singles: false },
    pickleball: { id: 'pickleball', name: 'Pickleball', singles: true },
    tennis: { id: 'tennis', name: 'Tennis', singles: true }
  };

  // Spielregel-Varianten je Sport (nur Anzeige für die Spieler).
  const RULES = {
    padel: {
      key: 'deuce', label: 'Einstand', def: 'star',
      options: [
        { id: 'star', name: 'Star Point', hint: 'Bei 40:40 zweimal Vorteil, beim dritten Einstand entscheidet ein Punkt (FIP seit 2026).' },
        { id: 'golden', name: 'Goldener Punkt', hint: 'Bei 40:40 entscheidet der nächste Punkt. Rückschläger wählen die Seite.' },
        { id: 'adv', name: 'Vorteil', hint: 'Klassisch: Einstand und Vorteil, bis ein Team zwei Punkte vorn liegt.' }
      ]
    },
    pickleball: {
      key: 'scoring', label: 'Zählweise', def: 'sideout',
      options: [
        { id: 'sideout', name: 'Side-out', hint: 'Nur das aufschlagende Team punktet (USA Pickleball Standard).' },
        { id: 'rally', name: 'Rally Scoring', hint: 'Jeder Ballwechsel zählt einen Punkt, egal wer aufschlägt.' }
      ]
    },
    tennis: {
      key: 'deuce', label: 'Einstand', def: 'noad',
      options: [
        { id: 'noad', name: 'No-Ad', hint: 'Bei Einstand entscheidet ein Punkt, Rückschläger wählen die Seite.' },
        { id: 'ad', name: 'Vorteil', hint: 'Klassisch mit Einstand und Vorteil.' }
      ]
    }
  };

  // kind: points | games | winner. min = geschätzte Spielminuten. desc erklärt die Zählweise in einem Satz.
  const BALL = 'Jeder Ballwechsel zählt einen Punkt, egal wer aufschlägt.';
  const FORMATS = {
    p16: { kind: 'points', total: 16, name: '16 Punkte', short: '16 Pkt.', min: 9, desc: `${BALL} Nach 16 Ballwechseln ist Schluss, z. B. 10:6. Kurz und schnell.` },
    p21: { kind: 'points', total: 21, name: '21 Punkte', short: '21 Pkt.', min: 11, desc: `${BALL} Nach 21 Ballwechseln ist Schluss, z. B. 12:9. Kein Unentschieden möglich, dafür schlägt eine Person einmal mehr auf.` },
    p24: { kind: 'points', total: 24, name: '24 Punkte', short: '24 Pkt.', min: 13, desc: `${BALL} Nach 24 Ballwechseln ist Schluss, z. B. 15:9. Der Standard für Americano.` },
    p32: { kind: 'points', total: 32, name: '32 Punkte', short: '32 Pkt.', min: 17, desc: `${BALL} Nach 32 Ballwechseln ist Schluss, z. B. 18:14. Lange Runden, weniger Wechsel.` },
    pTime: { kind: 'points', timed: true, name: 'Punkte auf Zeit', short: 'Punkte/Zeit', min: 12, desc: `${BALL} Gespielt wird, bis der Timer abläuft. Eingetragen wird der Stand beim Abpfiff.` },
    gTime: { kind: 'games', timed: true, name: 'Spiele auf Zeit', short: 'Spiele/Zeit', min: 15, desc: 'Normal zählen mit 15–30–40. Bis der Timer abläuft, eingetragen werden die gewonnenen Spiele, z. B. 4:3.' },
    r11: { kind: 'points', target: 11, winBy: 2, name: 'Bis 11 Punkte', short: 'bis 11', min: 15, desc: 'Pickleball-Standard: Wer zuerst 11 Punkte hat und 2 vorn liegt, gewinnt.' },
    r15: { kind: 'points', target: 15, winBy: 2, name: 'Bis 15 Punkte', short: 'bis 15', min: 20, desc: 'Wer zuerst 15 Punkte hat und 2 vorn liegt, gewinnt. Längere Spiele.' },
    r21: { kind: 'points', target: 21, winBy: 2, name: 'Bis 21 (Rally Scoring)', short: 'bis 21', min: 20, desc: 'Jeder Ballwechsel zählt. Wer zuerst 21 Punkte hat und 2 vorn liegt, gewinnt.' },
    tb10: { kind: 'points', target: 10, winBy: 2, name: 'Match-Tiebreak bis 10', short: 'MTB 10', min: 8, desc: 'Ein einziger Tiebreak: Wer zuerst 10 Punkte hat und 2 vorn liegt, gewinnt. Sehr kurz.' },
    g4: { kind: 'games', target: 4, name: 'Kurzsatz bis 4 (Fast4)', short: 'Satz bis 4', min: 20, desc: 'Ein Satz, wer zuerst 4 Spiele hat, gewinnt. Bei 3:3 entscheidet ein Tiebreak.' },
    g6: { kind: 'games', target: 6, name: '1 Satz bis 6', short: '1 Satz', min: 35, desc: 'Ein normaler Satz bis 6 Spiele, bei 6:6 Tiebreak.' },
    win: { kind: 'winner', name: 'Nur Sieger antippen', short: 'Sieg', min: 12, desc: 'Gespielt wird auf Zeit. Nach dem Abpfiff nur das Siegerteam antippen, kein Spielstand nötig.' }
  };

  const F_ROT = { padel: ['p24', 'p16', 'p21', 'p32', 'pTime', 'gTime'], pickleball: ['r11', 'r15', 'r21', 'pTime'], tennis: ['g4', 'g6', 'tb10', 'gTime'] };
  const F_KOTC = { padel: ['win', 'pTime', 'gTime'], pickleball: ['win', 'r11', 'pTime'], tennis: ['win', 'gTime', 'g4'] };

  // teams: wie feste Teams standardmäßig gebildet werden (similar = gut mit gut, balanced = gut mit schwächer).
  const MODES = {
    americano: { engine: 'rotation', unit: 'player', pairing: 'fixed', doublesOnly: true, min: 4, formats: F_ROT },
    mexicano: { engine: 'rotation', unit: 'player', pairing: 'dynamic', doublesOnly: true, min: 4, formats: F_ROT },
    kotc: { engine: 'ladder', unit: 'team', min: 4, formats: F_KOTC, teams: 'similar' },
    team: { engine: 'rotation', unit: 'team', pairing: 'circle', min: 3, formats: F_ROT, teams: 'balanced' }
  };

  const formatsFor = (modeId, sport) => (MODES[modeId] ? MODES[modeId].formats[sport] || [] : []);
  const defaultFormat = (modeId, sport) => formatsFor(modeId, sport)[0] || null;
  const modeAvailable = (modeId, sport, discipline) => !!MODES[modeId] && !(MODES[modeId].doublesOnly && discipline === 'singles');

  /* ---------- Spielstärke & Teambildung ---------- */

  // Eigene Einstufung; value = Spielstärke auf der Playtomic-Skala (0–7).
  const LEVELS = {
    beginner: { id: 'beginner', name: 'Anfänger', value: 1.5, hint: 'Playtomic etwa 0–2' },
    intermediate: { id: 'intermediate', name: 'Mittel', value: 3, hint: 'Playtomic etwa 2–4' },
    pro: { id: 'pro', name: 'Profi', value: 4.5, hint: 'Playtomic ab etwa 4' }
  };
  const levelFromRating = (r) => (r < 2 ? 'beginner' : r < 4 ? 'intermediate' : 'pro');

  function parseRating(v) {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && n <= 7 ? Math.round(n * 10) / 10 : null;
  }

  // Playtomic-Level hat Vorrang vor der Selbsteinschätzung.
  function strengthOf(p) {
    if (!p) return null;
    if (Array.isArray(p.members) && p.members.length) {
      const s = p.members.map(strengthOf).filter((x) => x != null);
      return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
    }
    if (typeof p.rating === 'number') return p.rating;
    return LEVELS[p.level] ? LEVELS[p.level].value : null;
  }

  function levelLabel(p) {
    if (!p) return '';
    if (typeof p.rating === 'number') return `Playtomic ${p.rating.toFixed(1).replace('.', ',')}`;
    return LEVELS[p.level] ? LEVELS[p.level].name : '';
  }

  // Bildet Zweierteams. strategy: 'similar' (gut mit gut), 'balanced' (gut mit schwächer), 'random'.
  // Ohne Angabe zählt eine Person als „Mittel“. Gleich Starke werden zufällig gemischt.
  function buildTeams(players, strategy, rnd = Math.random) {
    const val = (p) => { const s = strengthOf(p); return s == null ? LEVELS.intermediate.value : s; };
    const pool = shuffle(players, rnd);
    if (strategy !== 'random') pool.sort((a, b) => val(b) - val(a));
    const n = pool.length - (pool.length % 2);
    const leftover = pool.length % 2 ? (strategy === 'balanced' ? pool.splice(Math.floor(pool.length / 2), 1)[0] : pool.pop()) : null;
    const teams = [];
    if (strategy === 'balanced') {
      for (let i = 0; i < n / 2; i++) teams.push([pool[i], pool[n - 1 - i]]);
      // Feinschliff: Partner tauschen, solange die Teamstärken enger zusammenrücken.
      const sum = (tm) => val(tm[0]) + val(tm[1]);
      const mean = teams.reduce((a, tm) => a + sum(tm), 0) / (teams.length || 1);
      const dev = (tm) => (sum(tm) - mean) ** 2;
      for (let pass = 0, better = true; better && pass < 50; pass++) {
        better = false;
        for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
          const before = dev(teams[i]) + dev(teams[j]);
          [teams[i][x], teams[j][y]] = [teams[j][y], teams[i][x]];
          if (dev(teams[i]) + dev(teams[j]) < before - 1e-9) better = true;
          else [teams[i][x], teams[j][y]] = [teams[j][y], teams[i][x]];
        }
      }
      teams.forEach((tm) => tm.sort((p, q) => val(q) - val(p)));
    } else for (let i = 0; i < n; i += 2) teams.push([pool[i], pool[i + 1]]);
    teams.sort((a, b) => (val(b[0]) + val(b[1])) - (val(a[0]) + val(a[1])));
    return { teams, leftover };
  }

  /* ---------- Ergebnisse ---------- */

  // Einheitliche Auswertung: w = 'a' | 'b' | 'd', pa/pb = Punkte bzw. Games.
  function evalScore(fmt, s) {
    if (!s) return null;
    if (fmt.kind === 'winner') {
      if (s.w !== 'a' && s.w !== 'b') return null;
      return { w: s.w, pa: s.w === 'a' ? 1 : 0, pb: s.w === 'b' ? 1 : 0 };
    }
    const a = Number(s.a), b = Number(s.b);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return null;
    return { w: a > b ? 'a' : b > a ? 'b' : 'd', pa: a, pb: b };
  }

  // Prüft eine Eingabe. error blockiert das Speichern, warn ist nur ein Hinweis.
  function checkScore(fmt, s, allowDraw) {
    const r = evalScore(fmt, s);
    if (!r) return { error: 'Bitte ein Ergebnis eingeben.' };
    if (fmt.kind === 'points' && fmt.total && r.pa + r.pb !== fmt.total) return { error: `Zusammen müssen es ${fmt.total} Punkte sein.` };
    if (r.w === 'd' && !allowDraw) return { error: 'Unentschieden geht hier nicht. Bitte den Sieger eintragen.' };
    let warn = null;
    if (fmt.target && r.w !== 'd') {
      const hi = Math.max(r.pa, r.pb), lo = Math.min(r.pa, r.pb);
      if (hi < fmt.target) warn = `Ziel ${fmt.target} noch nicht erreicht. Bei Zeitablauf ist das in Ordnung.`;
      else if (fmt.winBy && hi - lo < fmt.winBy) warn = `Üblich sind ${fmt.winBy} Punkte Vorsprung.`;
      else if (fmt.winBy && hi > fmt.target && hi - lo > fmt.winBy) warn = 'Über dem Ziel endet ein Spiel normalerweise mit genau 2 Punkten Vorsprung.';
    }
    return { error: null, warn };
  }

  const scoreText = (fmt, s) => (!s || fmt.kind === 'winner' ? '' : `${s.a}:${s.b}`);

  /* ---------- Turnier anlegen ---------- */

  const validEntrants = (list) => (list || []).filter((e) => e && String(e.name || '').trim());

  function validateConfig(cfg) {
    const m = MODES[cfg.mode];
    if (!m) return 'Unbekannter Modus.';
    if (!modeAvailable(cfg.mode, cfg.sport, cfg.discipline)) return 'Dieser Modus wird im Doppel gespielt.';
    const ents = validEntrants(cfg.entrants);
    const word = unitNoun(cfg, true);
    if (ents.length < m.min) return `Dieser Modus braucht mindestens ${m.min} ${word}.`;
    const names = ents.map((e) => e.name.trim().toLowerCase());
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) return `„${ents[names.indexOf(dup)].name.trim()}“ steht doppelt in der Liste.`;
    if (m.engine === 'ladder' && (Number(cfg.courts) || 1) < 2) return 'King of the Court braucht mindestens 2 Plätze, damit es Auf- und Abstieg gibt.';
    if (!formatsFor(cfg.mode, cfg.sport).includes(cfg.format)) return 'Bitte eine Zählweise wählen.';
    return null;
  }

  function unitNoun(cfg, plural) {
    const m = MODES[cfg.mode] || {};
    if (m.unit === 'player' || cfg.discipline === 'singles') return plural ? 'Personen' : 'Person';
    return plural ? 'Teams' : 'Team';
  }

  function cleanPerson(p) {
    const out = { name: String(p.name).trim() };
    const r = parseRating(p.rating);
    if (r != null) out.rating = r;
    if (LEVELS[p.level]) out.level = p.level;
    else if (r != null) out.level = levelFromRating(r);
    return out;
  }

  function create(cfg) {
    const err = validateConfig(cfg);
    if (err) throw new Error(err);
    const courts = clamp(Number(cfg.courts) || 1, 1, 32);
    const t = {
      v: 2,
      id: uid('t'),
      name: String(cfg.name || '').trim() || 'Turnier',
      sport: cfg.sport,
      mode: cfg.mode,
      discipline: SPORTS[cfg.sport].singles ? cfg.discipline || 'doubles' : 'doubles',
      format: cfg.format,
      rules: Object.assign({}, cfg.rules || {}),
      options: Object.assign({}, cfg.options || {}),
      courts: Array.from({ length: courts }, (_, i) => String((cfg.courtNames && cfg.courtNames[i]) || `Platz ${i + 1}`)),
      entrants: validEntrants(cfg.entrants).map((e) => {
        const x = Object.assign({ id: uid('e'), active: true }, cleanPerson(e));
        if (Array.isArray(e.members) && e.members.length) x.members = e.members.map(cleanPerson);
        return x;
      }),
      rounds: [],
      cur: 0,
      status: 'running',
      timer: { dur: 0, endsAt: null, left: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demo: !!cfg.demo
    };
    if (cfg.reg) t.reg = cfg.reg;
    ENGINES[MODES[t.mode].engine].init(t);
    if (roundTimed(t)) t.timer.dur = (Number(t.options.roundMinutes) || 12) * 60;
    return t;
  }

  const fmtOf = (t) => FORMATS[t.format] || FORMATS.win;
  function roundTimed(t) {
    if (MODES[t.mode].engine === 'ladder') return Number(t.options.roundMinutes) > 0;
    return !!fmtOf(t).timed || Number(t.options.roundMinutes) > 0;
  }
  const allowDraw = (t) => MODES[t.mode].engine !== 'ladder';
  const hasStrength = (t) => t.entrants.some((e) => strengthOf(e) != null);

  /* ---------- Namen ---------- */

  const ent = (t, id) => t.entrants.find((e) => e.id === id);
  const nameOf = (t, id) => { const e = ent(t, id); return e ? e.name : '–'; };
  const sideName = (t, ids) => (Array.isArray(ids) ? ids.map((id) => nameOf(t, id)).join(' & ') : 'offen');
  const activeIds = (t) => t.entrants.filter((e) => e.active !== false).map((e) => e.id);
  const newMatch = (fields) => Object.assign({ id: uid('m'), a: null, b: null, score: null, w: null, court: null }, fields);

  /* ================================================================
   * Rotation: Americano, Mexicano, Team-Turnier (jeder gegen jeden)
   * ================================================================ */

  function historyStats(t, rounds) {
    const P = new Map(), O = new Map(), byes = new Map(), lastBye = new Map();
    const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);
    rounds.forEach((r, ri) => {
      r.byes.forEach((id) => { inc(byes, id); lastBye.set(id, ri); });
      r.matches.forEach((m) => {
        if (m.a.length === 2) inc(P, pk(m.a[0], m.a[1]));
        if (m.b.length === 2) inc(P, pk(m.b[0], m.b[1]));
        m.a.forEach((x) => m.b.forEach((y) => inc(O, pk(x, y))));
      });
    });
    let S = null;
    if (t.options.balance !== false && hasStrength(t)) {
      S = new Map();
      t.entrants.forEach((e) => { const s = strengthOf(e); S.set(e.id, s == null ? LEVELS.intermediate.value : s); });
    }
    return { P, O, byes, lastBye, S, roundCount: rounds.length };
  }

  // Wer setzt aus? Wer bisher am seltensten pausiert hat, am längsten nicht.
  function chooseByes(ids, count, st) {
    if (count <= 0) return [];
    const order = shuffle(ids).sort((x, y) =>
      (st.byes.get(x) || 0) - (st.byes.get(y) || 0) ||
      (st.lastBye.has(x) ? st.lastBye.get(x) : -1) - (st.lastBye.has(y) ? st.lastBye.get(y) : -1));
    return order.slice(0, count);
  }

  // Gewichte: Partner-Wiederholung ist teuer, gleiche Gegner mittel, Stärke-Unterschied der Teams leicht.
  const W_PARTNER = 1000, W_OPP = 12, W_BAL = 25;
  function courtCost(st, p) {
    const g = (m, x, y) => m.get(pk(x, y)) || 0;
    let c = W_PARTNER * (g(st.P, p[0], p[1]) + g(st.P, p[2], p[3])) +
      W_OPP * (g(st.O, p[0], p[2]) + g(st.O, p[0], p[3]) + g(st.O, p[1], p[2]) + g(st.O, p[1], p[3]));
    if (st.S) c += Math.round(W_BAL * Math.abs(st.S.get(p[0]) + st.S.get(p[1]) - st.S.get(p[2]) - st.S.get(p[3])));
    return c;
  }

  // Ordnet Spielende auf Plätze/Teams: zufälliger Start + Tauschen, solange es besser wird.
  function arrangeRound(players, st, restarts) {
    const courts = players.length / 4;
    let best = null, bestCost = Infinity;
    for (let s = 0; s < restarts; s++) {
      const pos = shuffle(players);
      const cost = [];
      for (let c = 0; c < courts; c++) cost[c] = courtCost(st, pos.slice(4 * c, 4 * c + 4));
      let improved = true, guard = 0;
      while (improved && guard++ < 50) {
        improved = false;
        for (let i = 0; i < pos.length; i++) {
          for (let j = i + 1; j < pos.length; j++) {
            const ci = i >> 2, cj = j >> 2;
            if (ci === cj && ((i & 2) === (j & 2))) continue; // gleiche Teamhälfte: nichts gewonnen
            [pos[i], pos[j]] = [pos[j], pos[i]];
            const ni = courtCost(st, pos.slice(4 * ci, 4 * ci + 4));
            const nj = ci === cj ? ni : courtCost(st, pos.slice(4 * cj, 4 * cj + 4));
            const delta = ci === cj ? ni - cost[ci] : ni + nj - cost[ci] - cost[cj];
            if (delta < 0) { cost[ci] = ni; cost[cj] = nj; improved = true; }
            else [pos[i], pos[j]] = [pos[j], pos[i]];
          }
        }
      }
      const total = cost.reduce((a, b) => a + b, 0);
      if (total < bestCost) { bestCost = total; best = pos.slice(); }
      if (total === 0) break;
    }
    return { pos: best, cost: bestCost };
  }

  function applyRound(st, round, ri) {
    const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);
    round.byes.forEach((id) => { inc(st.byes, id); st.lastBye.set(id, ri); });
    round.matches.forEach((m) => {
      inc(st.P, pk(m.a[0], m.a[1])); inc(st.P, pk(m.b[0], m.b[1]));
      m.a.forEach((x) => m.b.forEach((y) => inc(st.O, pk(x, y))));
    });
  }
  const cloneStats = (st) => ({ P: new Map(st.P), O: new Map(st.O), byes: new Map(st.byes), lastBye: new Map(st.lastBye), S: st.S, roundCount: st.roundCount });

  // Erzeugt count Americano-Runden im Anschluss an history. Mehrere Durchläufe, der günstigste gewinnt.
  function genAmericanoRounds(t, history, count, budgetMs = 300) {
    const ids = activeIds(t);
    const base = historyStats(t, history);
    const deadline = clock() + budgetMs;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const st = cloneStats(base);
      const rounds = [];
      let total = 0;
      for (let r = 0; r < count; r++) {
        const courts = Math.min(t.courts.length, Math.floor(ids.length / 4));
        const byes = chooseByes(ids, ids.length - courts * 4, st);
        const playing = ids.filter((id) => !byes.includes(id));
        const { pos, cost } = arrangeRound(playing, st, 6);
        total += cost;
        const order = shuffle([...Array(courts).keys()]);
        const round = {
          id: uid('r'), byes, startedAt: null,
          matches: order.map((c, k) => newMatch({ court: k, a: [pos[4 * c], pos[4 * c + 1]], b: [pos[4 * c + 2], pos[4 * c + 3]] }))
        };
        applyRound(st, round, base.roundCount + r);
        rounds.push(round);
      }
      if (!best || total < best.total) best = { rounds, total };
      if (attempt >= 2 && clock() > deadline) break;
    }
    return best.rounds;
  }

  const byStrength = (t, ids) => ids.slice().sort((x, y) => (strengthOf(ent(t, y)) || 0) - (strengthOf(ent(t, x)) || 0));

  function genMexicanoRound(t) {
    const ids = activeIds(t);
    const st = historyStats(t, t.rounds);
    const team = MODES[t.mode].unit === 'team';
    let order;
    if (t.rounds.length === 0) {
      if (t.options.firstRound === 'level' && hasStrength(t)) order = byStrength(t, shuffle(ids));
      else if (t.options.firstRound === 'order') order = ids.slice();
      else order = shuffle(ids);
    } else order = rankOrder(t).filter((id) => ids.includes(id));
    const perCourt = team ? 2 : 4;
    const courts = Math.min(t.courts.length, Math.floor(ids.length / perCourt));
    const byes = chooseByes(ids, ids.length - courts * perCourt, st);
    const playing = order.filter((id) => !byes.includes(id));
    const last = t.rounds[t.rounds.length - 1];
    const lastPartner = new Map(), lastOpp = new Map();
    if (last) last.matches.forEach((m) => {
      [m.a, m.b].forEach((s) => { if (s.length === 2) { lastPartner.set(s[0], s[1]); lastPartner.set(s[1], s[0]); } });
      if (m.a.length === 1) { lastOpp.set(m.a[0], m.b[0]); lastOpp.set(m.b[0], m.a[0]); }
    });
    const matches = [];
    if (team) {
      // 1 gegen 2, 3 gegen 4 … – direkte Revanche aus der Vorrunde wird vermieden.
      const q = playing.slice();
      for (let c = 0; c < courts; c++) {
        const a = q.shift();
        const k = q.length > 1 && lastOpp.get(a) === q[0] ? 1 : 0;
        const b = q.splice(k, 1)[0];
        matches.push(newMatch({ court: c, a: [a], b: [b] }));
      }
    } else {
      const scheme = t.options.scheme === '13' ? [[0, 2], [1, 3]] : [[0, 3], [1, 2]];
      const alts = [scheme, scheme[0][1] === 3 ? [[0, 2], [1, 3]] : [[0, 3], [1, 2]], [[0, 1], [2, 3]]];
      for (let c = 0; c < courts; c++) {
        const g = playing.slice(4 * c, 4 * c + 4);
        const pick = alts.find((s) => s.every(([x, y]) => lastPartner.get(g[x]) !== g[y])) || scheme;
        matches.push(newMatch({ court: c, a: [g[pick[0][0]], g[pick[0][1]]], b: [g[pick[1][0]], g[pick[1][1]]] }));
      }
    }
    return { id: uid('r'), byes, startedAt: null, matches };
  }

  // Jeder gegen jeden (Kreis-Methode), verteilt auf die verfügbaren Plätze.
  function circlePairs(ids) {
    const arr = ids.slice();
    if (arr.length % 2) arr.push(null);
    const n = arr.length, out = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const x = arr[i], y = arr[n - 1 - i];
        if (x && y) pairs.push(r % 2 && i === 0 ? [y, x] : [x, y]);
      }
      out.push(pairs);
      arr.splice(1, 0, arr.pop());
    }
    return out;
  }

  function genCircleRounds(t) {
    const ids = activeIds(t);
    const queue = circlePairs(ids).flat();
    const rounds = [];
    const lastPlayed = new Map();
    const waitOf = (id) => (lastPlayed.has(id) ? lastPlayed.get(id) : -1);
    while (queue.length) {
      const used = new Set(), picked = [];
      // Teams, die länger warten, kommen zuerst dran.
      const order = queue.map((p, i) => ({ p, i, wait: Math.min(waitOf(p[0]), waitOf(p[1])) })).sort((x, y) => x.wait - y.wait || x.i - y.i);
      for (const o of order) {
        if (picked.length >= t.courts.length) break;
        if (used.has(o.p[0]) || used.has(o.p[1])) continue;
        used.add(o.p[0]); used.add(o.p[1]);
        picked.push(o);
      }
      picked.sort((x, y) => x.i - y.i);
      for (const o of picked.slice().reverse()) queue.splice(o.i, 1);
      const ri = rounds.length;
      picked.forEach((o) => { lastPlayed.set(o.p[0], ri); lastPlayed.set(o.p[1], ri); });
      rounds.push({
        id: uid('r'), startedAt: null,
        byes: ids.filter((id) => !used.has(id)),
        matches: picked.map((o, c) => newMatch({ court: c, a: [o.p[0]], b: [o.p[1]] }))
      });
    }
    return rounds;
  }

  function defaultRounds(cfg) {
    const m = MODES[cfg.mode];
    if (!m) return null;
    const n = validEntrants(cfg.entrants).length;
    const fmt = FORMATS[cfg.format] || FORMATS.win;
    const minutes = Number(cfg.options && cfg.options.roundMinutes) || 0;
    const per = (fmt.timed || m.engine === 'ladder' ? minutes || 12 : fmt.min) + 2;
    if (m.engine === 'ladder') return clamp(Math.floor(90 / per), 3, 20);
    if (m.pairing === 'circle') return null;
    const fit = Math.max(3, Math.floor(120 / per));
    if (m.pairing === 'fixed') return clamp(Math.min(Math.max(n - 1, 3), fit), 3, 30);
    return clamp(Math.min(fit, 8), 3, 30);
  }

  const rankOrder = (t) => standings(t).rows.map((r) => r.id);

  const rotation = {
    init(t) {
      const m = MODES[t.mode];
      if (m.pairing === 'circle') { t.rounds = genCircleRounds(t); t.options.rounds = t.rounds.length; }
      else {
        if (!t.options.rounds) t.options.rounds = defaultRounds(t);
        t.rounds = m.pairing === 'fixed' ? genAmericanoRounds(t, [], t.options.rounds) : [genMexicanoRound(t)];
      }
      t.cur = 0;
    },
    planned(t) { return MODES[t.mode].pairing === 'circle' ? t.rounds.length : t.options.rounds; },
    nextRound(t) {
      return MODES[t.mode].pairing === 'fixed' ? genAmericanoRounds(t, t.rounds, 1, 150)[0] : genMexicanoRound(t);
    },
    addRound(t) {
      if (MODES[t.mode].pairing === 'circle') { t.rounds.push(genMexicanoRound(t)); t.options.rounds = t.rounds.length; return; }
      t.options.rounds = Math.max(t.options.rounds, t.rounds.length) + 1;
      if (MODES[t.mode].pairing === 'fixed') t.rounds.push(this.nextRound(t));
    },
    // Nach Änderungen an der Teilnehmerliste: alle noch nicht begonnenen Runden neu auslosen.
    regenerate(t) {
      const m = MODES[t.mode];
      const r = t.rounds[t.cur];
      const untouched = r && !r.startedAt && r.matches.every((x) => !x.score);
      const keep = untouched ? t.cur : t.cur + 1;
      const history = t.rounds.slice(0, keep);
      if (m.pairing === 'fixed') t.rounds = history.concat(genAmericanoRounds(t, history, Math.max(0, t.options.rounds - keep)));
      else {
        t.rounds = history;
        if (untouched) t.rounds.push(genMexicanoRound(t));
      }
    }
  };

  /* ================================================================
   * Leiter: King of the Court (Auf- und Abstieg über mehrere Plätze)
   * ================================================================ */

  const ladder = {
    init(t) {
      if (!t.options.rounds) t.options.rounds = defaultRounds(t);
      let ids = activeIds(t);
      if (t.options.seeding === 'random') ids = shuffle(ids);
      else if (hasStrength(t)) ids = byStrength(t, ids); // stärkste Teams starten oben
      const courts = Math.min(t.courts.length, Math.floor(ids.length / 2));
      const matches = [];
      for (let c = 0; c < courts; c++) matches.push(newMatch({ court: c, a: [ids[2 * c]], b: [ids[2 * c + 1]] }));
      t.rounds = [{ id: uid('r'), byes: ids.slice(2 * courts), startedAt: null, matches }];
      t.cur = 0;
    },
    planned(t) { return t.options.rounds; },
    // Sieger rücken einen Platz hoch, Verlierer einen runter; ganz oben bleiben Sieger, ganz unten Verlierer.
    nextRound(t) {
      const r = t.rounds[t.cur];
      const C = r.matches.length;
      const W = r.matches.map((m) => (m.w === 'a' ? m.a : m.b)[0]);
      const L = r.matches.map((m) => (m.w === 'a' ? m.b : m.a)[0]);
      let waiting = r.byes.slice();
      const pairs = [];
      for (let k = 0; k < C; k++) {
        if (k === 0) pairs.push([W[0], W[1]]);
        else if (k === C - 1) pairs.push([L[k - 1], L[k]]);
        else pairs.push([L[k - 1], W[k + 1]]);
      }
      // Unterster Platz: Verlierer tauscht mit dem ersten Wartenden.
      if (waiting.length) {
        const out = L[C - 1];
        pairs[C - 1] = pairs[C - 1].map((id) => (id === out ? waiting[0] : id));
        waiting = waiting.slice(1).concat(out);
      }
      return { id: uid('r'), byes: waiting, startedAt: null, matches: pairs.map((p, k) => newMatch({ court: k, a: [p[0]], b: [p[1]] })) };
    },
    addRound(t) { t.options.rounds = Math.max(t.options.rounds, t.rounds.length) + 1; }
  };

  const ENGINES = { rotation, ladder };

  /* ---------- Spielablauf ---------- */

  function findMatch(t, matchId) {
    for (const r of t.rounds) {
      const m = r.matches.find((x) => x.id === matchId);
      if (m) return { m, round: r };
    }
    return null;
  }

  function canEdit(t, matchId) {
    const f = findMatch(t, matchId);
    if (!f) return { ok: false, reason: 'Spiel nicht gefunden.' };
    const idx = t.rounds.indexOf(f.round);
    if (idx > t.cur) return { ok: false, reason: 'Diese Runde hat noch nicht begonnen.' };
    if (MODES[t.mode].engine === 'ladder' && idx < t.cur) return { ok: false, reason: 'Die Folgerunde ist schon eingeteilt. Nutze „Rückgängig“, um zurückzugehen.' };
    return { ok: true };
  }

  function touch(t) { t.updatedAt = new Date().toISOString(); }

  function setResult(t, matchId, score) {
    const ce = canEdit(t, matchId);
    if (!ce.ok) return { ok: false, error: ce.reason };
    const f = findMatch(t, matchId);
    const fmt = fmtOf(t);
    const chk = checkScore(fmt, score, allowDraw(t));
    if (chk.error) return { ok: false, error: chk.error };
    f.m.score = score;
    f.m.w = evalScore(fmt, score).w;
    f.m.at = new Date().toISOString();
    if (!f.round.startedAt) f.round.startedAt = new Date().toISOString();
    touch(t);
    return { ok: true, warn: chk.warn };
  }

  function clearResult(t, matchId) {
    const ce = canEdit(t, matchId);
    if (!ce.ok) return { ok: false, error: ce.reason };
    const { m } = findMatch(t, matchId);
    m.score = null; m.w = null; m.at = null;
    if (t.status === 'finished') { t.status = 'running'; t.finishedAt = null; }
    touch(t);
    return { ok: true };
  }

  const currentRound = (t) => t.rounds[t.cur] || null;
  const roundDone = (r) => !!r && r.matches.every((m) => m.w);

  function advance(t) {
    if (!roundDone(t.rounds[t.cur])) return { ok: false, error: 'Es fehlen noch Ergebnisse.' };
    const eng = ENGINES[MODES[t.mode].engine];
    if (t.cur + 1 >= eng.planned(t)) {
      t.status = 'finished'; t.finishedAt = new Date().toISOString(); t.timer.endsAt = null;
      touch(t);
      return { ok: true, finished: true };
    }
    if (t.cur + 1 >= t.rounds.length) t.rounds.push(eng.nextRound(t));
    t.cur++;
    t.timer = { dur: t.timer.dur, endsAt: null, left: null };
    touch(t);
    return { ok: true };
  }

  // Zusatzrunde, auch nach dem Ende; ist die aktuelle Runde fertig, geht es direkt weiter.
  function addRound(t) {
    if (t.status === 'finished') { t.status = 'running'; t.finishedAt = null; }
    ENGINES[MODES[t.mode].engine].addRound(t);
    touch(t);
    return roundDone(t.rounds[t.cur]) ? advance(t) : { ok: true };
  }

  function startRound(t) {
    const r = currentRound(t);
    if (r && !r.startedAt) r.startedAt = new Date().toISOString();
    touch(t);
  }

  function finish(t) {
    t.status = 'finished';
    t.finishedAt = new Date().toISOString();
    t.timer.endsAt = null;
    touch(t);
  }

  /* ---------- Teilnehmende ändern ---------- */

  function rename(t, id, name) {
    const e = ent(t, id);
    const n = String(name || '').trim();
    if (!e || !n) return { ok: false, error: 'Bitte einen Namen eingeben.' };
    if (t.entrants.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: 'Den Namen gibt es schon.' };
    e.name = n;
    touch(t);
    return { ok: true };
  }

  // Nur bei wechselnden Partnern sinnvoll: feste Paarungen (Team-Turnier, Leiter) bleiben unangetastet.
  const rosterEditable = (t) => t.status === 'running' && MODES[t.mode].unit === 'player';

  function addEntrant(t, person) {
    const p = cleanPerson(person || {});
    if (!p.name) return { ok: false, error: 'Bitte einen Namen eingeben.' };
    if (!rosterEditable(t)) return { ok: false, error: 'In diesem Modus lassen sich nur Namen ändern.' };
    if (t.entrants.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) return { ok: false, error: 'Den Namen gibt es schon.' };
    t.entrants.push(Object.assign({ id: uid('e'), active: true }, p));
    rotation.regenerate(t);
    touch(t);
    return { ok: true };
  }

  function setActive(t, id, active) {
    const e = ent(t, id);
    if (!e) return { ok: false, error: 'Nicht gefunden.' };
    if (!rosterEditable(t)) return { ok: false, error: 'In diesem Modus lassen sich nur Namen ändern.' };
    if (!active && t.entrants.filter((x) => x.active !== false && x.id !== id).length < MODES[t.mode].min) {
      return { ok: false, error: `Mindestens ${MODES[t.mode].min} müssen dabei bleiben.` };
    }
    e.active = !!active;
    rotation.regenerate(t);
    touch(t);
    return { ok: true };
  }

  /* ---------- Tabellen ---------- */

  function tally(t) {
    const fmt = fmtOf(t);
    const rows = new Map();
    const get = (id) => { if (!rows.has(id)) rows.set(id, { id, played: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0 }); return rows.get(id); };
    t.rounds.forEach((r) => r.matches.forEach((m) => {
      const res = m.w && evalScore(fmt, m.score);
      if (!res) return;
      const apply = (ids, mine, other, side) => ids.forEach((id) => {
        const x = get(id);
        x.played++; x.pf += mine; x.pa += other;
        if (res.w === 'd') x.d++; else if (res.w === side) x.w++; else x.l++;
      });
      apply(m.a, res.pa, res.pb, 'a');
      apply(m.b, res.pb, res.pa, 'b');
    }));
    return get;
  }

  function withRanks(rows, cmp) {
    rows.sort((x, y) => cmp(x, y) || x.name.localeCompare(y.name, 'de'));
    rows.forEach((r, i) => { r.rank = i > 0 && cmp(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; });
    return rows;
  }

  function rotationStandings(t) {
    const get = tally(t);
    const counted = t.rounds.slice(0, t.status === 'finished' ? t.rounds.length : t.cur + (roundDone(t.rounds[t.cur]) ? 1 : 0));
    const rows = t.entrants.filter((e) => e.active !== false || get(e.id).played > 0).map((e) => {
      const x = get(e.id);
      x.name = e.name; x.active = e.active !== false;
      x.byes = counted.filter((r) => r.byes.includes(e.id)).length;
      x.bonus = t.options.byePoints !== 'none' && x.byes && x.played ? Math.round((x.pf / x.played) * x.byes) : 0;
      x.total = x.pf + x.bonus;
      x.diff = x.pf - x.pa;
      return x;
    });
    const unit = fmtOf(t).kind === 'games' ? 'Games' : 'Punkte';
    const cmp = (x, y) => y.total - x.total || (y.w + y.d / 2) - (x.w + x.d / 2) || y.diff - x.diff;
    return {
      cols: [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S' }, { k: 'diff', h: '+/−' }, { k: 'total', h: unit === 'Punkte' ? 'Pkt' : unit, strong: true }],
      rows: withRanks(rows, cmp),
      note: `Reihenfolge: ${unit}, dann Siege, dann Differenz.` + (rows.some((r) => r.bonus) ? ' Pausen zählen mit dem eigenen Schnitt pro Spiel.' : '')
    };
  }

  function ladderStandings(t) {
    const C = t.courts.length;
    const get = tally(t);
    const done = t.rounds.filter((r) => r.matches.length && roundDone(r));
    const last = done[done.length - 1];
    const pos = new Map(), court = new Map(), cp = new Map();
    t.rounds.forEach((r) => r.matches.forEach((m) => {
      if (m.w) { const id = (m.w === 'a' ? m.a : m.b)[0]; cp.set(id, (cp.get(id) || 0) + (C - m.court)); }
    }));
    const r = last || t.rounds[0];
    r.matches.forEach((m) => {
      const W = last ? (m.w === 'a' ? m.a : m.b)[0] : m.a[0];
      const L = last ? (m.w === 'a' ? m.b : m.a)[0] : m.b[0];
      pos.set(W, 2 * m.court); pos.set(L, 2 * m.court + (last ? 1 : 0));
      court.set(W, m.court); court.set(L, m.court);
    });
    r.byes.forEach((id, i) => pos.set(id, 2 * C + i));
    const byPoints = t.options.ranking === 'points';
    const rows = t.entrants.map((e) => Object.assign(get(e.id), {
      name: e.name, pos: pos.has(e.id) ? pos.get(e.id) : 999, cp: cp.get(e.id) || 0,
      courtLabel: court.has(e.id) ? t.courts[court.get(e.id)] : 'wartet'
    }));
    const cmp = byPoints ? (x, y) => y.cp - x.cp || y.w - x.w || x.pos - y.pos : (x, y) => x.pos - y.pos || y.w - x.w || y.cp - x.cp;
    return {
      cols: [{ k: 'courtLabel', h: 'Platz', text: true }, { k: 'w', h: 'S' }, { k: 'cp', h: 'Pkt', strong: byPoints }],
      rows: withRanks(rows, cmp),
      note: byPoints
        ? `Ein Sieg auf ${t.courts[0]} bringt ${C} Punkte, jeder Platz darunter einen weniger.`
        : `Es zählt die Position nach der letzten Runde: oben ist ${t.courts[0]}. Gleichstand: Siege, dann Platzpunkte.`
    };
  }

  const standings = (t) => (MODES[t.mode].engine === 'ladder' ? ladderStandings(t) : rotationStandings(t));

  function podium(t) {
    const rows = standings(t).rows;
    return [1, 2, 3].map((rank) => rows.filter((r) => r.rank === rank).map((r) => r.name)).filter((x) => x.length);
  }

  /* ---------- Was kommt als Nächstes? ---------- */

  function next(t) {
    if (t.status === 'finished') {
      const p = podium(t);
      return { state: 'done', title: 'Turnier beendet', text: p.length ? `Sieg: ${p[0].join(', ')}` : 'Alle Ergebnisse sind drin.', action: null };
    }
    const eng = ENGINES[MODES[t.mode].engine];
    const r = t.rounds[t.cur];
    const planned = eng.planned(t);
    const no = t.cur + 1;
    const open = r.matches.filter((x) => !x.w);
    if (!r.startedAt && open.length === r.matches.length) {
      return { state: 'ready', title: `Runde ${no} von ${planned}`, text: 'Alle auf ihre Plätze. Dann die Runde starten.', action: { id: 'start', label: roundTimed(t) ? 'Runde starten & Timer los' : 'Runde starten' } };
    }
    if (open.length) {
      return {
        state: 'live', title: `Runde ${no} läuft`,
        text: open.length === r.matches.length ? 'Ergebnisse nach Spielende eintragen.' : `Noch ${open.length} von ${r.matches.length} Ergebnissen offen.`,
        action: { id: 'result', match: open[0].id, label: `Ergebnis ${t.courts[open[0].court]}` }
      };
    }
    if (no >= planned) return { state: 'last', title: 'Letzte Runde komplett', text: 'Alle Ergebnisse sind drin.', action: { id: 'advance', label: 'Turnier abschließen' }, alt: { id: 'addRound', label: 'Zusatzrunde' } };
    const m = MODES[t.mode];
    return {
      state: 'between', title: `Runde ${no} komplett`,
      text: m.engine === 'ladder' ? 'Sieger steigen auf, Verlierer steigen ab.' : m.pairing === 'dynamic' ? 'Die nächste Runde wird nach der Tabelle gepaart.' : 'Weiter mit der nächsten Runde.',
      action: { id: 'advance', label: `Runde ${no + 1} einteilen` }
    };
  }

  /* ---------- Schätzung & Kurzinfos ---------- */

  function estimate(cfg) {
    const m = MODES[cfg.mode];
    if (!m) return null;
    const n = validEntrants(cfg.entrants).length;
    const C = Math.max(1, Number(cfg.courts) || 1);
    const fmt = FORMATS[cfg.format] || FORMATS.win;
    const opt = cfg.options || {};
    const minutes = Number(opt.roundMinutes) || 0;
    const per = (fmt.timed || m.engine === 'ladder' ? minutes || 12 : minutes ? Math.min(minutes, fmt.min) : fmt.min) + 2;
    let rounds = Number(opt.rounds) || defaultRounds(cfg) || 0;
    if (m.pairing === 'circle') {
      const perRound = Math.min(C, Math.floor(n / 2));
      rounds = perRound ? Math.ceil((n * (n - 1)) / 2 / perRound) : 0;
    }
    return { rounds, minutes: rounds * per };
  }

  function serveHint(fmt) {
    if (!fmt || !fmt.total) return null;
    const each = fmt.total / 4;
    if (!Number.isInteger(each)) return `Aufschlag reihum. ${fmt.total} ist nicht durch 4 teilbar: eine Person schlägt einmal mehr auf.`;
    const block = each % 4 === 0 ? 4 : each % 2 === 0 ? 2 : each;
    return `Aufschlag: jede Person ${each}×, immer ${block} am Stück, dann wechseln.`;
  }

  function shareText(t, what) {
    const lines = [];
    const fmt = fmtOf(t);
    if (what === 'round') {
      const r = currentRound(t);
      lines.push(`${t.name} – Runde ${t.cur + 1}`);
      r.matches.forEach((m) => lines.push(`${t.courts[m.court]}: ${sideName(t, m.a)} – ${sideName(t, m.b)}${m.score ? '  ' + (scoreText(fmt, m.score) || 'Sieg: ' + sideName(t, m.w === 'a' ? m.a : m.b)) : ''}`));
      if (r.byes.length) lines.push(`${MODES[t.mode].engine === 'ladder' ? 'Wartet' : 'Pause'}: ${r.byes.map((id) => nameOf(t, id)).join(', ')}`);
    } else {
      const st = standings(t);
      const strong = st.cols.find((c) => c.strong);
      lines.push(`${t.name} – ${t.status === 'finished' ? 'Endstand' : 'Zwischenstand'}`);
      st.rows.forEach((r) => lines.push(`${r.rank}. ${r.name}${strong ? '  ' + r[strong.k] + ' ' + strong.h : ''}`));
    }
    return lines.join('\n');
  }

  return {
    SPORTS, RULES, FORMATS, MODES, LEVELS,
    formatsFor, defaultFormat, modeAvailable, defaultRounds, estimate, serveHint,
    parseRating, strengthOf, levelLabel, levelFromRating, buildTeams,
    evalScore, checkScore, scoreText,
    validateConfig, unitNoun, create,
    fmtOf, roundTimed, allowDraw, hasStrength,
    nameOf, sideName, ent,
    findMatch, canEdit, setResult, clearResult,
    advance, addRound, startRound, finish, currentRound, roundDone,
    rename, rosterEditable, addEntrant, setActive,
    standings, podium, next, shareText,
    _internal: { circlePairs, genAmericanoRounds }
  };
});
