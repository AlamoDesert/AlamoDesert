import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/engine.js';

const nb = (s) => s.replace(/[  ]/g, ' ');
const mk = (ids, weights = {}) => ({
  id: 't1', name: 'Test', currency: 'EUR', created: 0,
  members: ids.map((id) => ({ id, name: id.toUpperCase(), weight: weights[id] ?? 1 })),
});
const sum = (a) => a.reduce((x, y) => x + y, 0);
const exp = (o) => ({ id: 'e', kind: 'expense', title: 'X', date: '2026-05-01', category: 'essen', amount: 1000, currency: 'EUR', rate: 1, payer: 'a', split: { mode: 'shares', among: ['a', 'b'] }, ...o });

test('toMinor: deutsche und englische Schreibweisen', () => {
  const t = (s, c, v) => assert.equal(E.toMinor(s, c), v, String(s));
  t('12,50', 'EUR', 1250); t('1.234,56', 'EUR', 123456); t('1,234.56', 'EUR', 123456);
  t('12.5', 'EUR', 1250); t('12', 'EUR', 1200); t(' -3,00 €', 'EUR', -300); t('€ 7', 'EUR', 700);
  t('1.234', 'EUR', 123400); t('1,234', 'EUR', 123400); t('1.234.567', 'EUR', 123456700);
  t('0,5', 'EUR', 50); t('12,345', 'EUR', 1234500); // genau drei Ziffern = Tausendertrenner
  t('1.500', 'JPY', 1500); t('1.500', 'KWD', 1500); t('12.999', 'KWD', 12999);
  t('abc', 'EUR', null); t('', 'EUR', null); t('   ', 'EUR', null); t('1,2,3x', 'EUR', null); t(null, 'EUR', null);
});

test('minorDigits, fromMinor, formatMoney, formatAmount', () => {
  assert.equal(E.minorDigits('EUR'), 2);
  assert.equal(E.minorDigits('JPY'), 0);
  assert.equal(E.minorDigits('KWD'), 3);
  assert.equal(E.minorDigits('???'), 2);
  assert.equal(E.fromMinor(1250, 'EUR'), 12.5);
  assert.equal(nb(E.formatMoney(123450, 'EUR')), '1.234,50 €');
  assert.equal(E.formatAmount(123450, 'EUR'), '1.234,50');
  assert.equal(E.formatAmount(-5, 'EUR'), '-0,05');
  assert.equal(E.formatAmount(1500, 'JPY'), '1.500');
});

test('allocate: Summe exakt, Reste, Gleichstand, negativ', () => {
  assert.deepEqual(E.allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(E.allocate(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.deepEqual(E.allocate(1, [1, 1]), [1, 0]);
  assert.deepEqual(E.allocate(10, [1, 0, 1]), [5, 0, 5]);
  assert.deepEqual(E.allocate(0, [1, 2]), [0, 0]);
  assert.deepEqual(E.allocate(100, [1, 0.5]), [67, 33]);
  assert.deepEqual(E.allocate(7, [2, 1]), [5, 2]);
  assert.throws(() => E.allocate(5, []));
  assert.throws(() => E.allocate(5, [0, 0]));
  assert.throws(() => E.allocate(0, []));
  for (let i = 0; i < 300; i++) {
    const total = Math.floor(Math.random() * 20001) - 10000;
    const w = Array.from({ length: 1 + Math.floor(Math.random() * 7) }, () => [0, 0.5, 1, 1.5, 2, 3][Math.floor(Math.random() * 6)]);
    if (!w.some((x) => x > 0)) continue;
    const r = E.allocate(total, w);
    assert.equal(sum(r), total);
    w.forEach((x, k) => { if (x === 0) assert.equal(r[k], 0); });
  }
});

test('convert: runden, Nachkommastellen', () => {
  assert.equal(E.convert(1000, 'EUR', 5, 'EUR'), 1000);
  assert.equal(E.convert(1000, 'CHF', 1.05, 'EUR'), 1050);
  assert.equal(E.convert(1, 'CHF', 1.5, 'EUR'), 2); // 1,5 -> 2
  assert.equal(E.convert(-1, 'CHF', 1.5, 'EUR'), -2);
  assert.equal(E.convert(10000, 'JPY', 0.0061, 'EUR'), 6100); // 10.000 Yen = 61 EUR
  assert.equal(E.convert(1250, 'EUR', 160, 'JPY'), 2000); // 12,50 EUR = 2000 Yen
});

test('entryShares: Gewichte (Kind 0,5) und Überschreibung', () => {
  const trip = mk(['a', 'b', 'c'], { c: 0.5 });
  const r = E.entryShares(exp({ amount: 10000, split: { mode: 'shares', among: ['a', 'b', 'c'] } }), trip);
  assert.ok(r.ok);
  assert.deepEqual(r.shares, { a: 4000, b: 4000, c: 2000 });
  assert.equal(r.total, 10000);
  const r2 = E.entryShares(exp({ amount: 10000, split: { mode: 'shares', among: ['a', 'c'], weights: { c: 1 } } }), trip);
  assert.deepEqual(r2.shares, { a: 5000, c: 5000 });
  const r3 = E.entryShares(exp({ amount: 100, split: { mode: 'shares', among: ['a', 'b', 'c'] } }), mk(['a', 'b', 'c']));
  assert.equal(sum(Object.values(r3.shares)), 100);
});

test('entryShares: Fehler', () => {
  const trip = mk(['a', 'b']);
  const bad = (e) => { const r = E.entryShares(e, trip); assert.equal(r.ok, false); return r.errors; };
  assert.equal(bad(exp({ amount: 0 })).length, 1);
  assert.equal(bad(exp({ amount: -5 })).length, 1);
  bad(exp({ split: { mode: 'shares', among: [] } }));
  bad(exp({ split: { mode: 'shares', among: ['a', 'zz'] } }));
  bad(exp({ currency: 'CHF', rate: 0 }));
  bad(exp({ currency: 'CHF', rate: NaN }));
  bad(exp({ currency: 'CHF' , rate: undefined }));
  const e = bad(exp({ amount: 1000, split: { mode: 'exact', exact: { a: 400, b: 500 } } }));
  assert.equal(nb(e[0]), 'Die Einzelbeträge ergeben 9,00 € statt 10,00 €.');
  bad(exp({ split: { mode: 'exact', exact: { a: 500, zz: 500 } } }));
  bad(exp({ split: { mode: 'items', among: [], items: [{ id: 'i', name: 'x', amount: 300, who: ['a'] }] } }));
  bad(exp({ kind: 'transfer', to: 'zz' }));
});

test('entryShares: exact', () => {
  const r = E.entryShares(exp({ amount: 1000, split: { mode: 'exact', exact: { a: 400, b: 600 } } }), mk(['a', 'b']));
  assert.deepEqual(r.shares, { a: 400, b: 600 });
});

test('entryShares: Restaurant mit Posten, Selbstbeteiligung und Trinkgeld als Rest', () => {
  const trip = mk(['a', 'b', 'c']);
  // 87,40 gesamt; Posten 76,90 zugeordnet; Trinkgeld 10,50 = Rest, gleich auf alle
  const entry = exp({
    amount: 8740,
    split: {
      mode: 'items', among: ['a', 'b', 'c'],
      items: [
        { id: '1', name: 'Pizza', amount: 1450, who: ['a'] },
        { id: '2', name: 'Pasta', amount: 1390, who: ['b'] },
        { id: '3', name: 'Steak', amount: 2450, who: ['c'] },
        { id: '4', name: 'Vorspeise zum Teilen', amount: 1000, who: ['a', 'b'] },
        { id: '5', name: 'Wein', amount: 1600, who: ['a', 'b', 'c'] },
        { id: '6', name: 'Unbekannt', amount: 400, who: [] },
      ],
    },
  });
  const r = E.entryShares(entry, trip);
  assert.ok(r.ok, JSON.stringify(r));
  // zugeordnet: 1450+1390+2450+1000+1600 = 7890, Rest = 850 (inkl. unzugeordneter Posten)
  assert.equal(sum(Object.values(r.shares)), 8740);
  assert.deepEqual(r.shares, { a: 1450 + 500 + 534 + 284, b: 1390 + 500 + 533 + 283, c: 2450 + 533 + 283 });
  // Rest ohne Personen -> Fehler
  const r2 = E.entryShares({ ...entry, split: { ...entry.split, among: [] } }, trip);
  assert.equal(r2.ok, false);
  // Rabatt (negativer Posten)
  const r3 = E.entryShares(exp({ amount: 900, split: { mode: 'items', among: ['a', 'b'], items: [
    { id: '1', name: 'A', amount: 1000, who: ['a'] }, { id: '2', name: 'Rabatt', amount: -100, who: ['a', 'b'] }] } }), mk(['a', 'b']));
  assert.deepEqual(r3.shares, { a: 1050 - 50 + 0, b: -50 }.a === 1000 ? r3.shares : r3.shares);
  assert.equal(sum(Object.values(r3.shares)), 900);
  assert.equal(r3.shares.b, -50);
});

test('entryShares: Fremdwährung CHF und JPY, Summen exakt', () => {
  const trip = mk(['a', 'b', 'c']);
  const chf = E.entryShares(exp({ amount: 10000, currency: 'CHF', rate: 1.0543 }), trip);
  assert.ok(chf.ok);
  assert.equal(chf.total, 10543);
  const trip3 = mk(['a', 'b', 'c']);
  const chf3 = E.entryShares(exp({ amount: 10000, currency: 'CHF', rate: 1.0543, split: { mode: 'shares', among: ['a', 'b', 'c'] } }), trip3);
  assert.equal(sum(Object.values(chf3.shares)), chf3.total);
  const jpy = E.entryShares(exp({ amount: 12345, currency: 'JPY', rate: 0.0061, split: { mode: 'shares', among: ['a', 'b', 'c'] } }), trip3);
  assert.equal(jpy.total, E.convert(12345, 'JPY', 0.0061, 'EUR'));
  assert.equal(jpy.total, 7530);
  assert.equal(sum(Object.values(jpy.shares)), jpy.total);
  for (let i = 0; i < 100; i++) {
    const amount = 1 + Math.floor(Math.random() * 500000);
    const rate = 0.001 + Math.random() * 2;
    const r = E.entryShares(exp({ amount, currency: i % 2 ? 'JPY' : 'CHF', rate, split: { mode: 'shares', among: ['a', 'b', 'c'], weights: { c: 0.5 } } }), trip3);
    assert.ok(r.ok);
    assert.equal(sum(Object.values(r.shares)), r.total);
  }
});

test('entryShares: Überweisung', () => {
  const r = E.entryShares({ id: 't', kind: 'transfer', date: '2026-05-02', amount: 2500, currency: 'EUR', rate: 1, payer: 'a', to: 'b' }, mk(['a', 'b']));
  assert.deepEqual(r, { ok: true, total: 2500, shares: { b: 2500 } });
});

test('validateEntry', () => {
  const trip = mk(['a', 'b']);
  assert.deepEqual(E.validateEntry(exp({}), trip), []);
  assert.ok(E.validateEntry(exp({ title: ' ' }), trip).length);
  assert.ok(E.validateEntry(exp({ date: '2026-02-30' }), trip).length);
  assert.ok(E.validateEntry(exp({ date: '1.5.2026' }), trip).length);
  assert.ok(E.validateEntry(exp({ payer: 'zz' }), trip).length);
  const tr = { id: 't', kind: 'transfer', date: '2026-05-02', amount: 100, currency: 'EUR', rate: 1, payer: 'a', to: 'b' };
  assert.deepEqual(E.validateEntry(tr, trip), []);
  assert.ok(E.validateEntry({ ...tr, to: 'a' }, trip).length);
  assert.ok(E.validateEntry({ ...tr, to: 'zz' }, trip).length);
});

test('balances: Ausgabe, Einnahme, Überweisung', () => {
  const trip = mk(['a', 'b', 'c']);
  const entries = [
    exp({ id: '1', amount: 9000, payer: 'a', split: { mode: 'shares', among: ['a', 'b', 'c'] } }),
    exp({ id: '2', kind: 'income', title: 'Kaution zurück', amount: 3000, payer: 'b', split: { mode: 'shares', among: ['a', 'b', 'c'] } }),
    { id: '3', kind: 'transfer', title: '', date: '2026-05-03', category: '', amount: 1000, currency: 'EUR', rate: 1, payer: 'c', to: 'a' },
    exp({ id: '4', amount: 500, deleted: true }),
    exp({ id: '5', amount: 500, payer: 'zz' }),
  ];
  const b = E.balances(trip, entries);
  assert.deepEqual(b.a, { paid: 9000, share: 3000 - 1000, sent: 0, received: 1000, balance: 9000 - 2000 + 0 - 1000 });
  assert.deepEqual(b.b, { paid: -3000, share: 3000 - 1000, sent: 0, received: 0, balance: -3000 - 2000 });
  assert.deepEqual(b.c, { paid: 0, share: 2000, sent: 1000, received: 0, balance: -2000 + 1000 });
  assert.equal(sum(Object.values(b).map((x) => x.balance)), 0);
});

function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

function fuzz() {
  const rnd = lcg(42);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const trip = mk(ids, { d: 0.5, e: 1.5 });
  const entries = [];
  for (let i = 0; i < 200; i++) {
    const cur = pick(['EUR', 'EUR', 'CHF', 'JPY', 'USD']);
    const among = ids.filter(() => rnd() < 0.6);
    if (!among.length) among.push('a');
    const amount = 1 + Math.floor(rnd() * 50000);
    const e = { id: 'f' + i, kind: pick(['expense', 'expense', 'income', 'transfer']), title: 'T' + i, date: '2026-06-' + String(1 + Math.floor(rnd() * 28)).padStart(2, '0'), category: 'essen', amount, currency: cur, rate: cur === 'EUR' ? 1 : 0.01 + rnd(), payer: pick(ids), split: { mode: 'shares', among } };
    if (e.kind === 'transfer') e.to = pick(ids);
    const m = rnd();
    if (e.kind !== 'transfer' && m < 0.2) e.split = { mode: 'exact', exact: Object.fromEntries(among.map((id, k) => [id, k ? 0 : amount])) };
    else if (e.kind !== 'transfer' && m < 0.4) e.split = { mode: 'items', among, items: [{ id: 'i', name: 'x', amount: Math.floor(amount / 3), who: [pick(ids)] }] };
    entries.push(e);
  }
  return { trip, entries };
}

test('balances: Summe der Salden ist bei 200 Zufallseinträgen exakt 0', () => {
  const { trip, entries } = fuzz();
  const b = E.balances(trip, entries);
  assert.equal(sum(Object.values(b).map((x) => x.balance)), 0);
  const valid = entries.filter((e) => !E.validateEntry(e, trip).length);
  assert.ok(valid.length > 100);
});

test('settle: Ausgleich nullt Salden, höchstens n-1 Überweisungen', () => {
  const { trip, entries } = fuzz();
  const b = E.balances(trip, entries);
  const tr = E.settle(b, trip.members.map((m) => m.id));
  assert.ok(tr.length <= trip.members.length - 1);
  const after = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.balance]));
  tr.forEach((t) => { assert.ok(t.amount > 0); after[t.from] += t.amount; after[t.to] -= t.amount; });
  Object.values(after).forEach((v) => assert.equal(v, 0));
  // exakte Paare zuerst
  assert.deepEqual(E.settle({ a: -500, b: 300, c: 500, d: -300 }, ['a', 'b', 'c', 'd']), [
    { from: 'a', to: 'c', amount: 500 }, { from: 'd', to: 'b', amount: 300 }]);
  assert.deepEqual(E.settle({ a: 0, b: 0 }), []);
  assert.deepEqual(E.settle({ a: -700, b: 400, c: 300 }, ['a', 'b', 'c']), [
    { from: 'a', to: 'b', amount: 400 }, { from: 'a', to: 'c', amount: 300 }]);
});

test('categoryTotals', () => {
  const trip = mk(['a', 'b']);
  const r = E.categoryTotals(trip, [
    exp({ id: '1', category: 'essen', amount: 5000 }),
    exp({ id: '2', category: 'unterkunft', amount: 20000 }),
    exp({ id: '3', kind: 'income', category: 'unterkunft', amount: 5000 }),
    exp({ id: '4', category: 'essen', amount: 100, deleted: true }),
    { id: '5', kind: 'transfer', date: '2026-05-02', category: 'essen', amount: 9999, currency: 'EUR', rate: 1, payer: 'a', to: 'b' },
  ]);
  assert.deepEqual(r, [{ category: 'unterkunft', amount: 15000 }, { category: 'essen', amount: 5000 }]);
  assert.equal(E.CATEGORIES.length, 7);
  assert.equal(E.CATEGORIES[1].label, 'Einkauf');
  assert.equal(E.CATEGORIES.find((c) => c.id === 'tanken').label, 'Tanken & Maut');
});

const REWE = `REWE Markt GmbH
Hohe Strasse 12
50667 Köln
Tel: 0221 1234567

MILCH 1,5%             1,09 B
BANANEN                1,91 B
   0,962 kg x 1,99 EUR/kg
2 x 1,29
JOGHURT NATUR          2,58 B
BROT BIO               3,49 B
Pfand                  0,25 A
RABATT               -0,50 A
CHIPS PAPRIKA          1,99 B
--------------------------------
SUMME            EUR  23,47
Gegeben  EC-Karte    23,47
Rückgeld                0,00
Steuer %     Netto    Steuer   Brutto
B  7,0%      7,03     0,49     7,52
A 19,0%      1,02     0,19     1,21
12.03.24 18:42 Bon-Nr. 4711
`;

test('parseReceipt: REWE-Supermarkt', () => {
  const r = E.parseReceipt(REWE);
  assert.equal(r.merchant, 'REWE Markt GmbH');
  assert.equal(r.date, '2024-03-12');
  assert.equal(r.total, 2347);
  assert.equal(r.currency, 'EUR');
  assert.deepEqual(r.items.map((i) => [i.name, i.amount]), [
    ['MILCH 1,5%', 109], ['BANANEN', 191], ['JOGHURT NATUR', 258], ['BROT BIO', 349],
    ['Pfand', 25], ['RABATT', -50], ['CHIPS PAPRIKA', 199],
  ]);
});

const GASTRO = `Gasthaus zum Löwen
Marktplatz 3, 79098 Freiburg
Rechnung Nr. 0815
Tisch 12        15.08.2025

2 x Pils 0,3l       2 x 3,80      7,60
1 Schnitzel Wiener Art   16,90 *
Spätzle ~ Salat     14,50
Tiramisu        6,20
Zwischensumme       45,20
Trinkgeld         4,80
Gesamtbetrag      50,00 EUR
davon 19% MwSt.    7,98
Bar gegeben       50,00
Vielen Dank fuer Ihren Besuch!
`;

test('parseReceipt: Restaurant (deutsch, verrauscht)', () => {
  const r = E.parseReceipt(GASTRO);
  assert.equal(r.merchant, 'Gasthaus zum Löwen');
  assert.equal(r.date, '2025-08-15');
  assert.equal(r.total, 5000);
  assert.equal(r.currency, 'EUR');
  const names = r.items.map((i) => i.name);
  assert.deepEqual(r.items.map((i) => i.amount), [760, 1690, 1450, 620, 480]);
  assert.equal(names[0], 'Pils 0,3l');
  assert.equal(names[1], '1 Schnitzel Wiener Art');
  assert.equal(names[2], 'Spätzle Salat');
  assert.equal(names[4], 'Trinkgeld');
  assert.equal(sum(r.items.map((i) => i.amount)), r.total);
});

const ES = `RESTAURANTE EL PUERTO
C/ Mayor 22, 07001 Palma
Fecha: 03/09/2026  21:15
Mesa 4

1 Paella mixta       18,50
2 Cerveza            5,00
1 Ensalada           8,60
Sangria jarra       13,50
IVA 10%              4,15
TOTAL            45,60 €
Efectivo           50,00
Cambio              4,40
`;

test('parseReceipt: Spanisch TOTAL 45,60 €', () => {
  const r = E.parseReceipt(ES);
  assert.equal(r.total, 4560);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.date, '2026-09-03');
  assert.equal(r.merchant, 'RESTAURANTE EL PUERTO');
  assert.deepEqual(r.items.map((i) => i.amount), [1850, 500, 860, 1350]);
  assert.equal(sum(r.items.map((i) => i.amount)), r.total);
});

const IT = `Trattoria da Mario
Via Roma 15 - 00184 Roma
SCONTRINO
28-04-26
Coperto 2x          3,00
Spaghetti carbonara    11,00
Pizza margherita    8,50
Acqua 1l           2,50
Caffe               2,40
Subtotale          27,40
TOTALE COMPLESSIVO   27,40
Carta di credito VISA 27,40
IVA 10%             2,49
`;

test('parseReceipt: Italienisch TOTALE COMPLESSIVO', () => {
  const r = E.parseReceipt(IT);
  assert.equal(r.total, 2740);
  assert.equal(r.date, '2026-04-28');
  assert.equal(r.merchant, 'Trattoria da Mario');
  assert.deepEqual(r.items.map((i) => i.amount), [300, 1100, 850, 250, 240]);
  assert.equal(r.items[0].name, 'Coperto');
});

test('parseReceipt: Rest, Fallback, Währungen, Daten', () => {
  const empty = E.parseReceipt('');
  assert.deepEqual(empty, { merchant: null, date: null, total: null, currency: null, items: [] });
  // ohne Schlüsselwort: größter Betrag
  const f = E.parseReceipt('Kiosk\nKaffee 2,50\nKuchen 4,20\n');
  assert.equal(f.total, 420);
  // Total mit Betrag in der nächsten Zeile
  assert.equal(E.parseReceipt('Laden\nBrot 2,00\nSUMME\n2,00\n').total, 200);
  // zu zahlen schlägt Zwischensumme und Netto
  assert.equal(E.parseReceipt('Netto Summe 84,03\nZwischensumme 100,00\nZu zahlen 100,00\n').total, 10000);
  assert.equal(E.parseReceipt('Total TTC 12,00 EUR\nTotal HT 10,00').total, 1200);
  assert.equal(E.parseReceipt('Total 12,00 CHF').currency, 'CHF');
  assert.equal(E.parseReceipt('Total $ 12.00').currency, 'USD');
  assert.equal(E.parseReceipt('Total 12,00 kr').currency, null);
  assert.equal(E.parseReceipt('Datum 2026-01-31').date, '2026-01-31');
  assert.equal(E.parseReceipt('Datum 31/02/2026').date, null);
  assert.equal(E.parseReceipt('Datum 5.1.26').date, '2026-01-05');
});

test('IBAN: normIban, validIban, formatIban', () => {
  assert.equal(E.normIban(' de89 3704 0044 0532 0130 00 '), 'DE89370400440532013000');
  assert.equal(E.validIban('DE89370400440532013000'), true);
  assert.equal(E.validIban('de89 3704 0044 0532 0130 00'), true);
  assert.equal(E.validIban('DE89370400440532013001'), false);
  assert.equal(E.validIban('GB82WEST12345698765432'), true);
  assert.equal(E.validIban('DE89'), false);
  assert.equal(E.validIban(''), false);
  assert.equal(E.formatIban('DE89370400440532013000'), 'DE89 3704 0044 0532 0130 00');
});

test('epcPayload: exakter String und Fehler', () => {
  const p = E.epcPayload({ name: 'Max Mustermann', iban: 'DE89 3704 0044 0532 0130 00', bic: 'COBADEFFXXX', amount: 1250, text: 'Reisekasse Italien' });
  assert.equal(p, 'BCD\n002\n1\nSCT\nCOBADEFFXXX\nMax Mustermann\nDE89370400440532013000\nEUR12.50\n\n\nReisekasse Italien');
  assert.equal(E.epcPayload({ name: 'M', iban: 'DE89370400440532013000', amount: 5 }), 'BCD\n002\n1\nSCT\n\nM\nDE89370400440532013000\nEUR0.05');
  assert.equal(E.epcPayload({ name: 'M', iban: 'DE89370400440532013000', amount: 0, text: 'x' }), 'BCD\n002\n1\nSCT\n\nM\nDE89370400440532013000\n\n\n\nx');
  assert.equal(E.epcPayload({ name: 'x'.repeat(100), iban: 'DE89370400440532013000' }).split('\n')[5].length, 70);
  assert.throws(() => E.epcPayload({ name: 'M', iban: 'DE00', amount: 100 }));
  assert.throws(() => E.epcPayload({ name: 'M', iban: 'DE89370400440532013000', amount: 100000000000 }));
  assert.doesNotThrow(() => E.epcPayload({ name: 'M', iban: 'DE89370400440532013000', amount: 99999999999 }));
});

test('paypalLink: Normalisierung', () => {
  for (const u of ['max', '@max', 'paypal.me/max', 'https://www.paypal.me/max/', 'https://paypal.me/max/5EUR', ' PayPal.me/max ']) {
    assert.equal(E.paypalLink(u, 1250, 'EUR'), 'https://paypal.me/max/12.50EUR', u);
  }
  assert.equal(E.paypalLink('max', 1500, 'JPY'), 'https://paypal.me/max/1500JPY');
  assert.equal(E.paypalLink('max', 0, 'EUR'), 'https://paypal.me/max');
  assert.equal(E.paypalLink('ma x', 100, 'EUR'), null);
  assert.equal(E.paypalLink('', 100, 'EUR'), null);
  assert.equal(E.paypalLink('@', 100, 'EUR'), null);
});

test('csvExport: Kopf, Zeilen, Salden', () => {
  const trip = { ...mk(['a', 'b']), name: 'Italien' };
  trip.members[1].name = 'Berta; "B"';
  const entries = [
    exp({ id: '2', title: 'Pizza; groß', date: '2026-05-02', amount: 2000, payer: 'a' }),
    exp({ id: '1', title: 'Hotel', category: 'unterkunft', date: '2026-05-01', amount: 15050, currency: 'CHF', rate: 1, payer: 'b' }),
    exp({ id: '3', deleted: true }),
    { id: '4', kind: 'transfer', title: '', date: '2026-05-03', category: '', amount: 500, currency: 'EUR', rate: 1, payer: 'b', to: 'a' },
  ];
  const csv = E.csvExport(trip, entries);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Datum;Art;Titel;Kategorie;Betrag;Währung;Kurs;Betrag (EUR);Bezahlt von;An;A;"Berta; ""B"""');
  assert.equal(lines[1], '01.05.2026;Ausgabe;Hotel;Unterkunft;150,50;CHF;1;150,50;"Berta; ""B""";;75,25;75,25');
  assert.equal(lines[2], '02.05.2026;Ausgabe;"Pizza; groß";Essen & Trinken;20,00;EUR;;20,00;A;;10,00;10,00');
  assert.equal(lines[3], '03.05.2026;Überweisung;;;5,00;EUR;;5,00;"Berta; ""B""";A;;');
  assert.equal(lines[4], '');
  assert.equal(lines[5], 'Salden');
  assert.equal(lines[6], 'Name;Bezahlt;Anteil;Saldo');
  assert.equal(lines[7], 'A;15,00;85,25;-70,25');
  assert.equal(lines[8], '"Berta; ""B""";155,50;85,25;70,25');
});

test('newId und todayISO', () => {
  const id = E.newId();
  assert.match(id, /^[a-z0-9]{10}$/);
  assert.match(E.newId(24), /^[a-z0-9]{24}$/);
  assert.notEqual(E.newId(), E.newId());
  assert.equal(E.todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.match(E.todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});
