/* Courtside – Turnier-Engine.
 * Reine Logik ohne DOM: Formate, Modi, Auslosung, Wertung, „Was kommt als Nächstes“.
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
  const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;
  const nextPow2 = (n) => { let p = 1; while (p < n) p *= 2; return p; };

  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Sportarten, Formate, Modi ---------- */

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

  // kind: points | games | sets | winner. min = geschätzte Spielminuten.
  const FORMATS = {
    p16: { kind: 'points', total: 16, name: '16 Punkte gesamt', short: '16 Pkt.', min: 9 },
    p21: { kind: 'points', total: 21, name: '21 Punkte gesamt', short: '21 Pkt.', min: 11 },
    p24: { kind: 'points', total: 24, name: '24 Punkte gesamt', short: '24 Pkt.', min: 13 },
    p32: { kind: 'points', total: 32, name: '32 Punkte gesamt', short: '32 Pkt.', min: 17 },
    pTime: { kind: 'points', timed: true, name: 'Punkte auf Zeit', short: 'Punkte/Zeit', min: 12 },
    gTime: { kind: 'games', timed: true, name: 'Games auf Zeit', short: 'Games/Zeit', min: 15 },
    r11: { kind: 'points', target: 11, winBy: 2, name: 'Spiel bis 11, 2 Punkte Vorsprung', short: 'bis 11', min: 15 },
    r15: { kind: 'points', target: 15, winBy: 2, name: 'Spiel bis 15, 2 Punkte Vorsprung', short: 'bis 15', min: 20 },
    r21: { kind: 'points', target: 21, winBy: 2, name: 'Rally Scoring bis 21', short: 'bis 21', min: 20 },
    tb10: { kind: 'points', target: 10, winBy: 2, name: 'Match-Tiebreak bis 10', short: 'MTB 10', min: 8 },
    g4: { kind: 'games', target: 4, name: 'Kurzsatz bis 4 (Fast4)', short: 'Satz bis 4', min: 20 },
    g6: { kind: 'games', target: 6, name: '1 Satz bis 6, Tiebreak bei 6:6', short: '1 Satz', min: 35 },
    g8: { kind: 'games', target: 8, name: 'Pro-Satz bis 8', short: 'Pro-Satz 8', min: 45 },
    g9: { kind: 'games', target: 9, name: 'Pro-Satz bis 9', short: 'Pro-Satz 9', min: 50 },
    s3: { kind: 'sets', bestOf: 3, setTo: 6, superTB: false, name: '2 Gewinnsätze', short: 'Best of 3', min: 85 },
    s3tb: { kind: 'sets', bestOf: 3, setTo: 6, superTB: true, name: '2 Gewinnsätze, 3. Satz Match-Tiebreak', short: '2 Sätze + MTB', min: 70 },
    s3f4: { kind: 'sets', bestOf: 3, setTo: 4, superTB: true, name: 'Fast4: 2 Gewinnsätze bis 4, sonst Match-Tiebreak', short: 'Fast4 Bo3', min: 45 },
    pb3: { kind: 'sets', bestOf: 3, setTo: 11, pointSets: true, name: '2 Gewinnspiele bis 11', short: 'Bo3 bis 11', min: 40 },
    win: { kind: 'winner', name: 'Nur Sieger antippen', short: 'Sieg', min: 12 }
  };

  const F_ROT = { padel: ['p24', 'p16', 'p21', 'p32', 'pTime', 'gTime'], pickleball: ['r11', 'r15', 'r21', 'pTime'], tennis: ['g4', 'g6', 'tb10', 'gTime'] };
  const F_MATCH = { padel: ['g6', 'g9', 's3tb', 's3', 'p24', 'tb10'], pickleball: ['r11', 'r15', 'r21', 'pb3'], tennis: ['g4', 'g6', 'g8', 's3f4', 's3tb', 's3', 'tb10'] };
  const F_KOTC = { padel: ['win', 'pTime', 'gTime'], pickleball: ['win', 'r11', 'pTime'], tennis: ['win', 'gTime', 'g4'] };
  const F_QUEUE = { padel: ['win', 'p16', 'g4'], pickleball: ['win', 'r11', 'r15'], tennis: ['win', 'g4', 'tb10'] };

  // engine: rotation | ladder | queue | rally | pool
  const MODES = {
    americano: { engine: 'rotation', unit: 'player', pairing: 'fixed', doublesOnly: true, min: 4, formats: F_ROT, timed: 'auto' },
    mexicano: { engine: 'rotation', unit: 'player', pairing: 'dynamic', doublesOnly: true, min: 4, formats: F_ROT, timed: 'auto' },
    mixed: { engine: 'rotation', unit: 'player', pairing: 'fixed', mixed: true, doublesOnly: true, min: 4, formats: F_ROT, timed: 'auto' },
    team_americano: { engine: 'rotation', unit: 'team', pairing: 'circle', min: 3, formats: F_ROT, timed: 'auto' },
    team_mexicano: { engine: 'rotation', unit: 'team', pairing: 'dynamic', min: 4, formats: F_ROT, timed: 'auto' },
    kotc: { engine: 'ladder', unit: 'team', min: 4, formats: F_KOTC, timed: 'always' },
    winner_stays: { engine: 'queue', unit: 'team', min: 3, formats: F_QUEUE },
    rally_king: { engine: 'rally', unit: 'team', min: 3, formats: null },
    round_robin: { engine: 'pool', structure: 'rr', unit: 'team', min: 3, formats: F_MATCH },
    knockout: { engine: 'pool', structure: 'ko', unit: 'team', min: 2, formats: F_MATCH, noDraw: true },
    groups_ko: { engine: 'pool', structure: 'groups', unit: 'team', min: 6, formats: F_MATCH },
    compass: { engine: 'pool', structure: 'compass', unit: 'team', min: 5, max: 16, formats: F_MATCH, noDraw: true }
  };

  const DEFAULT_FORMAT = {
    rotation: { padel: 'p24', pickleball: 'r11', tennis: 'g4' },
    ladder: { padel: 'win', pickleball: 'win', tennis: 'win' },
    queue: { padel: 'win', pickleball: 'win', tennis: 'win' },
    rr: { padel: 'g6', pickleball: 'r11', tennis: 'g4' },
    ko: { padel: 's3tb', pickleball: 'r11', tennis: 's3tb' },
    groups: { padel: 'g6', pickleball: 'r11', tennis: 'g4' },
    compass: { padel: 'g6', pickleball: 'r11', tennis: 'g8' }
  };

  function formatsFor(modeId, sport) {
    const m = MODES[modeId];
    return m && m.formats ? m.formats[sport] || [] : [];
  }
  function defaultFormat(modeId, sport) {
    const m = MODES[modeId];
    if (!m || !m.formats) return null;
    const key = m.engine === 'pool' ? m.structure : m.engine;
    const f = (DEFAULT_FORMAT[key] || {})[sport];
    return formatsFor(modeId, sport).includes(f) ? f : formatsFor(modeId, sport)[0];
  }
  function modeAvailable(modeId, sport, discipline) {
    const m = MODES[modeId];
    if (!m) return false;
    if (m.doublesOnly && discipline === 'singles') return false;
    if (modeId === 'kotc' && discipline === 'singles') return true;
    return true;
  }

  /* ---------- Ergebnisse ---------- */

  // Einheitliche Auswertung: w = 'a' | 'b' | 'd', pa/pb = Punkte bzw. Games, sa/sb = Sätze.
  function evalScore(fmt, s) {
    if (!s) return null;
    if (fmt.kind === 'winner') {
      if (s.w !== 'a' && s.w !== 'b') return null;
      return { w: s.w, pa: s.w === 'a' ? 1 : 0, pb: s.w === 'b' ? 1 : 0, sa: 0, sb: 0 };
    }
    if (fmt.kind === 'points' || fmt.kind === 'games') {
      const a = Number(s.a), b = Number(s.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { w: a > b ? 'a' : b > a ? 'b' : 'd', pa: a, pb: b, sa: 0, sb: 0 };
    }
    if (fmt.kind === 'sets') {
      let sa = 0, sb = 0, ga = 0, gb = 0;
      const sets = Array.isArray(s.sets) ? s.sets : [];
      sets.forEach(([x, y], i) => {
        x = Number(x) || 0; y = Number(y) || 0;
        if (x > y) sa++; else if (y > x) sb++;
        const decider = fmt.superTB && i === fmt.bestOf - 1;
        if (decider) { if (x > y) ga++; else if (y > x) gb++; } // Match-Tiebreak zählt als ein Game
        else { ga += x; gb += y; }
      });
      if (!sets.length) return null;
      return { w: sa > sb ? 'a' : sb > sa ? 'b' : 'd', pa: ga, pb: gb, sa, sb };
    }
    return null;
  }

  // Prüft eine Eingabe. error blockiert das Speichern, warn ist nur ein Hinweis.
  function checkScore(fmt, s, allowDraw) {
    const r = evalScore(fmt, s);
    if (!r) return { error: 'Bitte ein Ergebnis eingeben.' };
    if (fmt.kind === 'points' && fmt.total && r.pa + r.pb !== fmt.total) {
      return { error: `Zusammen müssen es ${fmt.total} Punkte sein.` };
    }
    if (fmt.kind === 'sets') {
      const need = Math.ceil(fmt.bestOf / 2);
      const sets = s.sets;
      let a = 0, b = 0;
      for (let i = 0; i < sets.length; i++) {
        const [x, y] = sets[i].map(Number);
        if (x === y) return { error: `Satz ${i + 1} braucht einen Sieger.` };
        if (a === need || b === need) return { error: 'Nach dem entscheidenden Satz folgt kein weiterer.' };
        if (x > y) a++; else b++;
      }
      if (a !== need && b !== need) return { error: `Es fehlt noch ein Satz bis ${need} Gewinnsätze.` };
    }
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

  function scoreText(fmt, s) {
    if (!s) return '';
    if (fmt.kind === 'winner') return '';
    if (fmt.kind === 'sets') return (s.sets || []).map(([x, y]) => `${x}:${y}`).join('  ');
    return `${s.a}:${s.b}`;
  }

  /* ---------- Turnier anlegen ---------- */

  function validateConfig(cfg) {
    const m = MODES[cfg.mode];
    if (!m) return 'Unbekannter Modus.';
    const ents = (cfg.entrants || []).filter((e) => e && String(e.name || '').trim());
    const unitWord = unitNoun(cfg, true);
    if (ents.length < m.min) return `Dieser Modus braucht mindestens ${m.min} ${unitWord}.`;
    if (m.max && ents.length > m.max) return `Dieser Modus ist für höchstens ${m.max} ${unitWord} ausgelegt.`;
    const names = ents.map((e) => e.name.trim().toLowerCase());
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) return `„${ents[names.indexOf(dup)].name.trim()}“ steht doppelt in der Liste.`;
    const courts = Number(cfg.courts) || 1;
    if (m.engine === 'rotation' && m.unit === 'player') {
      if (m.mixed) {
        const A = ents.filter((e) => e.group === 'A').length;
        const B = ents.filter((e) => e.group === 'B').length;
        if (A + B !== ents.length) return 'Bitte jede Person einer Gruppe zuordnen.';
        if (A < 2 || B < 2) return 'Mixed braucht mindestens 2 Personen je Gruppe.';
      }
    }
    if (m.engine === 'ladder') {
      const per = cfg.options && cfg.options.swap ? 4 : 2;
      if (courts < 2) return 'King of the Court braucht mindestens 2 Plätze, damit es Auf- und Abstieg gibt.';
      if (ents.length < per * 2) return `King of the Court braucht mindestens ${per * 2} ${unitWord} für zwei Plätze.`;
    }
    if (m.engine === 'pool' && m.structure === 'groups') {
      const g = Number(cfg.options && cfg.options.groups) || 2;
      const adv = Number(cfg.options && cfg.options.advance) || 2;
      if (ents.length < g * 3) return `Bei ${g} Gruppen braucht es mindestens ${g * 3} ${unitWord}.`;
      if (adv * g < 2) return 'Mindestens zwei müssen weiterkommen.';
      if (adv >= Math.floor(ents.length / g)) return 'Es kommen zu viele pro Gruppe weiter.';
    }
    if (m.formats && !formatsFor(cfg.mode, cfg.sport).includes(cfg.format)) return 'Bitte eine Zählweise wählen.';
    return null;
  }

  function unitNoun(cfg, plural) {
    const m = MODES[cfg.mode] || {};
    const player = (m.unit === 'player') || (cfg.mode === 'kotc' && cfg.options && cfg.options.swap) || cfg.discipline === 'singles';
    if (player) return plural ? 'Personen' : 'Person';
    return plural ? 'Teams' : 'Team';
  }

  function isPlayerUnit(t) {
    const m = MODES[t.mode];
    return m.unit === 'player' || (t.mode === 'kotc' && t.options.swap);
  }

  function create(cfg) {
    const err = validateConfig(cfg);
    if (err) throw new Error(err);
    const m = MODES[cfg.mode];
    const courts = clamp(Number(cfg.courts) || 1, 1, 32);
    const t = {
      v: 1,
      id: uid('t'),
      name: String(cfg.name || '').trim() || 'Turnier',
      sport: cfg.sport,
      mode: cfg.mode,
      discipline: SPORTS[cfg.sport].singles ? cfg.discipline || 'doubles' : 'doubles',
      format: m.formats ? cfg.format : null,
      rules: Object.assign({}, cfg.rules || {}),
      options: Object.assign({}, cfg.options || {}),
      courts: Array.from({ length: courts }, (_, i) => String((cfg.courtNames && cfg.courtNames[i]) || `Platz ${i + 1}`)),
      entrants: cfg.entrants
        .filter((e) => e && String(e.name || '').trim())
        .map((e) => ({ id: uid('e'), name: String(e.name).trim(), group: e.group || null, active: true })),
      rounds: [],
      matches: [],
      cur: 0,
      status: 'running',
      timer: { dur: 0, endsAt: null, left: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demo: !!cfg.demo
    };
    if (t.options.seeding === 'random') t.entrants = shuffle(t.entrants);
    const ENG = ENGINES[m.engine];
    ENG.init(t);
    if (roundTimed(t)) t.timer.dur = (Number(t.options.roundMinutes) || 12) * 60;
    return t;
  }

  function fmtOf(t) { return t.format ? FORMATS[t.format] : FORMATS.win; }
  function roundTimed(t) {
    const m = MODES[t.mode];
    if (m.engine !== 'rotation' && m.engine !== 'ladder') return false;
    if (m.timed === 'always') return Number(t.options.roundMinutes) > 0;
    return fmtOf(t).timed || Number(t.options.roundMinutes) > 0;
  }
  function allowDraw(t, match) {
    const m = MODES[t.mode];
    if (m.noDraw) return false;
    if (m.engine === 'ladder' || m.engine === 'queue') return false;
    if (m.engine === 'pool' && match && match.stage !== 'rr' && match.stage !== 'group') return false;
    return true;
  }

  /* ---------- Namen ---------- */

  function ent(t, id) { return t.entrants.find((e) => e.id === id); }
  function nameOf(t, id) { const e = ent(t, id); return e ? e.name : '–'; }
  function sideName(t, ids) {
    if (!ids) return 'offen';
    if (ids === 'BYE') return 'Freilos';
    return ids.map((id) => nameOf(t, id)).join(' & ');
  }
  function activeIds(t) { return t.entrants.filter((e) => e.active !== false).map((e) => e.id); }

  function newMatch(fields) {
    return Object.assign({ id: uid('m'), a: null, b: null, score: null, w: null, court: null }, fields);
  }

  function setScore(t, match, score) {
    const fmt = fmtOf(t);
    const chk = checkScore(fmt, score, allowDraw(t, match));
    if (chk.error) return { ok: false, error: chk.error };
    match.score = score;
    match.w = evalScore(fmt, score).w;
    match.at = new Date().toISOString();
    return { ok: true, warn: chk.warn };
  }

  /* ================================================================
   * Rotation: Americano, Mexicano, Mixed, Team-Americano, Team-Mexicano
   * ================================================================ */

  function historyStats(rounds) {
    const P = new Map(), O = new Map(), byes = new Map(), lastBye = new Map(), played = new Map();
    const inc = (map, k, v = 1) => map.set(k, (map.get(k) || 0) + v);
    rounds.forEach((r, ri) => {
      r.byes.forEach((id) => { inc(byes, id); lastBye.set(id, ri); });
      r.matches.forEach((m) => {
        const all = m.a.concat(m.b);
        all.forEach((id) => inc(played, id));
        if (m.a.length === 2) inc(P, pk(m.a[0], m.a[1]));
        if (m.b.length === 2) inc(P, pk(m.b[0], m.b[1]));
        m.a.forEach((x) => m.b.forEach((y) => inc(O, pk(x, y))));
      });
    });
    return { P, O, byes, lastBye, played, roundCount: rounds.length };
  }

  // Wer setzt aus? Wer bisher am seltensten pausiert hat, am längsten nicht.
  function chooseByes(ids, count, st, rnd) {
    if (count <= 0) return [];
    const order = shuffle(ids, rnd).sort((x, y) =>
      (st.byes.get(x) || 0) - (st.byes.get(y) || 0) ||
      (st.lastBye.has(x) ? st.lastBye.get(x) : -1) - (st.lastBye.has(y) ? st.lastBye.get(y) : -1));
    return order.slice(0, count);
  }

  const W_PARTNER = 1000, W_OPP = 12;
  function courtCost(st, p) {
    const g = (m, x, y) => m.get(pk(x, y)) || 0;
    return W_PARTNER * (g(st.P, p[0], p[1]) + g(st.P, p[2], p[3])) +
      W_OPP * (g(st.O, p[0], p[2]) + g(st.O, p[0], p[3]) + g(st.O, p[1], p[2]) + g(st.O, p[1], p[3]));
  }

  // Ordnet Spielende auf Plätze/Teams: zufälliger Start + Tauschen, solange es besser wird.
  function arrangeRound(players, groupOf, st, rnd, restarts) {
    const courts = players.length / 4;
    let best = null, bestCost = Infinity;
    for (let s = 0; s < restarts; s++) {
      let pos;
      if (groupOf) {
        const A = shuffle(players.filter((p) => groupOf(p) === 'A'), rnd);
        const B = shuffle(players.filter((p) => groupOf(p) === 'B'), rnd);
        pos = [];
        for (let c = 0; c < courts; c++) pos.push(A[2 * c], B[2 * c], A[2 * c + 1], B[2 * c + 1]);
      } else pos = shuffle(players, rnd);
      const cost = [];
      for (let c = 0; c < courts; c++) cost[c] = courtCost(st, pos.slice(4 * c, 4 * c + 4));
      let improved = true, guard = 0;
      while (improved && guard++ < 50) {
        improved = false;
        for (let i = 0; i < pos.length; i++) {
          for (let j = i + 1; j < pos.length; j++) {
            const ci = i >> 2, cj = j >> 2;
            if (groupOf && groupOf(pos[i]) !== groupOf(pos[j])) continue;
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

  function cloneStats(st) {
    return { P: new Map(st.P), O: new Map(st.O), byes: new Map(st.byes), lastBye: new Map(st.lastBye), played: new Map(st.played), roundCount: st.roundCount };
  }

  // Erzeugt count Americano-Runden im Anschluss an history. Mehrere Durchläufe, der beste gewinnt.
  function genAmericanoRounds(t, history, count, budgetMs = 300) {
    const ids = activeIds(t);
    const mixed = MODES[t.mode].mixed;
    const groupOf = mixed ? (id) => ent(t, id).group : null;
    const base = historyStats(history);
    const deadline = clock() + budgetMs;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const st = cloneStats(base);
      const rounds = [];
      let total = 0;
      for (let r = 0; r < count; r++) {
        let playing, byes;
        if (mixed) {
          const A = ids.filter((id) => groupOf(id) === 'A'), B = ids.filter((id) => groupOf(id) === 'B');
          const perGroup = 2 * Math.min(t.courts.length, Math.floor(Math.min(A.length, B.length) / 2));
          byes = chooseByes(A, A.length - perGroup, st).concat(chooseByes(B, B.length - perGroup, st));
        } else {
          const courts = Math.min(t.courts.length, Math.floor(ids.length / 4));
          byes = chooseByes(ids, ids.length - courts * 4, st);
        }
        playing = ids.filter((id) => !byes.includes(id));
        const { pos, cost } = arrangeRound(playing, groupOf, st, Math.random, 6);
        total += cost;
        const courtOrder = shuffle([...Array(pos.length / 4).keys()]);
        const round = {
          id: uid('r'), byes, startedAt: null,
          matches: courtOrder.map((c, k) => newMatch({ court: k, a: [pos[4 * c], pos[4 * c + 1]], b: [pos[4 * c + 2], pos[4 * c + 3]] }))
        };
        round.matches.sort((x, y) => x.court - y.court);
        applyRound(st, round, base.roundCount + r);
        rounds.push(round);
      }
      if (!best || total < best.total) best = { rounds, total };
      if (attempt >= 2 && clock() > deadline) break;
    }
    return best.rounds;
  }

  function rankOrder(t) {
    return standings(t).rows.map((r) => r.id);
  }

  function genMexicanoRound(t) {
    const ids = activeIds(t);
    const st = historyStats(t.rounds);
    const first = t.rounds.length === 0;
    const team = MODES[t.mode].unit === 'team';
    let order;
    if (first) order = t.options.firstRound === 'order' ? ids.slice() : shuffle(ids);
    else order = rankOrder(t).filter((id) => ids.includes(id));
    const perCourt = team ? 2 : 4;
    const courts = Math.min(t.courts.length, Math.floor(ids.length / perCourt));
    const byes = chooseByes(ids, ids.length - courts * perCourt, st);
    const playing = order.filter((id) => !byes.includes(id));
    const last = t.rounds[t.rounds.length - 1];
    const lastPartner = new Map(), lastOpp = new Map();
    if (last) last.matches.forEach((m) => {
      if (m.a.length === 2) { lastPartner.set(m.a[0], m.a[1]); lastPartner.set(m.a[1], m.a[0]); lastPartner.set(m.b[0], m.b[1]); lastPartner.set(m.b[1], m.b[0]); }
      if (m.a.length === 1) { lastOpp.set(m.a[0], m.b[0]); lastOpp.set(m.b[0], m.a[0]); }
    });
    const matches = [];
    if (team) {
      // 1 gegen 2, 3 gegen 4 … – direkte Revanche aus der Vorrunde wird vermieden.
      const q = playing.slice();
      for (let c = 0; c < courts; c++) {
        const a = q.shift();
        let k = q.findIndex((x) => lastOpp.get(a) !== x);
        if (k < 0 || k > 1) k = 0;
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
    while (queue.length) {
      const used = new Set(), picked = [];
      // Teams, die länger warten, kommen zuerst dran.
      const order = queue.map((p, i) => ({ p, i, wait: Math.min(lastPlayed.has(p[0]) ? lastPlayed.get(p[0]) : -1, lastPlayed.has(p[1]) ? lastPlayed.get(p[1]) : -1) }))
        .sort((x, y) => x.wait - y.wait || x.i - y.i);
      for (const o of order) {
        if (picked.length >= t.courts.length) break;
        if (used.has(o.p[0]) || used.has(o.p[1])) continue;
        used.add(o.p[0]); used.add(o.p[1]);
        picked.push(o);
      }
      picked.sort((x, y) => x.i - y.i);
      for (const o of picked.slice().sort((x, y) => y.i - x.i)) queue.splice(o.i, 1);
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
    const n = (cfg.entrants || []).filter((e) => e && String(e.name || '').trim()).length;
    const fmt = FORMATS[cfg.format] || FORMATS.win;
    const per = (fmt.timed || m.engine === 'ladder' ? Number(cfg.options && cfg.options.roundMinutes) || 12 : fmt.min) + 2;
    const fit = Math.max(3, Math.floor(120 / per));
    if (m.engine === 'ladder') return clamp(Math.floor(90 / per), 3, 20);
    if (m.pairing === 'circle') return null;
    if (m.mixed) {
      const A = cfg.entrants.filter((e) => e && e.group === 'A' && String(e.name || '').trim()).length;
      const B = cfg.entrants.filter((e) => e && e.group === 'B' && String(e.name || '').trim()).length;
      return clamp(Math.min(Math.max(A, B) || 4, fit), 3, 30);
    }
    if (m.pairing === 'fixed') return clamp(Math.min(Math.max(n - 1, 3), fit), 3, 30);
    return clamp(Math.min(fit, 8), 3, 30);
  }

  const rotation = {
    init(t) {
      const m = MODES[t.mode];
      if (!t.options.rounds && m.pairing !== 'circle') t.options.rounds = defaultRounds(t);
      if (m.pairing === 'fixed') t.rounds = genAmericanoRounds(t, [], t.options.rounds);
      else if (m.pairing === 'circle') { t.rounds = genCircleRounds(t); t.options.rounds = t.rounds.length; }
      else t.rounds = [genMexicanoRound(t)];
      t.cur = 0;
    },
    plannedRounds(t) { return MODES[t.mode].pairing === 'circle' ? t.rounds.length : t.options.rounds; },
    currentRound(t) { return t.rounds[t.cur] || null; },
    canAdvance(t) { const r = t.rounds[t.cur]; return !!r && r.matches.every((m) => m.w); },
    advance(t) {
      if (!this.canAdvance(t)) return { ok: false, error: 'Es fehlen noch Ergebnisse.' };
      const planned = this.plannedRounds(t);
      if (t.cur + 1 >= planned) { t.status = 'finished'; t.finishedAt = new Date().toISOString(); return { ok: true, finished: true }; }
      if (t.cur + 1 >= t.rounds.length) {
        if (MODES[t.mode].pairing === 'fixed') t.rounds.push(...genAmericanoRounds(t, t.rounds, 1, 150));
        else t.rounds.push(genMexicanoRound(t));
      }
      t.cur++;
      return { ok: true };
    },
    addRound(t) {
      const m = MODES[t.mode];
      if (m.pairing === 'circle') {
        // Zusatzrunde: Paarung nach aktueller Tabelle (1–2, 3–4 …).
        t.options.rounds = t.rounds.length + 1;
        const r = genMexicanoRound(t);
        t.rounds.push(r);
        return;
      }
      t.options.rounds = Math.max(t.options.rounds, t.rounds.length) + 1;
      if (m.pairing === 'fixed') t.rounds.push(...genAmericanoRounds(t, t.rounds, 1, 150));
    },
    regenerate(t) {
      const m = MODES[t.mode];
      const r = t.rounds[t.cur];
      const untouched = r && !r.startedAt && r.matches.every((x) => !x.score);
      const keep = untouched ? t.cur : t.cur + 1;
      const history = t.rounds.slice(0, keep);
      if (m.pairing === 'fixed') {
        const remaining = Math.max(0, t.options.rounds - keep);
        t.rounds = history.concat(genAmericanoRounds(t, history, remaining));
      } else if (m.pairing === 'dynamic') {
        t.rounds = history;
        if (untouched) t.rounds.push(genMexicanoRound(t));
      }
    }
  };

  /* ================================================================
   * Leiter: King of the Court (Auf- und Abstieg über mehrere Plätze)
   * ================================================================ */

  function ladderSplit(t, four, st, lastPartners) {
    // drei mögliche Teams aus vier Personen, die mit den wenigsten Wiederholungen gewinnt
    const opts = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    let best = null, bestC = Infinity;
    shuffle(opts).forEach((o) => {
      let c = 0;
      o.forEach(([x, y]) => {
        const a = four[x], b = four[y];
        c += (st.P.get(pk(a, b)) || 0) * 10;
        if (lastPartners.get(a) === b) c += 100;
      });
      if (c < bestC) { bestC = c; best = o; }
    });
    return [[four[best[0][0]], four[best[0][1]]], [four[best[1][0]], four[best[1][1]]]];
  }

  const ladder = {
    init(t) {
      if (!t.options.rounds) t.options.rounds = defaultRounds(t);
      const ids = activeIds(t);
      const swap = !!t.options.swap;
      const per = swap ? 4 : 2;
      const courts = Math.min(t.courts.length, Math.floor(ids.length / per));
      const matches = [];
      for (let c = 0; c < courts; c++) {
        const g = ids.slice(per * c, per * c + per);
        if (swap) matches.push(newMatch({ court: c, a: [g[0], g[3]], b: [g[1], g[2]] }));
        else matches.push(newMatch({ court: c, a: [g[0]], b: [g[1]] }));
      }
      t.rounds = [{ id: uid('r'), byes: ids.slice(per * courts), startedAt: null, matches }];
      t.cur = 0;
    },
    plannedRounds(t) { return t.options.rounds; },
    currentRound(t) { return t.rounds[t.cur] || null; },
    canAdvance(t) { const r = t.rounds[t.cur]; return !!r && r.matches.every((m) => m.w === 'a' || m.w === 'b'); },
    nextRound(t) {
      const r = t.rounds[t.cur];
      const swap = !!t.options.swap;
      const C = r.matches.length;
      const W = r.matches.map((m) => (m.w === 'a' ? m.a : m.b).slice());
      const L = r.matches.map((m) => (m.w === 'a' ? m.b : m.a).slice());
      let waiting = r.byes.slice();
      const arrivals = [];
      for (let k = 0; k < C; k++) {
        if (C === 1) arrivals.push(W[0].concat(L[0]));
        else if (k === 0) arrivals.push(W[0].concat(W[1]));
        else if (k === C - 1) arrivals.push(L[k - 1].concat(L[k]));
        else arrivals.push(L[k - 1].concat(W[k + 1]));
      }
      // Unterster Platz tauscht mit Wartenden.
      if (waiting.length) {
        const bottom = arrivals[C - 1];
        const losers = L[C - 1];
        const st = historyStats(t.rounds);
        const x = Math.min(waiting.length, losers.length);
        const leaving = losers.slice().sort((p, q) => (st.byes.get(p) || 0) - (st.byes.get(q) || 0)).slice(0, x);
        const entering = waiting.slice(0, x);
        arrivals[C - 1] = bottom.filter((id) => !leaving.includes(id)).concat(entering);
        waiting = waiting.slice(x).concat(leaving);
      }
      const st = historyStats(t.rounds);
      const lastPartners = new Map();
      r.matches.forEach((m) => [m.a, m.b].forEach((s) => { if (s.length === 2) { lastPartners.set(s[0], s[1]); lastPartners.set(s[1], s[0]); } }));
      const matches = arrivals.map((g, k) => {
        if (swap) { const [a, b] = ladderSplit(t, g, st, lastPartners); return newMatch({ court: k, a, b }); }
        return newMatch({ court: k, a: [g[0]], b: [g[1]] });
      });
      return { id: uid('r'), byes: waiting, startedAt: null, matches };
    },
    advance(t) {
      if (!this.canAdvance(t)) return { ok: false, error: 'Auf jedem Platz fehlt noch der Sieger.' };
      if (t.cur + 1 >= t.options.rounds) { t.status = 'finished'; t.finishedAt = new Date().toISOString(); return { ok: true, finished: true }; }
      if (t.cur + 1 >= t.rounds.length) t.rounds.push(this.nextRound(t));
      t.cur++;
      return { ok: true };
    },
    addRound(t) { t.options.rounds = Math.max(t.options.rounds, t.rounds.length) + 1; }
  };

  /* ================================================================
   * Warteschlange: Gewinner bleibt auf dem Platz
   * ================================================================ */

  const queue = {
    init(t) {
      const ids = activeIds(t);
      t.queue = { waiting: ids.slice(), streak: {} };
      t.courts.forEach((_, c) => {
        if (t.queue.waiting.length >= 2) {
          const a = t.queue.waiting.shift(), b = t.queue.waiting.shift();
          t.matches.push(newMatch({ court: c, a: [a], b: [b], calledAt: new Date().toISOString(), king: null }));
          t.queue.streak[c] = 0;
        }
      });
    },
    onResult(t, m) {
      const W = (m.w === 'a' ? m.a : m.b)[0], L = (m.w === 'a' ? m.b : m.a)[0];
      const q = t.queue;
      const c = m.court;
      q.streak[c] = m.king === W ? (q.streak[c] || 0) + 1 : 1;
      q.waiting.push(L);
      const max = Number(t.options.maxStreak) || 0;
      let a, king;
      if (max > 0 && q.streak[c] >= max) {
        q.waiting.push(W); q.streak[c] = 0;
        a = q.waiting.shift(); king = null;
      } else { a = W; king = W; }
      const b = q.waiting.shift();
      if (t.status === 'running' && a && b) t.matches.push(newMatch({ court: c, a: [a], b: [b], calledAt: new Date().toISOString(), king }));
    }
  };

  /* ================================================================
   * King of the Court als Trainingsspiel (Königsseite / Herausforderer)
   * ================================================================ */

  const rally = {
    init(t) {
      const ids = activeIds(t);
      t.rally = { king: ids[0], chal: ids[1], waiting: ids.slice(2), pts: {}, rallies: 0, winner: null, log: [] };
      ids.forEach((id) => { t.rally.pts[id] = 0; });
      if (!t.options.target) t.options.target = 11;
    },
    point(t, who) {
      const R = t.rally;
      if (t.status !== 'running') return;
      R.rallies++;
      R.log.push({ who, king: R.king, chal: R.chal });
      if (who === 'king') {
        R.pts[R.king] = (R.pts[R.king] || 0) + 1;
        R.waiting.push(R.chal);
        R.chal = R.waiting.shift();
        if (R.pts[R.king] >= Number(t.options.target)) {
          R.winner = R.king; t.status = 'finished'; t.finishedAt = new Date().toISOString();
        }
      } else {
        R.waiting.push(R.king);
        R.king = R.chal;
        R.chal = R.waiting.shift();
      }
    }
  };

  /* ================================================================
   * Pool: Jeder gegen jeden, K.-o., Gruppen + K.-o., Kompass
   * Matches bilden einen Graphen (src → Sieger/Verlierer), Plätze werden frei vergeben.
   * ================================================================ */

  function seedOrder(P) {
    let o = [1];
    while (o.length < P) { const n = o.length * 2; o = o.flatMap((s) => [s, n + 1 - s]); }
    return o;
  }

  function roundName(size) {
    return ({ 2: 'Finale', 4: 'Halbfinale', 8: 'Viertelfinale', 16: 'Achtelfinale', 32: 'Sechzehntelfinale' })[size] || `Runde der ${size}`;
  }

  // Baut einen K.-o.-Baum aus Quellen (Seeds oder Verweise) und hängt ihn an t.matches.
  function addDraw(t, { key, title, sources, depth0, order }) {
    let cur = sources;
    const rounds = [];
    let r = 0;
    while (cur.length > 1) {
      const ids = [], next = [];
      for (let i = 0; i < cur.length; i += 2) {
        const label = (title ? title + ' · ' : '') + roundName(cur.length) + (cur.length > 2 ? ' ' + (i / 2 + 1) : '');
        const m = newMatch({ stage: key, draw: key, rnd: r, depth: depth0 + r, sa: cur[i], sb: cur[i + 1], label, order: order + rounds.length * 100 + i / 2 });
        t.matches.push(m);
        ids.push(m.id);
        next.push({ from: m.id, take: 'w' });
      }
      rounds.push(ids);
      cur = next;
      r++;
    }
    t.draws = t.draws || [];
    const d = { key, title, rounds, depth0 };
    t.draws.push(d);
    return d;
  }

  function seededSources(ids, P) {
    return seedOrder(P).map((s) => (s <= ids.length ? { seed: ids[s - 1] } : { bye: true }));
  }

  function buildKO(t, ids, { key = 'ko', title = '', depth0 = 0, third = false, consolation = false } = {}) {
    const P = nextPow2(ids.length);
    const main = addDraw(t, { key, title, sources: seededSources(ids, P), depth0, order: 0 });
    const R = main.rounds.length;
    if (third && R >= 2) {
      const [s1, s2] = main.rounds[R - 2];
      t.matches.push(newMatch({ stage: key + '-3', draw: key + '-3', rnd: R - 1, depth: depth0 + R - 1, sa: { from: s1, take: 'l' }, sb: { from: s2, take: 'l' }, label: 'Spiel um Platz 3', order: 90000 }));
    }
    if (consolation && P >= 4) {
      const firsts = main.rounds[0];
      addDraw(t, { key: key + '-c', title: 'Trostrunde', sources: firsts.map((id) => ({ from: id, take: 'l' })), depth0: depth0 + 1, order: 50000 });
    }
    return main;
  }

  const COMPASS = {
    8: { E: ['W', 'N'], W: ['S'] },
    16: { E: ['W', 'N', 'NE'], W: ['S', 'SW'], N: ['NW'], S: ['SE'] }
  };
  const COMPASS_NAMES = { E: 'Ost', W: 'West', N: 'Nord', S: 'Süd', NE: 'Nordost', NW: 'Nordwest', SE: 'Südost', SW: 'Südwest' };
  const COMPASS_RANK = { 8: ['E', 'N', 'W', 'S'], 16: ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] };

  function buildCompass(t, ids) {
    const P = ids.length <= 8 ? 8 : 16;
    const map = COMPASS[P];
    const build = (dir, sources, depth0, order) => {
      const d = addDraw(t, { key: 'c-' + dir, title: COMPASS_NAMES[dir], sources, depth0, order });
      (map[dir] || []).forEach((sub, r) => {
        build(sub, d.rounds[r].map((id) => ({ from: id, take: 'l' })), depth0 + r + 1, order + 10000 * (r + 1));
      });
    };
    build('E', seededSources(ids, P), 0, 0);
    t.compassSize = P;
  }

  function snakeGroups(ids, g) {
    const groups = Array.from({ length: g }, () => []);
    ids.forEach((id, i) => {
      const row = Math.floor(i / g), col = i % g;
      groups[row % 2 ? g - 1 - col : col].push(id);
    });
    return groups;
  }

  const pool = {
    init(t) {
      const ids = activeIds(t);
      const s = MODES[t.mode].structure;
      t.matches = [];
      t.draws = [];
      if (s === 'rr') {
        circlePairs(ids).forEach((pairs, r) => pairs.forEach(([a, b], i) =>
          t.matches.push(newMatch({ stage: 'rr', depth: r, a: [a], b: [b], label: `Runde ${r + 1}`, order: r * 100 + i }))));
      } else if (s === 'ko') {
        buildKO(t, ids, { third: !!t.options.third, consolation: !!t.options.consolation });
      } else if (s === 'groups') {
        const g = clamp(Number(t.options.groups) || 2, 1, 8);
        t.groups = snakeGroups(ids, g).map((m, i) => ({ name: String.fromCharCode(65 + i), ids: m }));
        let maxR = 0;
        t.groups.forEach((gr, gi) => circlePairs(gr.ids).forEach((pairs, r) => {
          maxR = Math.max(maxR, r + 1);
          pairs.forEach(([a, b], i) => t.matches.push(newMatch({ stage: 'group', group: gi, depth: r, a: [a], b: [b], label: `Gruppe ${gr.name} · Runde ${r + 1}`, order: r * 1000 + gi * 100 + i })));
        }));
        t.groupDepth = maxR;
      } else if (s === 'compass') {
        buildCompass(t, ids);
      }
      this.resolve(t);
    },
    sideValue(t, src) {
      if (!src) return null;
      if (src.seed) return [src.seed];
      if (src.bye) return 'BYE';
      const m = t.matches.find((x) => x.id === src.from);
      if (!m || !m.w) return null;
      if (m.w === 'BYE') return 'BYE';
      const win = m.w === 'a' ? m.a : m.b, lose = m.w === 'a' ? m.b : m.a;
      return src.take === 'w' ? win : lose;
    },
    // Setzt Teilnehmende aus den Quellen ein und erledigt Freilose automatisch.
    resolve(t) {
      for (const m of t.matches) {
        if (!m.sa && !m.sb) continue;
        if (m.score) continue;
        m.a = this.sideValue(t, m.sa);
        m.b = this.sideValue(t, m.sb);
        if (m.a && m.b && (m.a === 'BYE' || m.b === 'BYE')) {
          m.w = m.a === 'BYE' && m.b === 'BYE' ? 'BYE' : m.a === 'BYE' ? 'b' : 'a';
          m.bye = true;
        } else { m.w = null; m.bye = false; }
      }
      this.assignCourts(t);
      if (this.allDone(t) && t.status === 'running' && !(MODES[t.mode].structure === 'groups' && !t.koBuilt)) {
        t.status = 'finished'; t.finishedAt = new Date().toISOString();
      }
    },
    ready(m) { return Array.isArray(m.a) && Array.isArray(m.b) && !m.w; },
    assignCourts(t) {
      const busy = new Set(), used = new Set();
      t.matches.forEach((m) => {
        if (m.court != null && !m.w) { used.add(m.court); (m.a || []).concat(m.b || []).forEach((id) => busy.add(id)); }
      });
      const free = t.courts.map((_, i) => i).filter((i) => !used.has(i));
      const waiting = t.matches.filter((m) => this.ready(m) && m.court == null).sort((x, y) => x.depth - y.depth || x.order - y.order);
      for (const m of waiting) {
        if (!free.length) break;
        const ids = m.a.concat(m.b);
        if (ids.some((id) => busy.has(id))) continue;
        m.court = free.shift();
        m.calledAt = new Date().toISOString();
        ids.forEach((id) => busy.add(id));
      }
    },
    allDone(t) { return t.matches.length > 0 && t.matches.every((m) => m.w); },
    canEdit(t, m) {
      if (!m.sa && !m.sb && MODES[t.mode].structure !== 'groups') return { ok: true };
      if (m.stage === 'group' && t.koBuilt) return { ok: false, reason: 'Die K.-o.-Runde ist schon ausgelost. Gruppenergebnisse sind jetzt fest.' };
      const dependents = t.matches.filter((x) => (x.sa && x.sa.from === m.id) || (x.sb && x.sb.from === m.id));
      if (dependents.some((x) => x.score)) return { ok: false, reason: 'Das Folgespiel hat schon ein Ergebnis. Erst dort löschen.' };
      return { ok: true };
    },
    groupStageDone(t) { return t.matches.filter((m) => m.stage === 'group').every((m) => m.w); },
    buildKOFromGroups(t) {
      if (t.koBuilt) return { ok: false, error: 'Die K.-o.-Runde steht schon.' };
      if (!this.groupStageDone(t)) return { ok: false, error: 'Die Gruppenphase ist noch nicht fertig.' };
      const adv = clamp(Number(t.options.advance) || 2, 1, 8);
      const tables = t.groups.map((g, gi) => groupTable(t, gi));
      const seeds = [];
      for (let place = 0; place < adv; place++) {
        const row = tables.map((tb, gi) => ({ id: tb[place] && tb[place].id, g: gi })).filter((x) => x.id);
        if (place % 2) row.reverse();
        seeds.push(...row);
      }
      const P = nextPow2(seeds.length);
      const order = seedOrder(P);
      // Erste Runde: gleiche Gruppe möglichst nicht gegeneinander.
      const slots = order.map((s) => seeds[s - 1] || null);
      for (let i = 0; i < slots.length; i += 2) {
        const x = slots[i], y = slots[i + 1];
        if (x && y && x.g === y.g) {
          for (let j = i + 2; j < slots.length; j += 2) {
            const z = slots[j + 1];
            if (z && z.g !== x.g && (!slots[j] || slots[j].g !== y.g)) { slots[i + 1] = z; slots[j + 1] = y; break; }
          }
        }
      }
      const sources = slots.map((x) => (x ? { seed: x.id } : { bye: true }));
      const main = addDraw(t, { key: 'ko', title: '', sources, depth0: t.groupDepth, order: 0 });
      if (t.options.third && main.rounds.length >= 2) {
        const [s1, s2] = main.rounds[main.rounds.length - 2];
        t.matches.push(newMatch({ stage: 'ko-3', draw: 'ko-3', depth: t.groupDepth + main.rounds.length - 1, sa: { from: s1, take: 'l' }, sb: { from: s2, take: 'l' }, label: 'Spiel um Platz 3', order: 90000 }));
      }
      t.koBuilt = true;
      this.resolve(t);
      return { ok: true };
    }
  };

  const ENGINES = { rotation, ladder, queue, rally, pool };

  /* ---------- Ergebnis setzen / löschen (für alle Modi) ---------- */

  function findMatch(t, matchId) {
    for (const r of t.rounds) { const m = r.matches.find((x) => x.id === matchId); if (m) return { m, round: r }; }
    const m = t.matches.find((x) => x.id === matchId);
    return m ? { m, round: null } : null;
  }

  function canEdit(t, matchId) {
    const f = findMatch(t, matchId);
    if (!f) return { ok: false, reason: 'Spiel nicht gefunden.' };
    const eng = MODES[t.mode].engine;
    if (eng === 'ladder' && f.round && t.rounds.indexOf(f.round) < t.cur) return { ok: false, reason: 'Die Folgerunde ist schon eingeteilt. Nutze „Rückgängig“, um zurückzugehen.' };
    if (eng === 'queue' && f.m.w) return { ok: false, reason: 'Das Spiel ist abgeschlossen. Nutze „Rückgängig“, um es zu korrigieren.' };
    if (eng === 'pool') return pool.canEdit(t, f.m);
    return { ok: true };
  }

  function setResult(t, matchId, score) {
    const f = findMatch(t, matchId);
    if (!f) return { ok: false, error: 'Spiel nicht gefunden.' };
    const ce = canEdit(t, matchId);
    if (!ce.ok) return { ok: false, error: ce.reason };
    if (f.m.bye) return { ok: false, error: 'Freilos – hier gibt es nichts einzutragen.' };
    if (!Array.isArray(f.m.a) || !Array.isArray(f.m.b)) return { ok: false, error: 'Die Gegner stehen noch nicht fest.' };
    const res = setScore(t, f.m, score);
    if (!res.ok) return res;
    if (f.round && !f.round.startedAt) f.round.startedAt = new Date().toISOString();
    const eng = MODES[t.mode].engine;
    if (eng === 'queue') queue.onResult(t, f.m);
    if (eng === 'pool') pool.resolve(t);
    touch(t);
    return res;
  }

  function clearResult(t, matchId) {
    const f = findMatch(t, matchId);
    if (!f) return { ok: false, error: 'Spiel nicht gefunden.' };
    const ce = canEdit(t, matchId);
    if (!ce.ok) return { ok: false, error: ce.reason };
    f.m.score = null; f.m.w = null; f.m.at = null;
    if (MODES[t.mode].engine === 'pool') {
      // Platz inzwischen neu vergeben? Dann reiht sich das Spiel wieder ein.
      if (f.m.court != null && t.matches.some((x) => x !== f.m && !x.w && x.court === f.m.court)) f.m.court = null;
      if (t.status === 'finished') t.status = 'running';
      pool.resolve(t);
    }
    if (t.status === 'finished' && MODES[t.mode].engine === 'rotation') t.status = 'running';
    touch(t);
    return { ok: true };
  }

  function touch(t) { t.updatedAt = new Date().toISOString(); }

  function advance(t) {
    const eng = ENGINES[MODES[t.mode].engine];
    if (!eng.advance) return { ok: false, error: 'Nicht verfügbar.' };
    const r = eng.advance(t);
    if (r.ok) { t.timer = { dur: t.timer.dur, endsAt: null, left: null }; touch(t); }
    return r;
  }

  function addRound(t) {
    const eng = ENGINES[MODES[t.mode].engine];
    if (!eng.addRound) return { ok: false };
    if (t.status === 'finished') { t.status = 'running'; t.finishedAt = null; }
    eng.addRound(t);
    touch(t);
    return { ok: true };
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

  function reopen(t) { t.status = 'running'; t.finishedAt = null; touch(t); }

  function currentRound(t) {
    const e = MODES[t.mode].engine;
    if (e === 'rotation' || e === 'ladder') return t.rounds[t.cur] || null;
    return null;
  }

  function rallyPoint(t, who) { rally.point(t, who); touch(t); }

  function buildKOFromGroups(t) { const r = pool.buildKOFromGroups(t); touch(t); return r; }

  /* ---------- Teilnehmende ändern ---------- */

  function rename(t, id, name) {
    const e = ent(t, id);
    const n = String(name || '').trim();
    if (!e || !n) return { ok: false, error: 'Bitte einen Namen eingeben.' };
    if (t.entrants.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: 'Den Namen gibt es schon.' };
    e.name = n; touch(t);
    return { ok: true };
  }

  function rosterEditable(t) {
    const m = MODES[t.mode];
    if (t.status !== 'running') return false;
    if (m.engine === 'rotation') return m.pairing !== 'circle';
    return m.engine === 'queue' || m.engine === 'rally';
  }

  function addEntrant(t, name, group) {
    const n = String(name || '').trim();
    if (!n) return { ok: false, error: 'Bitte einen Namen eingeben.' };
    if (!rosterEditable(t)) return { ok: false, error: 'In diesem Modus lassen sich nur Namen ändern.' };
    if (t.entrants.some((x) => x.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: 'Den Namen gibt es schon.' };
    if (MODES[t.mode].mixed && group !== 'A' && group !== 'B') return { ok: false, error: 'Bitte eine Gruppe wählen.' };
    const e = { id: uid('e'), name: n, group: group || null, active: true };
    t.entrants.push(e);
    afterRosterChange(t, e.id, true);
    touch(t);
    return { ok: true };
  }

  function setActive(t, id, active) {
    const e = ent(t, id);
    if (!e) return { ok: false, error: 'Nicht gefunden.' };
    if (!rosterEditable(t)) return { ok: false, error: 'In diesem Modus lassen sich nur Namen ändern.' };
    const m = MODES[t.mode];
    if (!active) {
      const remaining = t.entrants.filter((x) => x.active !== false && x.id !== id).length;
      if (remaining < m.min) return { ok: false, error: `Mindestens ${m.min} müssen dabei bleiben.` };
      if (m.engine === 'queue' && t.matches.some((x) => !x.w && x.a.concat(x.b).includes(id))) return { ok: false, error: 'Steht gerade auf dem Platz. Nach dem Spiel noch einmal versuchen.' };
      if (m.engine === 'rally' && (t.rally.king === id || t.rally.chal === id)) return { ok: false, error: 'Steht gerade auf dem Platz. Nach dem Ballwechsel noch einmal versuchen.' };
    }
    e.active = !!active;
    afterRosterChange(t, id, active);
    touch(t);
    return { ok: true };
  }

  function afterRosterChange(t, id, added) {
    const m = MODES[t.mode];
    if (m.engine === 'rotation') rotation.regenerate(t);
    if (m.engine === 'queue') {
      t.queue.waiting = t.queue.waiting.filter((x) => x !== id);
      if (added) t.queue.waiting.push(id);
    }
    if (m.engine === 'rally') {
      t.rally.waiting = t.rally.waiting.filter((x) => x !== id);
      if (added) { t.rally.waiting.push(id); if (t.rally.pts[id] == null) t.rally.pts[id] = 0; }
    }
  }

  /* ---------- Tabellen ---------- */

  function blankRow(id) { return { id, played: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, sf: 0, sa: 0, byes: 0 }; }

  function tally(t, matches, unitOf) {
    const fmt = fmtOf(t);
    const rows = new Map();
    const get = (id) => { if (!rows.has(id)) rows.set(id, blankRow(id)); return rows.get(id); };
    matches.forEach((m) => {
      if (!m.w || m.w === 'BYE' || m.bye || !m.score) return;
      const r = evalScore(fmt, m.score);
      if (!r) return;
      const apply = (ids, mine, other, side) => ids.forEach((id) => {
        const x = get(unitOf ? unitOf(id) : id);
        x.played++; x.pf += mine.p; x.pa += other.p; x.sf += mine.s; x.sa += other.s;
        if (r.w === 'd') x.d++; else if (r.w === side) x.w++; else x.l++;
      });
      apply(m.a, { p: r.pa, s: r.sa }, { p: r.pb, s: r.sb }, 'a');
      apply(m.b, { p: r.pb, s: r.sb }, { p: r.pa, s: r.sa }, 'b');
    });
    return { rows, get };
  }

  const cmpPoints = (x, y) => y.total - x.total || (y.w + y.d / 2) - (x.w + x.d / 2) || (y.pf - y.pa) - (x.pf - x.pa);
  const cmpWins = (x, y) => (y.w + y.d / 2) - (x.w + x.d / 2) || (y.sf - y.sa) - (x.sf - x.sa) || (y.pf - y.pa) - (x.pf - x.pa) || y.pf - x.pf;

  function withRanks(rows, cmp) {
    rows.sort((x, y) => cmp(x, y) || x.name.localeCompare(y.name, 'de'));
    rows.forEach((r, i) => { r.rank = i > 0 && cmp(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; });
    return rows;
  }

  function groupTable(t, gi) {
    const ms = t.matches.filter((m) => m.stage === 'group' && m.group === gi);
    const { get } = (() => { const x = tally(t, ms); return x; })();
    const rows = t.groups[gi].ids.map((id) => Object.assign(get(id), { name: nameOf(t, id) }));
    return withRanks(rows, cmpWins);
  }

  function rotationStandings(t) {
    const m = MODES[t.mode];
    const fmt = fmtOf(t);
    const all = t.rounds.flatMap((r) => r.matches);
    const { get } = tally(t, all);
    const done = t.rounds.filter((r) => r.matches.every((x) => x.w));
    const byeRounds = t.rounds.slice(0, t.status === 'finished' ? t.rounds.length : t.cur + (done.includes(t.rounds[t.cur]) ? 1 : 0));
    const rows = t.entrants.filter((e) => e.active !== false || get(e.id).played > 0).map((e) => {
      const x = get(e.id);
      x.name = e.name; x.active = e.active !== false;
      x.byes = byeRounds.filter((r) => r.byes.includes(e.id)).length;
      x.bonus = 0;
      if (t.options.byePoints !== 'none' && x.byes && x.played) x.bonus = Math.round((x.pf / x.played) * x.byes);
      x.total = x.pf + x.bonus;
      return x;
    });
    const byWins = m.pairing === 'circle' && fmt.kind !== 'points';
    const anyBonus = rows.some((r) => r.bonus);
    const unit = fmt.kind === 'games' ? 'Games' : fmt.kind === 'winner' ? 'Siege' : 'Punkte';
    return {
      cols: byWins
        ? [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S' }, { k: 'l', h: 'N' }, { k: 'diff', h: '+/−' }]
        : [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S' }, { k: 'diff', h: '+/−' }, { k: 'total', h: unit === 'Punkte' ? 'Pkt' : unit, strong: true }],
      rows: withRanks(rows.map((r) => Object.assign(r, { diff: r.pf - r.pa })), byWins ? cmpWins : cmpPoints),
      note: (byWins ? 'Reihenfolge: Siege, dann Differenz.' : `Reihenfolge: ${unit}, dann Siege, dann Differenz.`) +
        (anyBonus ? ' Pausen zählen mit dem eigenen Schnitt pro Spiel.' : '')
    };
  }

  function ladderStandings(t) {
    const C = t.courts.length;
    const all = t.rounds.flatMap((r) => r.matches);
    const { get } = tally(t, all, null);
    const done = t.rounds.filter((r) => r.matches.length && r.matches.every((m) => m.w));
    const last = done[done.length - 1];
    const pos = new Map(), court = new Map();
    const cp = new Map();
    t.rounds.forEach((r) => r.matches.forEach((m) => {
      if (!m.w) return;
      (m.w === 'a' ? m.a : m.b).forEach((id) => cp.set(id, (cp.get(id) || 0) + (C - m.court)));
    }));
    if (last) {
      last.matches.forEach((m) => {
        const W = m.w === 'a' ? m.a : m.b, L = m.w === 'a' ? m.b : m.a;
        W.forEach((id) => { pos.set(id, 2 * m.court); court.set(id, m.court); });
        L.forEach((id) => { pos.set(id, 2 * m.court + 1); court.set(id, m.court); });
      });
      last.byes.forEach((id, i) => pos.set(id, 2 * C + i));
    } else {
      const r = t.rounds[0];
      r.matches.forEach((m) => m.a.concat(m.b).forEach((id) => { pos.set(id, 2 * m.court); court.set(id, m.court); }));
      r.byes.forEach((id, i) => pos.set(id, 2 * C + i));
    }
    const byPoints = t.options.ranking === 'points';
    const rows = t.entrants.map((e) => {
      const x = get(e.id);
      return Object.assign(x, { name: e.name, pos: pos.has(e.id) ? pos.get(e.id) : 999, cp: cp.get(e.id) || 0, courtLabel: court.has(e.id) ? t.courts[court.get(e.id)] : 'wartet' });
    });
    const cmp = byPoints
      ? (x, y) => y.cp - x.cp || y.w - x.w || x.pos - y.pos
      : (x, y) => x.pos - y.pos || y.w - x.w || y.cp - x.cp;
    return {
      cols: [{ k: 'courtLabel', h: 'Platz', text: true }, { k: 'w', h: 'S' }, { k: 'cp', h: 'Pkt', strong: byPoints }],
      rows: withRanks(rows, cmp),
      note: byPoints
        ? `Ein Sieg auf ${t.courts[0]} bringt ${C} Punkte, jeder Platz darunter einen weniger.`
        : `Es zählt die Position nach der letzten Runde: oben ist ${t.courts[0]}. Gleichstand: Siege, dann Platzpunkte.`
    };
  }

  function queueStandings(t) {
    const { get } = tally(t, t.matches);
    const streak = new Map(), best = new Map();
    t.matches.forEach((m) => {
      if (!m.w) return;
      const W = (m.w === 'a' ? m.a : m.b)[0], L = (m.w === 'a' ? m.b : m.a)[0];
      streak.set(W, (m.king === W ? streak.get(W) || 0 : 0) + 1);
      best.set(W, Math.max(best.get(W) || 0, streak.get(W)));
      streak.set(L, 0);
    });
    const rows = t.entrants.filter((e) => e.active !== false || get(e.id).played).map((e) => Object.assign(get(e.id), { name: e.name, best: best.get(e.id) || 0 }));
    return {
      cols: [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S', strong: true }, { k: 'l', h: 'N' }, { k: 'best', h: 'Serie' }],
      rows: withRanks(rows, (x, y) => y.w - x.w || y.best - x.best || x.played - y.played),
      note: 'Reihenfolge: Siege, dann längste Siegesserie, dann weniger Spiele.'
    };
  }

  function rallyStandings(t) {
    const R = t.rally;
    const rows = t.entrants.filter((e) => e.active !== false || R.pts[e.id]).map((e) => ({ id: e.id, name: e.name, pts: R.pts[e.id] || 0, role: e.id === R.king ? 'König' : e.id === R.chal ? 'fordert' : 'wartet' }));
    return {
      cols: [{ k: 'role', h: '', text: true }, { k: 'pts', h: 'Pkt', strong: true }],
      rows: withRanks(rows, (x, y) => y.pts - x.pts),
      note: `Punkte gibt es nur auf der Königsseite. Wer zuerst ${t.options.target} hat, gewinnt.`
    };
  }

  // Platzierungen aus K.-o.-Bäumen: Sieger/Verlierer des Finales, dann nach Ausscheiderunde.
  function drawPlacements(t, draw, startRank) {
    const finalId = draw.rounds[draw.rounds.length - 1][0];
    const fm = t.matches.find((m) => m.id === finalId);
    const out = [];
    if (fm && fm.w && fm.w !== 'BYE') {
      const W = fm.w === 'a' ? fm.a : fm.b, L = fm.w === 'a' ? fm.b : fm.a;
      out.push({ ids: W, rank: startRank });
      if (Array.isArray(L)) out.push({ ids: L, rank: startRank + 1 });
    }
    return out;
  }

  function poolStandings(t) {
    const s = MODES[t.mode].structure;
    if (s === 'rr') {
      const { get } = tally(t, t.matches);
      const rows = t.entrants.map((e) => Object.assign(get(e.id), { name: e.name }));
      rows.forEach((r) => { r.diff = r.pf - r.pa; r.sdiff = r.sf - r.sa; });
      const sets = fmtOf(t).kind === 'sets';
      return {
        cols: [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S', strong: true }, { k: 'l', h: 'N' }].concat(sets ? [{ k: 'sdiff', h: 'Sätze' }] : []).concat([{ k: 'diff', h: '+/−' }]),
        rows: withRanks(rows, cmpWins),
        note: 'Reihenfolge: Siege (Remis halb), Satzdifferenz, Spiel-/Punktdifferenz.'
      };
    }
    // Platzierungen
    const placed = new Map();
    const place = (ids, rank) => (ids || []).forEach((id) => { if (!placed.has(id)) placed.set(id, rank); });
    if (s === 'compass') {
      const P = t.compassSize;
      COMPASS_RANK[P].forEach((dir, i) => {
        const d = t.draws.find((x) => x.key === 'c-' + dir);
        if (d) drawPlacements(t, d, 2 * i + 1).forEach((p) => place(p.ids, p.rank));
      });
    } else {
      const main = t.draws.find((d) => d.key === 'ko');
      if (main) {
        drawPlacements(t, main, 1).forEach((p) => place(p.ids, p.rank));
        const third = t.matches.find((m) => m.stage === 'ko-3');
        if (third && third.w && third.w !== 'BYE') {
          place(third.w === 'a' ? third.a : third.b, 3);
          if (Array.isArray(third.w === 'a' ? third.b : third.a)) place(third.w === 'a' ? third.b : third.a, 4);
        }
        // Ausgeschiedene: je früher, desto schlechter
        const R = main.rounds.length;
        for (let r = R - 2; r >= 0; r--) {
          const rank = Math.pow(2, R - 1 - r) + 1;
          main.rounds[r].forEach((id) => {
            const m = t.matches.find((x) => x.id === id);
            if (m && m.w && m.w !== 'BYE' && !m.bye) place(m.w === 'a' ? m.b : m.a, rank);
          });
        }
      }
    }
    const fin = t.status === 'finished';
    const { get } = tally(t, t.matches);
    let rows = t.entrants.map((e) => Object.assign(get(e.id), { name: e.name, place: placed.get(e.id) || null }));
    if (s === 'groups' && !t.koBuilt) {
      const tables = t.groups.map((_, gi) => groupTable(t, gi));
      return {
        groups: tables.map((tb, gi) => ({ name: 'Gruppe ' + t.groups[gi].name, rows: tb })),
        cols: [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S', strong: true }, { k: 'l', h: 'N' }, { k: 'diff', h: '+/−' }],
        rows: [],
        note: `Die besten ${t.options.advance || 2} je Gruppe kommen weiter. Reihenfolge: Siege, Satz-, dann Spieldifferenz.`
      };
    }
    rows.forEach((r) => { r.diff = r.pf - r.pa; r.placeLabel = r.place ? r.place + '.' : (fin ? '–' : 'im Rennen'); });
    rows = withRanks(rows, (x, y) => (x.place || 999) - (y.place || 999) || y.w - x.w || y.diff - x.diff);
    const res = {
      cols: [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S' }, { k: 'diff', h: '+/−' }],
      rows,
      note: s === 'compass'
        ? 'Jede Himmelsrichtung ist ein eigenes Feld. Ost entscheidet die Plätze 1 und 2, danach folgen die weiteren Felder.'
        : 'Platzierung nach K.-o.-Runde. Ausgeschiedene derselben Runde teilen sich den Rang.'
    };
    if (s === 'groups') res.groups = t.groups.map((g, gi) => ({ name: 'Gruppe ' + g.name, rows: groupTable(t, gi) }));
    return res;
  }

  function standings(t) {
    const e = MODES[t.mode].engine;
    if (e === 'rotation') return rotationStandings(t);
    if (e === 'ladder') return ladderStandings(t);
    if (e === 'queue') return queueStandings(t);
    if (e === 'rally') return rallyStandings(t);
    return poolStandings(t);
  }

  function podium(t) {
    const st = standings(t);
    const rows = st.rows.filter((r) => (MODES[t.mode].engine === 'pool' && MODES[t.mode].structure !== 'rr' ? r.place : true));
    return [1, 2, 3].map((rank) => rows.filter((r) => r.rank === rank).map((r) => r.name)).filter((x) => x.length);
  }

  /* ---------- Was kommt als Nächstes? ---------- */

  function liveMatches(t) {
    const e = MODES[t.mode].engine;
    if (e === 'rotation' || e === 'ladder') { const r = t.rounds[t.cur]; return r ? r.matches : []; }
    if (e === 'queue') return t.matches.filter((m) => !m.w).sort((x, y) => x.court - y.court);
    if (e === 'pool') return t.matches.filter((m) => m.court != null && !m.w).sort((x, y) => x.court - y.court);
    return [];
  }

  function next(t) {
    const m = MODES[t.mode];
    const e = m.engine;
    if (t.status === 'finished') {
      const p = podium(t);
      return { state: 'done', title: 'Turnier beendet', text: p.length ? `Sieg: ${p[0].join(', ')}` : 'Alle Ergebnisse sind drin.', action: { id: 'podium', label: 'Siegerehrung' } };
    }
    if (e === 'rotation' || e === 'ladder') {
      const r = t.rounds[t.cur];
      const planned = ENGINES[e].plannedRounds(t);
      const no = t.cur + 1;
      const open = r.matches.filter((x) => !x.w);
      if (!r.startedAt && !r.matches.some((x) => x.w)) {
        return { state: 'ready', title: `Runde ${no} von ${planned}`, text: 'Alle auf ihre Plätze. Dann die Runde starten.', action: { id: 'start', label: roundTimed(t) ? 'Runde starten & Timer los' : 'Runde starten' } };
      }
      if (open.length) {
        const first = open[0];
        return {
          state: 'live', title: `Runde ${no} läuft`,
          text: open.length === r.matches.length ? `${r.matches.length === 1 ? 'Ergebnis' : 'Ergebnisse'} nach Spielende eintragen.` : `Noch ${open.length} von ${r.matches.length} Ergebnissen offen.`,
          action: { id: 'result', match: first.id, label: `Ergebnis ${t.courts[first.court]}` }
        };
      }
      if (no >= planned) return { state: 'last', title: 'Letzte Runde komplett', text: 'Alle Ergebnisse sind drin.', action: { id: 'advance', label: 'Turnier abschließen' }, alt: { id: 'addRound', label: 'Zusatzrunde' } };
      return {
        state: 'between', title: `Runde ${no} komplett`,
        text: e === 'ladder' ? 'Sieger steigen auf, Verlierer steigen ab.' : m.pairing === 'dynamic' ? 'Die nächste Runde wird nach der Tabelle gepaart.' : 'Weiter mit der nächsten Runde.',
        action: { id: 'advance', label: `Runde ${no + 1} einteilen` }
      };
    }
    if (e === 'queue') {
      const live = liveMatches(t);
      const w = t.queue.waiting;
      return { state: 'live', title: live.length > 1 ? `${live.length} Spiele laufen` : 'Spiel läuft', text: w.length ? `Als Nächstes: ${nameOf(t, w[0])}${w[1] ? ', danach ' + nameOf(t, w[1]) : ''}.` : 'Niemand wartet.', action: live[0] ? { id: 'result', match: live[0].id, label: 'Sieger eintragen' } : null };
    }
    if (e === 'rally') {
      const R = t.rally;
      return { state: 'live', title: `Königsseite: ${nameOf(t, R.king)}`, text: `Herausforderer: ${nameOf(t, R.chal)}. Danach: ${R.waiting.length ? nameOf(t, R.waiting[0]) : '–'}.`, action: null };
    }
    // pool
    if (m.structure === 'groups' && !t.koBuilt && pool.groupStageDone(t)) {
      return { state: 'between', title: 'Gruppenphase beendet', text: `Die besten ${t.options.advance || 2} je Gruppe ziehen in die K.-o.-Runde ein.`, action: { id: 'buildKO', label: 'K.-o.-Runde auslosen' } };
    }
    const live = liveMatches(t);
    const waiting = t.matches.filter((x) => pool.ready(x) && x.court == null).sort((x, y) => x.depth - y.depth || x.order - y.order);
    const pending = t.matches.filter((x) => !x.w).length;
    if (live.length) {
      return { state: 'live', title: `${live.length} ${live.length === 1 ? 'Spiel läuft' : 'Spiele laufen'}`, text: waiting.length ? `Wartet auf freien Platz: ${waiting[0].label || 'nächstes Spiel'}.` : `${pending} ${pending === 1 ? 'Spiel' : 'Spiele'} insgesamt offen.`, action: { id: 'result', match: live[0].id, label: `Ergebnis ${t.courts[live[0].court]}` } };
    }
    return { state: 'wait', title: 'Warten auf Ergebnisse', text: 'Sobald ein Ergebnis drin ist, geht es weiter.', action: null };
  }

  /* ---------- Schätzung & Kurzinfos ---------- */

  function estimate(cfg) {
    const m = MODES[cfg.mode];
    if (!m) return null;
    const ents = (cfg.entrants || []).filter((e) => e && String(e.name || '').trim());
    const n = ents.length;
    const C = Math.max(1, Number(cfg.courts) || 1);
    const fmt = FORMATS[cfg.format] || FORMATS.win;
    const opt = cfg.options || {};
    const roundMin = Number(opt.roundMinutes) || 0;
    const per = (fmt.timed || m.engine === 'ladder' ? roundMin || 12 : (roundMin ? Math.min(roundMin, fmt.min) : fmt.min)) + 2;
    if (m.engine === 'rotation') {
      let rounds = Number(opt.rounds) || defaultRounds(cfg) || 0;
      if (m.pairing === 'circle') {
        const pairs = n * (n - 1) / 2;
        const perRound = Math.min(C, Math.floor(n / 2));
        rounds = perRound ? Math.ceil(pairs / perRound) : 0;
      }
      return { rounds, minutes: rounds * per };
    }
    if (m.engine === 'ladder') { const rounds = Number(opt.rounds) || defaultRounds(cfg); return { rounds, minutes: rounds * ((roundMin || 12) + 2) }; }
    if (m.engine === 'pool') {
      const pm = fmt.min + 3;
      const waves = (counts) => counts.reduce((a, c) => a + Math.ceil(c / C), 0);
      if (m.structure === 'rr') {
        const games = n * (n - 1) / 2;
        return { games, minutes: Math.ceil(games / Math.min(C, Math.floor(n / 2) || 1)) * pm };
      }
      if (m.structure === 'ko' || m.structure === 'compass') {
        const P = nextPow2(n), R = Math.log2(P), byes = P - n;
        const perRound = Array.from({ length: R }, (_, r) => (m.structure === 'compass' ? P / 2 : P / Math.pow(2, r + 1)));
        perRound[0] -= byes;
        let games = perRound.reduce((a, b) => a + b, 0);
        if (m.structure === 'ko') {
          if (opt.third && R >= 2) games++;
          if (opt.consolation) games += Math.max(0, P / 2 - byes - 1);
        }
        return { games, minutes: waves(perRound) * pm };
      }
      if (m.structure === 'groups') {
        const g = Number(opt.groups) || 2, adv = Number(opt.advance) || 2;
        const sizes = Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0));
        const groupGames = sizes.reduce((a, k) => a + k * (k - 1) / 2, 0);
        const ko = nextPow2(g * adv);
        const koRounds = Array.from({ length: Math.log2(ko) }, (_, r) => ko / Math.pow(2, r + 1));
        return { games: groupGames + g * adv - 1 + (opt.third ? 1 : 0), minutes: (Math.ceil(groupGames / C) + waves(koRounds)) * pm };
      }
    }
    return null;
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
      const e = MODES[t.mode].engine;
      if (r) {
        lines.push(`${t.name} – Runde ${t.cur + 1}`);
        r.matches.forEach((m) => lines.push(`${t.courts[m.court]}: ${sideName(t, m.a)} – ${sideName(t, m.b)}${m.score ? '  ' + (scoreText(fmt, m.score) || 'Sieg: ' + sideName(t, m.w === 'a' ? m.a : m.b)) : ''}`));
        if (r.byes.length) lines.push(`${e === 'ladder' ? 'Wartet' : 'Pause'}: ${r.byes.map((id) => nameOf(t, id)).join(', ')}`);
      } else {
        lines.push(t.name);
        liveMatches(t).forEach((m) => lines.push(`${t.courts[m.court]}: ${sideName(t, m.a)} – ${sideName(t, m.b)}`));
      }
    } else {
      const st = standings(t);
      lines.push(`${t.name} – ${t.status === 'finished' ? 'Endstand' : 'Zwischenstand'}`);
      if (st.groups && !st.rows.some((r) => r.place)) {
        st.groups.forEach((g) => { lines.push('', g.name); g.rows.forEach((r) => lines.push(`${r.rank}. ${r.name}  ${r.w} S`)); });
      } else {
        const strong = st.cols.find((c) => c.strong);
        st.rows.forEach((r) => lines.push(`${r.rank}. ${r.name}${strong ? '  ' + r[strong.k] + ' ' + strong.h : ''}`));
      }
    }
    return lines.join('\n');
  }

  return {
    SPORTS, RULES, FORMATS, MODES,
    formatsFor, defaultFormat, modeAvailable, defaultRounds, estimate, serveHint,
    evalScore, checkScore, scoreText,
    validateConfig, unitNoun, isPlayerUnit, create,
    fmtOf, roundTimed, allowDraw,
    nameOf, sideName, ent,
    findMatch, canEdit, setResult, clearResult,
    advance, addRound, startRound, finish, reopen, currentRound, liveMatches,
    rallyPoint, buildKOFromGroups,
    rename, rosterEditable, addEntrant, setActive,
    standings, podium, next, shareText,
    _internal: { circlePairs, seedOrder, genAmericanoRounds, historyStats, nextPow2, isPow2 }
  };
});
