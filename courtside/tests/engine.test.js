// Ausführen: node --test courtside/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/engine.js');

const names = (n, p = 'S') => Array.from({ length: n }, (_, i) => ({ name: `${p}${i + 1}` }));
const cfg = (o) => Object.assign({ sport: 'padel', discipline: 'doubles', courts: 2, options: {} }, o);

function randomScore(t) {
  const f = E.fmtOf(t);
  if (f.kind === 'winner') return { w: Math.random() < 0.5 ? 'a' : 'b' };
  if (f.total) { const a = Math.floor(Math.random() * (f.total + 1)); return { a, b: f.total - a }; }
  const target = f.target || 6;
  const lo = Math.floor(Math.random() * (target - 1));
  return Math.random() < 0.5 ? { a: target, b: lo } : { a: lo, b: target };
}

function playOut(t, guard = 200) {
  while (t.status === 'running' && guard-- > 0) {
    const n = E.next(t);
    if (n.action.id === 'start') E.startRound(t);
    else if (n.action.id === 'result') assert.ok(E.setResult(t, n.action.match, randomScore(t)).ok);
    else if (n.action.id === 'advance') assert.ok(E.advance(t).ok);
  }
  assert.equal(t.status, 'finished', 'Turnier läuft nicht zu Ende');
}

function partnerRepeats(t) {
  const seen = new Set();
  let rep = 0;
  t.rounds.forEach((r) => r.matches.forEach((m) => [m.a, m.b].forEach((p) => {
    const k = p.slice().sort().join();
    if (seen.has(k)) rep++;
    seen.add(k);
  })));
  return rep;
}

test('Americano 8/12/16: jeder spielt einmal mit jedem', () => {
  for (const n of [8, 12, 16]) {
    const t = E.create(cfg({ mode: 'americano', format: 'p24', courts: n / 4, entrants: names(n), options: { rounds: n - 1 } }));
    assert.equal(t.rounds.length, n - 1);
    assert.equal(partnerRepeats(t), 0, `Wiederholungen bei ${n}`);
    t.rounds.forEach((r) => assert.equal(r.byes.length, 0));
  }
});

test('Americano mit Level: Partner bleiben einmalig, Spiele werden ausgeglichener', () => {
  const lv = ['pro', 'pro', 'intermediate', 'intermediate', 'intermediate', 'intermediate', 'beginner', 'beginner'];
  const ents = names(8).map((e, i) => ({ ...e, level: lv[i] }));
  const gap = (t) => {
    let sum = 0, cnt = 0;
    t.rounds.forEach((r) => r.matches.forEach((m) => {
      const s = (ids) => ids.reduce((a, id) => a + E.strengthOf(E.ent(t, id)), 0);
      sum += Math.abs(s(m.a) - s(m.b)); cnt++;
    }));
    return sum / cnt;
  };
  let withBal = 0, without = 0;
  for (let i = 0; i < 5; i++) {
    const a = E.create(cfg({ mode: 'americano', format: 'p24', entrants: ents, options: { rounds: 7 } }));
    const b = E.create(cfg({ mode: 'americano', format: 'p24', entrants: ents, options: { rounds: 7, balance: false } }));
    assert.equal(partnerRepeats(a), 0);
    withBal += gap(a); without += gap(b);
  }
  assert.ok(withBal < without, `ausgeglichen ${withBal} vs. ohne ${without}`);
});

test('Americano 9 Personen / 2 Plätze: Pausen gleich verteilt', () => {
  const t = E.create(cfg({ mode: 'americano', format: 'p16', entrants: names(9), options: { rounds: 9 } }));
  const byes = {};
  t.rounds.forEach((r) => { assert.equal(r.byes.length, 1); r.byes.forEach((id) => { byes[id] = (byes[id] || 0) + 1; }); });
  assert.deepEqual(Object.values(byes), Array(9).fill(1));
  playOut(t);
  assert.ok(E.standings(t).rows.every((r) => r.played === 8 && r.byes === 1));
});

test('Mexicano: Runde 1 nach Level, danach nach Tabelle', () => {
  const lv = ['beginner', 'pro', 'beginner', 'pro', 'intermediate', 'pro', 'intermediate', 'pro'];
  const t = E.create(cfg({ mode: 'mexicano', format: 'p24', entrants: names(8).map((e, i) => ({ ...e, level: lv[i] })), options: { rounds: 3, firstRound: 'level' } }));
  const top = t.rounds[0].matches[0];
  assert.ok(top.a.concat(top.b).every((id) => E.ent(t, id).level === 'pro'), 'Profis starten zusammen auf Platz 1');
  t.rounds[0].matches.forEach((m, i) => E.setResult(t, m.id, i === 0 ? { a: 20, b: 4 } : { a: 13, b: 11 }));
  const order = E.standings(t).rows.map((r) => r.id);
  E.advance(t);
  const m1 = t.rounds[1].matches[0];
  assert.deepEqual(m1.a.concat(m1.b).sort(), order.slice(0, 4).sort());
  playOut(t);
});

test('Team-Turnier 5 Teams: jede Paarung genau einmal', () => {
  const t = E.create(cfg({ mode: 'team', format: 'p24', entrants: names(5, 'T') }));
  const seen = new Set();
  t.rounds.forEach((r) => r.matches.forEach((m) => {
    const k = [m.a[0], m.b[0]].sort().join();
    assert.ok(!seen.has(k));
    seen.add(k);
  }));
  assert.equal(seen.size, 10);
  playOut(t);
});

test('King of the Court: Sieger rauf, Verlierer runter, Wartende rein', () => {
  const t = E.create(cfg({ mode: 'kotc', format: 'win', courts: 3, entrants: names(7, 'T'), options: { rounds: 5, roundMinutes: 10 } }));
  const r0 = t.rounds[0];
  assert.equal(r0.matches.length, 3);
  assert.equal(r0.byes.length, 1);
  r0.matches.forEach((m) => E.setResult(t, m.id, { w: 'a' }));
  E.advance(t);
  const [c1, c2, c3] = r0.matches;
  const ids = (m) => m.a.concat(m.b).sort();
  const r1 = t.rounds[1];
  assert.deepEqual(ids(r1.matches[0]), [c1.a[0], c2.a[0]].sort());
  assert.deepEqual(ids(r1.matches[1]), [c1.b[0], c3.a[0]].sort());
  assert.deepEqual(ids(r1.matches[2]), [c2.b[0], r0.byes[0]].sort());
  assert.deepEqual(r1.byes, [c3.b[0]]);
  playOut(t);
});

test('King of the Court: stärkste Teams starten oben', () => {
  const teams = [['Anfänger', 'beginner'], ['Profis', 'pro'], ['Mitte', 'intermediate'], ['Profis 2', 'pro']].map(([name, level]) => ({ name, members: [{ name: name + ' A', level }, { name: name + ' B', level }] }));
  const t = E.create(cfg({ mode: 'kotc', format: 'win', courts: 2, entrants: teams, options: { rounds: 3, roundMinutes: 10 } }));
  const top = t.rounds[0].matches[0];
  assert.deepEqual([E.nameOf(t, top.a[0]), E.nameOf(t, top.b[0])].sort(), ['Profis', 'Profis 2']);
});

test('Teambildung: gut mit gut / gut mit schwächer', () => {
  const players = [4.8, 4.1, 3.6, 3.0, 2.2, 1.4].map((rating, i) => ({ name: 'P' + i, rating }));
  const sim = E.buildTeams(players, 'similar');
  assert.deepEqual(sim.teams.map((tm) => tm.map((p) => p.rating)), [[4.8, 4.1], [3.6, 3.0], [2.2, 1.4]]);
  const bal = E.buildTeams(players, 'balanced');
  const sums = bal.teams.map((tm) => tm[0].rating + tm[1].rating);
  assert.ok(Math.max(...sums) - Math.min(...sums) < 0.8, 'ausgeglichene Teams');
  assert.equal(bal.leftover, null);
  const odd = E.buildTeams(players.slice(0, 5), 'similar');
  assert.equal(odd.teams.length, 2);
  assert.ok(odd.leftover);
});

test('Spielstärke: Playtomic vor Selbsteinschätzung', () => {
  assert.equal(E.strengthOf({ level: 'pro' }), 4.5);
  assert.equal(E.strengthOf({ level: 'beginner', rating: 3.2 }), 3.2);
  assert.equal(E.strengthOf({ members: [{ rating: 4 }, { level: 'beginner' }] }), 2.75);
  assert.equal(E.parseRating('3,45'), 3.5);
  assert.equal(E.parseRating('9'), null);
  assert.equal(E.levelLabel({ rating: 3 }), 'Playtomic 3,0');
});

test('Ergebnisprüfung', () => {
  const f = E.FORMATS;
  assert.ok(E.checkScore(f.p24, { a: 12, b: 11 }, true).error);
  assert.equal(E.checkScore(f.p24, { a: 12, b: 12 }, true).error, null);
  assert.ok(E.checkScore(f.win, { w: 'x' }, false).error);
  assert.ok(E.checkScore(f.r11, { a: 11, b: 10 }, true).warn);
});

test('Roster: Person zieht zurück, spätere Runden ohne sie', () => {
  const t = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(9), options: { rounds: 6 } }));
  t.rounds[0].matches.forEach((m) => E.setResult(t, m.id, { a: 12, b: 12 }));
  E.advance(t);
  const quitter = t.rounds[1].matches[0].a[0];
  assert.ok(E.setActive(t, quitter, false).ok);
  t.rounds.slice(1).forEach((r) => r.matches.forEach((m) => assert.ok(!m.a.concat(m.b).includes(quitter))));
  assert.ok(E.addEntrant(t, { name: 'Neu', level: 'pro' }).ok);
  assert.equal(t.rounds.length, 6);
});

test('Zusatzrunde nach Turnierende', () => {
  const t = E.create(cfg({ mode: 'kotc', format: 'win', entrants: names(4, 'T'), options: { rounds: 1, roundMinutes: 10 } }));
  playOut(t);
  assert.ok(E.addRound(t).ok);
  assert.equal(t.status, 'running');
  assert.equal(t.cur, 1);
});

test('Rundenzahl nachträglich ändern', () => {
  const t = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(8), options: { rounds: 4 } }));
  t.rounds[0].matches.forEach((m) => E.setResult(t, m.id, { a: 12, b: 12 }));
  E.advance(t);
  assert.ok(E.setPlannedRounds(t, 7).ok);
  assert.equal(t.rounds.length, 7);
  assert.equal(partnerRepeats(t), 0, 'Ergänzte Runden setzen die Rotation fort');
  E.setPlannedRounds(t, 1);
  assert.equal(t.options.rounds, 2, 'Gespielte und laufende Runden bleiben');
  assert.equal(t.rounds.length, 2);
  const k = E.create(cfg({ mode: 'kotc', format: 'win', entrants: names(4, 'T'), options: { rounds: 1, roundMinutes: 10 } }));
  playOut(k);
  assert.ok(E.setPlannedRounds(k, 3).ok);
  assert.equal(k.status, 'running');
  assert.equal(k.cur, 1);
  assert.equal(E.setPlannedRounds(E.create(cfg({ mode: 'team', format: 'p24', entrants: names(4, 'T') })), 9).ok, false);
});

test('Zeitlimit: Spiel auf 24 darf vorher enden', () => {
  const f = E.FORMATS.p24;
  assert.ok(E.checkScore(f, { a: 10, b: 8 }, true).error, 'ohne Timer muss die Summe stimmen');
  const capped = E.checkScore(f, { a: 10, b: 8 }, true, true);
  assert.equal(capped.error, null);
  assert.ok(capped.warn);
  assert.ok(E.checkScore(f, { a: 20, b: 8 }, true, true).error, 'mehr als 24 geht nie');
  assert.ok(E.checkScore(f, { a: 2.5, b: 21.5 }, true).error, 'nur ganze Punkte');
  const t = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(8), options: { rounds: 3, roundMinutes: 10 } }));
  assert.ok(E.setResult(t, t.rounds[0].matches[0].id, { a: 11, b: 7 }).ok);
});

test('Satz-Ergebnisse: unmögliche Stände werden gemeldet', () => {
  const { g4, g6 } = E.FORMATS;
  assert.equal(E.checkScore(g4, { a: 4, b: 3 }, true).warn, null);
  assert.ok(E.checkScore(g4, { a: 5, b: 3 }, true).warn);
  assert.equal(E.checkScore(g6, { a: 7, b: 6 }, true).warn, null);
  assert.equal(E.checkScore(g6, { a: 6, b: 4 }, true).warn, null);
  assert.ok(E.checkScore(g6, { a: 6, b: 5 }, true).warn);
  assert.ok(E.checkScore(g6, { a: 7, b: 3 }, true).warn);
});

test('Vorzeitig beenden: ungespielte Runden fallen weg, Siegerehrung nur mit Ergebnissen', () => {
  const t = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(9), options: { rounds: 9 } }));
  E.finish(t);
  assert.deepEqual(E.podium(t), [], 'ohne Ergebnis keine Sieger');
  const u = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(9), options: { rounds: 9 } }));
  u.rounds[0].matches.forEach((m) => E.setResult(u, m.id, { a: 14, b: 10 }));
  E.advance(u);
  E.finish(u);
  assert.equal(u.rounds.length, 1, 'leere Runde 2 und alle späteren sind weg');
  assert.equal(u.cur, 0);
  const rows = E.standings(u).rows;
  assert.ok(rows.every((r) => r.byes <= 1));
  assert.ok(E.addRound(u).ok);
  assert.equal(u.status, 'running');
  assert.equal(E.plannedRounds(u), 2);
});

test('Nachmeldung spielt sofort, statt zuerst auszusetzen', () => {
  for (let i = 0; i < 10; i++) {
    const t = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(8), options: { rounds: 5 } }));
    t.rounds[0].matches.forEach((m) => E.setResult(t, m.id, { a: 12, b: 12 }));
    E.advance(t);
    assert.ok(E.addEntrant(t, { name: 'Neu' }).ok);
    const neu = t.entrants.find((e) => e.name === 'Neu').id;
    assert.ok(!t.rounds[1].byes.includes(neu));
  }
});

test('Team-Turnier: Zusatzrunde entsteht erst, wenn sie dran ist, ohne Pausenbonus', () => {
  const t = E.create(cfg({ mode: 'team', format: 'p24', courts: 1, entrants: names(5, 'T') }));
  const planned = t.rounds.length;
  assert.ok(E.addRound(t).ok);
  assert.equal(t.rounds.length, planned, 'noch nicht ausgelost');
  assert.equal(E.plannedRounds(t), planned + 1);
  playOut(t);
  assert.equal(t.rounds.length, planned + 1);
  assert.ok(E.standings(t).rows.every((r) => r.bonus === 0));
});

test('King of the Court: Platzpunkte zählen nur genutzte Plätze', () => {
  const t = E.create(cfg({ mode: 'kotc', format: 'win', courts: 4, entrants: names(4, 'T'), options: { rounds: 2, roundMinutes: 10, ranking: 'points' } }));
  assert.equal(t.rounds[0].matches.length, 2);
  t.rounds[0].matches.forEach((m) => E.setResult(t, m.id, { w: 'a' }));
  const top = E.standings(t).rows[0];
  assert.equal(top.cp, 2);
  assert.ok(E.roundTimed(t));
});

test('Standard-Rundenzahl: alle Partner einmal, Pausen gleich verteilt', () => {
  const d = (n, courts, format = 'p16') => E.defaultRounds({ mode: 'americano', format, courts, entrants: names(n), options: {} });
  assert.equal(d(8, 2, 'p24'), 7);
  assert.equal(d(9, 2), 9);
  assert.equal(d(5, 1), 5);
  assert.equal(d(6, 1, 'p24'), 6);
  assert.deepEqual(E.fullRotation(9, 2), { rounds: 9, idle: 1, exact: true });
  assert.equal(E.fullRotation(8, 1).exact, false);
});
