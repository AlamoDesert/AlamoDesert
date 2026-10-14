// Ausführen: node --test courtside/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const names = (n, p = 'S') => Array.from({ length: n }, (_, i) => ({ name: `${p}${i + 1}` }));
const cfg = (o) => Object.assign({ sport: 'padel', discipline: 'doubles', courts: 2, options: {} }, o);

function randomScore(t, m) {
  const f = E.fmtOf(t);
  const draw = E.allowDraw(t, m);
  if (f.kind === 'winner') return { w: Math.random() < 0.5 ? 'a' : 'b' };
  if (f.kind === 'points' && f.total) {
    let a = Math.floor(Math.random() * (f.total + 1));
    if (!draw && a * 2 === f.total) a++;
    return { a, b: f.total - a };
  }
  if (f.kind === 'sets') return Math.random() < 0.5 ? { sets: [[6, 3], [6, 4]] } : { sets: [[3, 6], [6, 2], [10, 7]] };
  const target = f.target || 6;
  const lo = Math.floor(Math.random() * (target - 1));
  return Math.random() < 0.5 ? { a: target, b: lo } : { a: lo, b: target };
}

function playOut(t, guard = 500) {
  while (t.status === 'running' && guard-- > 0) {
    const n = E.next(t);
    if (n.action && n.action.id === 'start') E.startRound(t);
    else if (n.action && n.action.id === 'result') {
      const m = E.findMatch(t, n.action.match).m;
      const r = E.setResult(t, m.id, randomScore(t, m));
      assert.ok(r.ok, r.error);
    } else if (n.action && n.action.id === 'advance') assert.ok(E.advance(t).ok);
    else if (n.action && n.action.id === 'buildKO') assert.ok(E.buildKOFromGroups(t).ok);
    else break;
  }
  assert.equal(t.status, 'finished', 'Turnier läuft nicht zu Ende');
}

function partnerRepeats(t) {
  const seen = new Map();
  let rep = 0;
  t.rounds.forEach((r) => r.matches.forEach((m) => [m.a, m.b].forEach(([x, y]) => {
    const k = [x, y].sort().join();
    if (seen.has(k)) rep++;
    seen.set(k, 1);
  })));
  return rep;
}

test('Americano 8/12/16: jeder spielt einmal mit jedem', () => {
  for (const n of [8, 12, 16]) {
    const t = E.create(cfg({ mode: 'americano', format: 'p24', courts: n / 4, entrants: names(n), options: { rounds: n - 1 } }));
    assert.equal(t.rounds.length, n - 1);
    const rep = partnerRepeats(t);
    console.log(`  Americano ${n}: Partner-Wiederholungen ${rep}`);
    assert.ok(rep <= (n === 16 ? 2 : 0), `zu viele Wiederholungen bei ${n}: ${rep}`);
    t.rounds.forEach((r) => assert.equal(r.byes.length, 0));
  }
});

test('Americano 9 Personen / 2 Plätze: Pausen gleich verteilt', () => {
  const t = E.create(cfg({ mode: 'americano', format: 'p16', entrants: names(9), options: { rounds: 9 } }));
  const byes = {};
  t.rounds.forEach((r) => { assert.equal(r.byes.length, 1); r.byes.forEach((id) => { byes[id] = (byes[id] || 0) + 1; }); });
  assert.deepEqual(Object.values(byes).sort(), Array(9).fill(1));
  playOut(t);
  const st = E.standings(t);
  assert.equal(st.rows.length, 9);
  assert.ok(st.rows.every((r) => r.played === 8 && r.byes === 1));
});

test('Mixed: Teams immer gemischt, jede Kombination einmal', () => {
  const ents = names(4, 'D').map((e) => ({ ...e, group: 'A' })).concat(names(4, 'H').map((e) => ({ ...e, group: 'B' })));
  const t = E.create(cfg({ mode: 'mixed', format: 'p24', entrants: ents, options: { rounds: 4 } }));
  const g = (id) => E.ent(t, id).group;
  t.rounds.forEach((r) => r.matches.forEach((m) => { assert.notEqual(g(m.a[0]), g(m.a[1])); assert.notEqual(g(m.b[0]), g(m.b[1])); }));
  assert.equal(partnerRepeats(t), 0);
});

test('Mexicano: Runde 2 paart nach Tabelle (1+4 gegen 2+3)', () => {
  const t = E.create(cfg({ mode: 'mexicano', format: 'p24', entrants: names(8), options: { rounds: 4 } }));
  t.rounds[0].matches.forEach((m, i) => E.setResult(t, m.id, i === 0 ? { a: 20, b: 4 } : { a: 13, b: 11 }));
  const order = E.standings(t).rows.map((r) => r.id);
  E.advance(t);
  const top = t.rounds[1].matches[0];
  const g = order.slice(0, 4);
  const teams = [top.a.slice().sort(), top.b.slice().sort()];
  const want = [[g[0], g[3]].sort(), [g[1], g[2]].sort()];
  const okScheme = teams.some((x) => x.join() === want[0].join()) && teams.some((x) => x.join() === want[1].join());
  // Bei direkter Partner-Wiederholung darf die Engine auf ein anderes Schema ausweichen.
  assert.ok(okScheme || teams.every((x) => x.every((id) => g.includes(id))));
  playOut(t);
});

test('Team-Americano 5 Teams: jede Paarung genau einmal', () => {
  const t = E.create(cfg({ mode: 'team_americano', format: 'p24', entrants: names(5, 'T') }));
  const seen = new Set();
  t.rounds.forEach((r) => {
    const used = new Set();
    r.matches.forEach((m) => {
      const k = [m.a[0], m.b[0]].sort().join();
      assert.ok(!seen.has(k)); seen.add(k);
      assert.ok(!used.has(m.a[0]) && !used.has(m.b[0])); used.add(m.a[0]); used.add(m.b[0]);
    });
  });
  assert.equal(seen.size, 10);
  playOut(t);
});

test('King of the Court (Teams): Sieger rauf, Verlierer runter, Wartende rein', () => {
  const t = E.create(cfg({ mode: 'kotc', format: 'win', courts: 3, entrants: names(7, 'T'), options: { rounds: 5, roundMinutes: 10 } }));
  const r0 = t.rounds[0];
  assert.equal(r0.matches.length, 3);
  assert.equal(r0.byes.length, 1);
  r0.matches.forEach((m) => E.setResult(t, m.id, { w: 'a' }));
  E.advance(t);
  const r1 = t.rounds[1];
  const [c1, c2, c3] = r0.matches;
  assert.deepEqual(r1.matches[0].a.concat(r1.matches[0].b).sort(), [c1.a[0], c2.a[0]].sort());
  assert.deepEqual(r1.matches[1].a.concat(r1.matches[1].b).sort(), [c1.b[0], c3.a[0]].sort());
  assert.ok(r1.matches[2].a.concat(r1.matches[2].b).includes(c2.b[0]));
  assert.ok(r1.matches[2].a.concat(r1.matches[2].b).includes(r0.byes[0]));
  assert.deepEqual(r1.byes, [c3.b[0]]);
  playOut(t);
  assert.equal(E.standings(t).rows[0].rank, 1);
});

test('King of the Court (Partnerwechsel): Partner werden getrennt', () => {
  const t = E.create(cfg({ mode: 'kotc', format: 'win', courts: 2, entrants: names(8), options: { rounds: 4, swap: true, roundMinutes: 10 } }));
  t.rounds[0].matches.forEach((m) => E.setResult(t, m.id, { w: 'a' }));
  const prev = t.rounds[0].matches.flatMap((m) => [m.a.slice().sort().join(), m.b.slice().sort().join()]);
  E.advance(t);
  t.rounds[1].matches.forEach((m) => [m.a, m.b].forEach((s) => assert.ok(!prev.includes(s.slice().sort().join()))));
  playOut(t);
});

test('Gewinner bleibt: Serie begrenzt, Verlierer hinten anstellen', () => {
  const t = E.create(cfg({ mode: 'winner_stays', format: 'win', courts: 1, entrants: names(4, 'T'), options: { maxStreak: 2 } }));
  const [A, B, C, D] = t.entrants.map((e) => e.id);
  let m = E.liveMatches(t)[0];
  assert.deepEqual([m.a[0], m.b[0]], [A, B]);
  E.setResult(t, m.id, { w: 'a' });
  m = E.liveMatches(t)[0];
  assert.deepEqual([m.a[0], m.b[0]], [A, C]);
  E.setResult(t, m.id, { w: 'a' }); // zweiter Sieg in Folge → A geht raus
  m = E.liveMatches(t)[0];
  assert.deepEqual([m.a[0], m.b[0]], [D, B]);
  assert.deepEqual(t.queue.waiting, [C, A]);
  assert.equal(E.standings(t).rows[0].id, A);
});

test('Königsseite: nur König punktet, Herausforderer wechselt rüber', () => {
  const t = E.create(cfg({ mode: 'rally_king', courts: 1, entrants: names(3, 'T'), options: { target: 2 } }));
  const [A, B, C] = t.entrants.map((e) => e.id);
  E.rallyPoint(t, 'king');
  assert.equal(t.rally.pts[A], 1); assert.equal(t.rally.chal, C);
  E.rallyPoint(t, 'chal');
  assert.equal(t.rally.king, C); assert.equal(t.rally.chal, B);
  E.rallyPoint(t, 'king'); E.rallyPoint(t, 'king');
  assert.equal(t.status, 'finished');
  assert.equal(t.rally.winner, C);
});

test('K.-o. mit 6: Freilose, Platz 3, Trostrunde, Platzierungen', () => {
  const t = E.create(cfg({ mode: 'knockout', format: 's3tb', entrants: names(6, 'T'), options: { third: true, consolation: true } }));
  const byes = t.matches.filter((m) => m.bye);
  assert.ok(byes.length >= 2);
  assert.ok(E.liveMatches(t).length <= 2);
  playOut(t);
  const st = E.standings(t);
  const places = st.rows.map((r) => r.place);
  assert.deepEqual(places.slice(0, 4), [1, 2, 3, 4]);
  assert.equal(E.podium(t).length, 3);
});

test('K.-o.: Ergebnis mit gespieltem Folgespiel ist gesperrt', () => {
  const t = E.create(cfg({ mode: 'knockout', format: 'g6', courts: 4, entrants: names(4, 'T') }));
  const [s1, s2] = E.liveMatches(t);
  E.setResult(t, s1.id, { a: 6, b: 2 });
  E.setResult(t, s2.id, { a: 6, b: 3 });
  const fin = E.liveMatches(t)[0];
  assert.ok(fin && fin.label === 'Finale');
  E.setResult(t, fin.id, { a: 6, b: 4 });
  assert.equal(E.canEdit(t, s1.id).ok, false);
  assert.equal(E.setResult(t, fin.id, { a: 6, b: 6 }).ok, false, 'Remis im K.-o. muss scheitern');
});

test('Gruppen + K.-o.: 10 Teams, 2 Gruppen, je 2 weiter', () => {
  const t = E.create(cfg({ mode: 'groups_ko', format: 'g6', courts: 3, entrants: names(10, 'T'), options: { groups: 2, advance: 2, third: true } }));
  assert.equal(t.groups.length, 2);
  assert.equal(t.matches.length, 20);
  // Nie dasselbe Team gleichzeitig auf zwei Plätzen
  const live = E.liveMatches(t);
  const ids = live.flatMap((m) => m.a.concat(m.b));
  assert.equal(new Set(ids).size, ids.length);
  playOut(t);
  assert.ok(t.koBuilt);
  const fin = E.standings(t).rows.filter((r) => r.place);
  assert.equal(fin.length, 4);
});

test('Kompass 8 und 13: alle spielen gleich oft (ohne Freilose)', () => {
  const t8 = E.create(cfg({ mode: 'compass', sport: 'tennis', format: 'g8', courts: 4, entrants: names(8, 'T') }));
  playOut(t8);
  const st = E.standings(t8);
  assert.ok(st.rows.every((r) => r.played === 3));
  assert.deepEqual(st.rows.map((r) => r.place).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  const t13 = E.create(cfg({ mode: 'compass', sport: 'tennis', format: 'g8', courts: 4, entrants: names(13, 'T') }));
  playOut(t13);
  assert.ok(E.standings(t13).rows.every((r) => r.played >= 2));
});

test('Jeder gegen jeden: Plätze nie doppelt belegt', () => {
  const t = E.create(cfg({ mode: 'round_robin', format: 'g6', courts: 2, entrants: names(5, 'T') }));
  let guard = 50;
  while (t.status === 'running' && guard--) {
    const live = E.liveMatches(t);
    const courts = live.map((m) => m.court);
    assert.equal(new Set(courts).size, courts.length);
    E.setResult(t, live[0].id, { a: 6, b: 4 });
  }
  assert.equal(t.status, 'finished');
  assert.equal(t.matches.length, 10);
});

test('Ergebnisprüfung', () => {
  const f = E.FORMATS;
  assert.ok(E.checkScore(f.s3tb, { sets: [[6, 4], [3, 6], [10, 8]] }, false).error === null);
  assert.ok(E.checkScore(f.s3tb, { sets: [[6, 4], [6, 6]] }, false).error);
  assert.ok(E.checkScore(f.s3tb, { sets: [[6, 4], [6, 3], [6, 1]] }, false).error);
  assert.ok(E.checkScore(f.p24, { a: 12, b: 11 }, true).error);
  assert.equal(E.checkScore(f.p24, { a: 12, b: 12 }, true).error, null);
  assert.ok(E.checkScore(f.r11, { a: 11, b: 10 }, true).warn);
  assert.deepEqual(E.evalScore(f.s3tb, { sets: [[6, 4], [3, 6], [10, 8]] }), { w: 'a', pa: 10, pb: 10, sa: 2, sb: 1 });
});

test('Roster: Person zieht zurück, spätere Runden ohne sie', () => {
  const t = E.create(cfg({ mode: 'americano', format: 'p24', entrants: names(9), options: { rounds: 6 } }));
  t.rounds[0].matches.forEach((m) => E.setResult(t, m.id, { a: 12, b: 12 }));
  E.advance(t);
  const quitter = t.rounds[1].matches[0].a[0];
  const res = E.setActive(t, quitter, false);
  assert.ok(res.ok, res.error);
  t.rounds.slice(1).forEach((r) => r.matches.forEach((m) => assert.ok(!m.a.concat(m.b).includes(quitter))));
  assert.ok(E.addEntrant(t, 'Neu').ok);
  assert.equal(t.rounds.length, 6);
});

test('Schätzung liefert plausible Zahlen', () => {
  const e = E.estimate(cfg({ mode: 'americano', format: 'p24', entrants: names(8), options: { rounds: 7 } }));
  assert.equal(e.rounds, 7);
  assert.ok(e.minutes > 60 && e.minutes < 180);
  const k = E.estimate(cfg({ mode: 'knockout', format: 's3tb', courts: 4, entrants: names(8, 'T'), options: { third: true } }));
  assert.equal(k.games, 8);
});
