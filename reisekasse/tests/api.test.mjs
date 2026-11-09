// Ausführen: node --experimental-strip-types --test tests/api.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../server/core.mts';
import { d1Store, SCHEMA_STATEMENTS } from '../server/d1-store.mts';
import { memoryStore } from '../server/memory-store.mjs';

// D1-Attrappe auf node:sqlite: gleiche Aufrufform wie die echte Datenbank.
function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  const wrap = (text, args = []) => ({
    bind: (...v) => wrap(text, v),
    first: async () => sql.prepare(text).get(...args) ?? null,
    all: async () => ({ results: sql.prepare(text).all(...args).map((r) => ({ ...r })) }),
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  const db = {
    prepare: (text) => wrap(text),
    batch: async (stmts) => { const out = []; for (const s of stmts) out.push(await s.run()); return out; }
  };
  return db;
}
async function d1WithSchema() {
  const db = fakeD1();
  await db.batch(SCHEMA_STATEMENTS.map((s) => db.prepare(s)));
  return d1Store(db);
}

const STORES = [['Arbeitsspeicher', async () => memoryStore()], ['D1', d1WithSchema]];
const MEMBERS = ['anna', 'ben0', 'cara', 'dirk', 'emma', 'finn', 'gerd', 'hana', 'imke', 'jens'].map((id, i) => ({
  id, name: id[0].toUpperCase() + id.slice(1), weight: 1, ...(i === 0 ? { paypal: 'anna@example.org', iban: 'DE02', bic: 'ABCDEFGH' } : {})
}));

async function setup(makeStore, members = MEMBERS) {
  const store = await makeStore();
  const clock = { t: 1_700_000_000_000 };
  const now = () => clock.t;
  let key = null;
  const call = async (method, path, body, k = key) => {
    const headers = {};
    if (k) headers.authorization = `Bearer ${k}`;
    let payload;
    if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await handle(new Request('http://x/api' + path, { method, headers, body: payload }), store, now);
    return { status: res.status, data: await res.json() };
  };
  const r = await call('POST', '/trips', { trip: { name: 'Italien', currency: 'EUR', members } });
  assert.equal(r.status, 201);
  key = r.data.key;
  return { store, call, clock, id: r.data.id, key, trip: r.data.trip, raw: (req) => handle(req, store, now) };
}

const entry = (over = {}) => ({
  kind: 'expense', title: 'Pizza', date: '2026-11-01', category: 'food', amount: 3000, currency: 'EUR', rate: null,
  payer: 'anna', split: { mode: 'shares', among: ['anna', 'ben0'] }, ...over
});
const items = (n = 2) => ({
  mode: 'items', among: ['anna', 'ben0'], items: Array.from({ length: n }, (_, i) => ({ id: `item${i}`, name: `Posten ${i}`, amount: 500, who: [] }))
});

for (const [sname, mk] of STORES) {
  const T = (name, fn) => test(`${name} [${sname}]`, () => fn(mk));

  T('Reise anlegen und lesen', async (mk) => {
    const { call, id, key, trip } = await setup(mk);
    assert.equal(id.length, 10);
    assert.ok(key.length >= 30);
    assert.equal(trip.id, id);
    assert.equal(trip.created, 1_700_000_000_000);
    const g = await call('GET', `/t/${id}`);
    assert.equal(g.status, 200);
    assert.equal(g.data.trip.name, 'Italien');
    assert.equal(g.data.trip.members[0].iban, 'DE02');
    assert.deepEqual(g.data.entries, []);
    assert.equal(g.data.tripT, 1_700_000_000_000);
    assert.equal(g.data.now, 1_700_000_000_000);
  });

  T('Zugriff: falscher Schlüssel, fehlender Schlüssel, unbekannte Reise', async (mk) => {
    const { call, id } = await setup(mk);
    for (const k of ['falsch', null]) {
      const r = await call('GET', `/t/${id}`, undefined, k);
      assert.equal(r.status, 403);
      assert.equal(r.data.error, 'Kein Zugriff auf diese Reise.');
    }
    const u = await call('GET', '/t/abcdefgh12');
    assert.equal(u.status, 404);
    assert.equal(u.data.error, 'Diese Reise gibt es nicht.');
    assert.equal((await call('GET', '/t/x')).status, 404);
  });

  T('Eintrag anlegen, ändern, löschen (Grabstein)', async (mk) => {
    const { call, id, clock } = await setup(mk);
    const p = await call('PUT', `/t/${id}/e/abc1`, { by: 'anna', entry: { ...entry(), id: 'fremd', createdBy: 'ben0', createdAt: 5, deleted: true, evil: 1 } });
    assert.equal(p.status, 200);
    const e = p.data.entry;
    assert.equal(e.id, 'abc1');
    assert.equal(e.createdBy, 'anna');
    assert.equal(e.createdAt, clock.t);
    assert.equal(e.deleted, undefined);
    assert.equal(e.evil, undefined);

    clock.t += 1000;
    const p2 = await call('PUT', `/t/${id}/e/abc1`, { by: 'ben0', entry: entry({ title: 'Pasta', amount: 4000 }) });
    assert.equal(p2.data.entry.title, 'Pasta');
    assert.equal(p2.data.entry.createdBy, 'anna');
    assert.equal(p2.data.entry.createdAt, e.createdAt);
    assert.equal(p2.data.entry.updatedBy, 'ben0');
    assert.equal(p2.data.entry.updatedAt, clock.t);

    clock.t += 1000;
    const d = await call('DELETE', `/t/${id}/e/abc1?by=cara`);
    assert.deepEqual(d.data, { ok: true });
    const g = await call('GET', `/t/${id}`);
    assert.equal(g.data.entries.length, 1);
    assert.deepEqual(g.data.entries[0], { id: 'abc1', deleted: true, updatedAt: clock.t, updatedBy: 'cara' });
    assert.equal((await call('DELETE', `/t/${id}/e/abc1?by=cara`)).status, 404);
    assert.equal((await call('DELETE', `/t/${id}/e/nix99?by=cara`)).status, 404);

    // Wieder anlegen unter derselben Kennung hebt den Grabstein auf
    clock.t += 1000;
    const p3 = await call('PUT', `/t/${id}/e/abc1`, { by: 'anna', entry: entry() });
    assert.equal(p3.data.entry.deleted, undefined);
    const log = (await call('GET', `/t/${id}/log`)).data.log;
    assert.deepEqual(log.map((l) => l.action), ['add', 'delete', 'edit', 'add']);
  });

  T('Abgleich mit since', async (mk) => {
    const { call, id, clock } = await setup(mk);
    await call('PUT', `/t/${id}/e/aaa1`, { by: 'anna', entry: entry() });
    clock.t += 60_000;
    const first = await call('GET', `/t/${id}`);
    const since = first.data.now;
    clock.t += 60_000;
    await call('PUT', `/t/${id}/e/bbb2`, { by: 'anna', entry: entry({ title: 'Eis' }) });
    const d = await call('GET', `/t/${id}?since=${since}`);
    assert.deepEqual(d.data.entries.map((e) => e.id), ['bbb2']);
    assert.equal(d.data.trip, null);
    // Überlappung von 5 s
    const o = await call('GET', `/t/${id}?since=${clock.t + 4000}`);
    assert.deepEqual(o.data.entries.map((e) => e.id), ['bbb2']);
    const none = await call('GET', `/t/${id}?since=${clock.t + 6000}`);
    assert.deepEqual(none.data.entries, []);
    // Reise nur, wenn geändert
    clock.t += 60_000;
    await call('PUT', `/t/${id}/trip`, { by: 'anna', trip: { name: 'Neu', currency: 'EUR', members: MEMBERS } });
    const t = await call('GET', `/t/${id}?since=${clock.t - 1000}`);
    assert.equal(t.data.trip.name, 'Neu');
    assert.equal(t.data.tripT, clock.t);
  });

  T('Posten beanspruchen: 10 gleichzeitige Zugriffe', async (mk) => {
    const { call, id } = await setup(mk);
    await call('PUT', `/t/${id}/e/rec1`, { by: 'anna', entry: entry({ split: items() }) });
    const results = await Promise.all(MEMBERS.map((m) =>
      call('POST', `/t/${id}/e/rec1/claim`, { item: 'item0', member: m.id, on: true, by: m.id })));
    assert.deepEqual(results.map((r) => r.status), Array(10).fill(200));
    const g = await call('GET', `/t/${id}`);
    const who = g.data.entries[0].split.items[0].who;
    assert.deepEqual(who, MEMBERS.map((m) => m.id)); // alle da, in Reihenfolge der Mitglieder
    assert.deepEqual(g.data.entries[0].split.items[1].who, []);
    const off = await call('POST', `/t/${id}/e/rec1/claim`, { item: 'item0', member: 'cara', on: false, by: 'anna' });
    assert.ok(!off.data.entry.split.items[0].who.includes('cara'));
    const log = (await call('GET', `/t/${id}/log?limit=100`)).data.log;
    assert.equal(log.filter((l) => l.action === 'claim').length, 11);
    assert.equal(log[0].before, undefined);
  });

  T('Posten beanspruchen: Fehler', async (mk) => {
    const { call, id } = await setup(mk);
    await call('PUT', `/t/${id}/e/rec1`, { by: 'anna', entry: entry({ split: items() }) });
    await call('PUT', `/t/${id}/e/rec2`, { by: 'anna', entry: entry() });
    assert.equal((await call('POST', `/t/${id}/e/rec1/claim`, { item: 'nix', member: 'anna', on: true, by: 'anna' })).status, 400);
    assert.equal((await call('POST', `/t/${id}/e/rec2/claim`, { item: 'item0', member: 'anna', on: true, by: 'anna' })).status, 400);
    assert.equal((await call('POST', `/t/${id}/e/rec1/claim`, { item: 'item0', member: 'fremd', on: true, by: 'anna' })).status, 400);
    assert.equal((await call('POST', `/t/${id}/e/zzzz/claim`, { item: 'item0', member: 'anna', on: true, by: 'anna' })).status, 404);
  });

  T('Wiederherstellen: Änderung, Löschen, Anlegen, Reise', async (mk) => {
    const { call, id, clock } = await setup(mk);
    await call('PUT', `/t/${id}/e/rec1`, { by: 'anna', entry: entry() });
    clock.t += 10;
    await call('PUT', `/t/${id}/e/rec1`, { by: 'anna', entry: entry({ title: 'Geändert' }) });
    clock.t += 10;
    let log = (await call('GET', `/t/${id}/log`)).data.log;
    assert.equal(log[0].action, 'edit');
    assert.equal(log[0].before.title, 'Pizza');
    const r1 = await call('POST', `/t/${id}/restore`, { log: log[0].key, by: 'ben0' });
    assert.equal(r1.status, 200);
    assert.equal(r1.data.entry.title, 'Pizza');
    assert.equal(r1.data.entry.updatedBy, 'ben0');

    clock.t += 10;
    await call('DELETE', `/t/${id}/e/rec1?by=anna`);
    clock.t += 10;
    log = (await call('GET', `/t/${id}/log`)).data.log;
    assert.equal(log[0].action, 'delete');
    const r2 = await call('POST', `/t/${id}/restore`, { log: log[0].key, by: 'anna' });
    assert.equal(r2.data.entry.title, 'Pizza');
    assert.equal(r2.data.entry.deleted, undefined);
    assert.equal((await call('GET', `/t/${id}`)).data.entries[0].title, 'Pizza');

    // 'add' rückgängig = löschen
    const addKey = (await call('GET', `/t/${id}/log?limit=100`)).data.log.find((l) => l.action === 'add').key;
    clock.t += 10;
    const r3 = await call('POST', `/t/${id}/restore`, { log: addKey, by: 'anna' });
    assert.equal(r3.data.entry.deleted, true);
    assert.equal((await call('GET', `/t/${id}`)).data.entries[0].deleted, true);
    assert.equal((await call('POST', `/t/${id}/restore`, { log: addKey, by: 'anna' })).status, 404);

    // Reise
    clock.t += 10;
    await call('PUT', `/t/${id}/trip`, { by: 'anna', trip: { name: 'Anders', currency: 'CHF', members: MEMBERS } });
    clock.t += 10;
    const tk = (await call('GET', `/t/${id}/log`)).data.log[0];
    assert.equal(tk.action, 'trip');
    const r4 = await call('POST', `/t/${id}/restore`, { log: tk.key, by: 'anna' });
    assert.equal(r4.data.trip.name, 'Italien');
    assert.equal(r4.data.trip.currency, 'EUR');
    assert.equal((await call('GET', `/t/${id}`)).data.trip.name, 'Italien');
    const last = (await call('GET', `/t/${id}/log`)).data.log[0];
    assert.equal(last.action, 'restore');

    // Nicht wiederherstellbar / ungültig
    assert.equal((await call('POST', `/t/${id}/restore`, { log: last.key, by: 'anna' })).status, 400);
    assert.equal((await call('POST', `/t/${id}/restore`, { log: 'quatsch', by: 'anna' })).status, 400);
    assert.equal((await call('POST', `/t/${id}/restore`, { log: '0000000000000-abcd', by: 'anna' })).status, 404);
  });

  T('Protokoll: Seiten', async (mk) => {
    const { call, id, clock } = await setup(mk);
    for (let i = 0; i < 7; i++) {
      clock.t += 5;
      await call('PUT', `/t/${id}/e/rec${i}`, { by: 'anna', entry: entry({ title: `E${i}` }) });
    }
    const p1 = (await call('GET', `/t/${id}/log?limit=3`)).data;
    assert.equal(p1.log.length, 3);
    assert.equal(p1.more, true);
    assert.deepEqual(p1.log.map((l) => l.after.title), ['E6', 'E5', 'E4']);
    assert.match(p1.log[0].key, /^\d{13}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    assert.equal(p1.log[0].at, clock.t);
    const p2 = (await call('GET', `/t/${id}/log?limit=3&before=${p1.log[2].key}`)).data;
    assert.deepEqual(p2.log.map((l) => l.after.title), ['E3', 'E2', 'E1']);
    assert.equal(p2.more, true);
    const p3 = (await call('GET', `/t/${id}/log?limit=3&before=${p2.log[2].key}`)).data;
    assert.deepEqual(p3.log.map((l) => l.after.title), ['E0']);
    assert.equal(p3.more, false);
    assert.equal((await call('GET', `/t/${id}/log?limit=0`)).data.log.length, 1); // auf 1 begrenzt
    assert.equal((await call('GET', `/t/${id}/log?before=x`)).status, 400);
  });

  T('Bilder: Hoch- und Herunterladen, Grenzen', async (mk) => {
    const { raw, id, key } = await setup(mk);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 250, 0, 7]);
    const post = (type, data, k = key) => raw(new Request(`http://x/api/t/${id}/img`, {
      method: 'POST', headers: { 'content-type': type, ...(k ? { authorization: `Bearer ${k}` } : {}) }, body: data
    }));
    const up = await post('image/jpeg', bytes);
    assert.equal(up.status, 201);
    const { img } = await up.json();
    assert.match(img, /^[a-z0-9]{4,24}$/);
    const down = await raw(new Request(`http://x/api/t/${id}/img/${img}`, { headers: { authorization: `Bearer ${key}` } }));
    assert.equal(down.status, 200);
    assert.equal(down.headers.get('content-type'), 'image/jpeg');
    assert.equal(down.headers.get('cache-control'), 'private, max-age=31536000, immutable');
    assert.deepEqual(new Uint8Array(await down.arrayBuffer()), bytes);
    assert.equal((await raw(new Request(`http://x/api/t/${id}/img/${img}`))).status, 403);
    assert.equal((await raw(new Request(`http://x/api/t/${id}/img/nix123`, { headers: { authorization: `Bearer ${key}` } }))).status, 404);

    const big = new Uint8Array(1_500_001); big[0] = 0xff; big[1] = 0xd8;
    assert.equal((await post('image/jpeg', big)).status, 413);
    const ok = new Uint8Array(1_500_000); ok[0] = 0xff; ok[1] = 0xd8;
    assert.equal((await post('image/jpeg', ok)).status, 201);
    assert.equal((await post('image/gif', bytes)).status, 415);
    assert.equal((await post('image/png', bytes)).status, 400); // Kennung passt nicht
    assert.equal((await post('image/jpeg', bytes, 'falsch')).status, 403);
  });

  T('Prüfung: Reise', async (mk) => {
    const { call, id } = await setup(mk);
    const bad = async (trip, text) => {
      const r = await call('POST', '/trips', { trip });
      assert.equal(r.status, 400, text);
      assert.ok(r.data.error);
    };
    const m = [{ id: 'anna', name: 'Anna', weight: 1 }];
    await bad({ name: '', currency: 'EUR', members: m }, 'Name leer');
    await bad({ name: 'x'.repeat(61), currency: 'EUR', members: m }, 'Name lang');
    await bad({ name: 'X', currency: 'eur', members: m }, 'Währung');
    await bad({ name: 'X', currency: 'EUR', members: [] }, 'keine Personen');
    await bad({ name: 'X', currency: 'EUR', members: Array.from({ length: 31 }, (_, i) => ({ id: `p${i}xx`, name: `P${i}`, weight: 1 })) }, '31 Personen');
    await bad({ name: 'X', currency: 'EUR', members: [m[0], { id: 'anna', name: 'Bert', weight: 1 }] }, 'doppelte Kennung');
    await bad({ name: 'X', currency: 'EUR', members: [m[0], { id: 'bert', name: 'ANNA', weight: 1 }] }, 'doppelter Name');
    await bad({ name: 'X', currency: 'EUR', members: [{ ...m[0], weight: 0 }] }, 'Gewicht 0');
    await bad({ name: 'X', currency: 'EUR', members: [{ ...m[0], weight: 11 }] }, 'Gewicht 11');
    await bad({ name: 'X', currency: 'EUR', members: [{ ...m[0], bic: '123456789012' }] }, 'BIC');
    await bad({ name: 'X', currency: 'EUR', members: [{ id: 'A!', name: 'A', weight: 1 }] }, 'Kennung');
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}xx`, name: `P${i}`, weight: 2.5 }));
    assert.equal((await call('POST', '/trips', { trip: { name: 'Voll', currency: 'USD', members: many } })).status, 201);
    assert.equal((await call('PUT', `/t/${id}/trip`, { by: 'anna', trip: { name: 'X', currency: 'EUR', members: [] } })).status, 400);
  });

  T('Prüfung: Eintrag', async (mk) => {
    const { call, id } = await setup(mk);
    const put = (e, by = 'anna') => call('PUT', `/t/${id}/e/rec1`, { by, entry: e });
    assert.equal((await put(entry(), 'fremd')).data.error, 'Unbekannte Person.');
    assert.equal((await put(entry({ payer: 'fremd' }))).status, 400);
    assert.equal((await put(entry({ kind: 'transfer', to: 'anna' }))).status, 400);
    assert.equal((await put(entry({ kind: 'transfer', to: undefined }))).status, 400);
    const tr = await put(entry({ kind: 'transfer', to: 'ben0', split: undefined }));
    assert.equal(tr.status, 200);
    assert.equal(tr.data.entry.to, 'ben0');
    assert.equal((await put(entry({ kind: 'foo' }))).status, 400);
    assert.equal((await put(entry({ date: '1.11.2026' }))).status, 400);
    assert.equal((await put(entry({ amount: 0 }))).status, 400);
    assert.equal((await put(entry({ amount: 12.5 }))).status, 400);
    assert.equal((await put(entry({ amount: 2e11 }))).status, 400);
    assert.equal((await put(entry({ title: 'x'.repeat(81) }))).status, 400);
    assert.equal((await put(entry({ category: 'x'.repeat(21) }))).status, 400);
    assert.equal((await put(entry({ note: 'x'.repeat(501) }))).status, 400);
    assert.equal((await put(entry({ currency: 'usd' }))).status, 400);
    assert.equal((await put(entry({ currency: 'USD', rate: null }))).status, 400);
    assert.equal((await put(entry({ currency: 'USD', rate: 0 }))).status, 400);
    const fx = await put(entry({ currency: 'USD', rate: 0.92 }));
    assert.equal(fx.data.entry.rate, 0.92);
    assert.equal((await put(entry({ rate: 3 }))).data.entry.rate, null); // Reisewährung: kein Kurs
    assert.equal((await put(entry({ split: { mode: 'x', among: [] } }))).status, 400);
    assert.equal((await put(entry({ split: { mode: 'shares', among: ['fremd'] } }))).status, 400);
    assert.equal((await put(entry({ split: { mode: 'shares', among: ['anna'], weights: { anna: 11 } } }))).status, 400);
    assert.equal((await put(entry({ split: { mode: 'exact', among: ['anna'], exact: { anna: 1.5 } } }))).status, 400);
    assert.equal((await put(entry({ split: { mode: 'exact', among: ['anna'], exact: { anna: 3000 } } }))).status, 200);
    assert.equal((await put(entry({ split: { mode: 'items', among: ['anna'], items: [{ id: 'abcd', name: 'x', amount: -300, who: ['anna'] }] } }))).status, 200);
    assert.equal((await put(entry({ split: { mode: 'items', among: ['anna'], items: [{ id: 'abcd', name: 'x', amount: 1.5, who: [] }] } }))).status, 400);
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ id: `it${i}x`, name: 'x', amount: 1, who: [] }));
    assert.equal((await put(entry({ split: { mode: 'items', among: ['anna'], items: tooMany } }))).status, 400);
    assert.equal((await put(entry({ receipt: 'beleg123' }))).data.entry.receipt, 'beleg123');
    assert.equal((await put(entry({ receipt: '../x' }))).status, 400);
    assert.equal((await call('PUT', `/t/${id}/e/A!`, { by: 'anna', entry: entry() })).status, 400);
  });

  T('Obergrenze für Einträge', async (mk) => {
    const { call, id, store, clock } = await setup(mk);
    for (let i = 0; i < 1000; i++) {
      await store.put(`t/${id}/e/pre${String(i).padStart(4, '0')}`, JSON.stringify({ id: `pre${i}`, deleted: true }), { t: clock.t });
    }
    const r = await call('PUT', `/t/${id}/e/neu1`, { by: 'anna', entry: entry() });
    assert.equal(r.status, 400);
    assert.equal(r.data.error, 'Diese Reise hat zu viele Einträge.');
    // Vorhandene lassen sich weiter ändern
    assert.equal((await call('PUT', `/t/${id}/e/pre0000`, { by: 'anna', entry: entry() })).status, 200);
  });

  T('Reise ändern', async (mk) => {
    const { call, id, clock } = await setup(mk);
    clock.t += 100;
    const members = [...MEMBERS.slice(0, 3), { id: 'neu1', name: 'Neu', weight: 1.5 }];
    const r = await call('PUT', `/t/${id}/trip`, { by: 'cara', trip: { id: 'fremd', created: 1, name: ' Spanien  2026 ', currency: 'USD', members } });
    assert.equal(r.status, 200);
    assert.equal(r.data.trip.id, id);
    assert.equal(r.data.trip.created, 1_700_000_000_000);
    assert.equal(r.data.trip.name, 'Spanien 2026');
    assert.equal(r.data.trip.members.length, 4);
    assert.equal((await call('PUT', `/t/${id}/trip`, { by: 'fremd', trip: { name: 'X', currency: 'EUR', members } })).status, 400);
    const log = (await call('GET', `/t/${id}/log`)).data.log[0];
    assert.equal(log.action, 'trip');
    assert.equal(log.before.name, 'Italien');
    assert.equal(log.after.name, 'Spanien 2026');
    assert.equal((await call('GET', `/t/${id}`)).data.tripT, clock.t);
  });

  T('Routen: unbekannt und falsche Methode', async (mk) => {
    const { call, id } = await setup(mk);
    assert.equal((await call('GET', '/nix')).status, 404);
    assert.equal((await call('GET', '/trips')).status, 405);
    assert.equal((await call('POST', `/t/${id}`, {})).status, 405);
    assert.equal((await call('GET', `/t/${id}/trip`)).status, 405);
    assert.equal((await call('GET', `/t/${id}/e/abc1`)).status, 405);
    assert.equal((await call('GET', `/t/${id}/log/x`)).status, 404);
    assert.equal((await call('GET', `/t/${id}/unbekannt`)).status, 404);
  });

  T('Anfragegröße', async (mk) => {
    const { call, id } = await setup(mk);
    const r = await call('PUT', `/t/${id}/e/rec1`, { by: 'anna', entry: entry({ note: 'x'.repeat(70_000) }) });
    assert.equal(r.status, 413);
  });
}

// ---------- D1-Speicher: SQL und Semantik ----------
test('D1-Speicher: Anlegen, Bedingungen, Liste, Blobs', async () => {
  const s = await d1WithSchema();
  assert.equal(await s.get('a/1'), null);
  assert.equal(await s.put('a/1', 'x', { expectRev: null, t: 10 }), 1);
  assert.equal(await s.put('a/1', 'y', { expectRev: null }), false); // existiert schon
  assert.equal(await s.put('a/1', 'y', { expectRev: 5 }), false);
  assert.equal(await s.put('a/1', 'y', { expectRev: 1, t: 20 }), 2);
  assert.deepEqual(await s.get('a/1'), { val: 'y', rev: 2, t: 20 });
  assert.equal(await s.put('a/1', 'z', { t: 30 }), 3); // ohne Bedingung
  assert.equal(await s.put('a/2', 'n', { t: 40 }), 1); // ohne Bedingung, neu
  assert.equal(await s.put('b/1', 'o', { t: 50 }), 1);
  assert.equal(await s.put('a/3', 'q', { t: 60 }), 1);

  assert.deepEqual((await s.list('a/')).map((r) => r.key), ['a/1', 'a/2', 'a/3']);
  assert.deepEqual((await s.list('a/', { desc: true, limit: 2 })).map((r) => r.key), ['a/3', 'a/2']);
  assert.deepEqual((await s.list('a/', { since: 30 })).map((r) => r.key), ['a/2', 'a/3']);
  assert.deepEqual((await s.list('a/', { before: 'a/3', desc: true })).map((r) => r.key), ['a/2', 'a/1']);
  assert.deepEqual((await s.list('b/')).map((r) => r.val), ['o']);
  assert.deepEqual(await s.list('c/'), []);

  await s.del('a/2');
  assert.equal(await s.get('a/2'), null);

  assert.equal(await s.getBlob('i/1'), null);
  await s.putBlob('i/1', new Uint8Array([0, 1, 255]), 'image/png');
  await s.putBlob('i/1', new Uint8Array([9, 8]), 'image/webp');
  const b = await s.getBlob('i/1');
  assert.equal(b.type, 'image/webp');
  assert.deepEqual([...b.data], [9, 8]);
});

test('Speicher im Arbeitsspeicher: gleiche Semantik wie D1', async () => {
  const s = memoryStore();
  assert.equal(await s.put('a/1', 'x', { expectRev: null, t: 10 }), 1);
  assert.equal(await s.put('a/1', 'y', { expectRev: null }), false);
  assert.equal(await s.put('a/1', 'y', { expectRev: 2 }), false);
  assert.equal(await s.put('a/1', 'y', { expectRev: 1, t: 20 }), 2);
  assert.equal(await s.put('a/1', 'z', { t: 30 }), 3);
  await s.put('a/2', 'n', { t: 40 });
  await s.put('b/1', 'o', { t: 50 });
  assert.deepEqual((await s.list('a/', { since: 30 })).map((r) => r.key), ['a/2']);
  assert.deepEqual((await s.list('a/', { before: 'a/2', desc: true })).map((r) => r.key), ['a/1']);
  assert.deepEqual((await s.list('a/', { desc: true, limit: 1 })).map((r) => r.key), ['a/2']);
});
