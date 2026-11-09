/* Reisekasse – Rechen-Engine.
 * Reine Logik ohne DOM: Beträge, Aufteilung, Salden, Ausgleich, Kassenbon-Erkennung, IBAN/GiroCode, CSV.
 * Läuft im Browser (ES-Modul) und in Node. Alle Beträge sind ganze Zahlen in der kleinsten Einheit.
 */

/* ---------- Konstanten ---------- */

export const CATEGORIES = [
  { id: 'essen', label: 'Essen & Trinken' },
  { id: 'einkauf', label: 'Einkauf' },
  { id: 'unterkunft', label: 'Unterkunft' },
  { id: 'transport', label: 'Transport' },
  { id: 'tanken', label: 'Tanken & Maut' },
  { id: 'aktivitaet', label: 'Aktivitäten' },
  { id: 'sonstiges', label: 'Sonstiges' },
];

const KIND_LABEL = { expense: 'Ausgabe', income: 'Einnahme', transfer: 'Überweisung' };
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/* ---------- Beträge ---------- */

const digitsCache = {};
export function minorDigits(currency) {
  const c = String(currency || '').toUpperCase();
  if (c in digitsCache) return digitsCache[c];
  let d = 2;
  try {
    d = new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits;
    if (!Number.isInteger(d)) d = 2;
  } catch (e) { d = 2; }
  digitsCache[c] = d;
  return d;
}

const pow10 = (d) => Math.pow(10, d);

/** Rundet auf ganze Zahlen, .5 weg von null (mit Toleranz gegen Gleitkomma-Rauschen). */
function roundHalfAway(x) {
  if (!Number.isFinite(x)) return NaN;
  const a = Math.abs(Number(Math.abs(x).toPrecision(13)));
  const r = Math.floor(a + 0.5);
  return x < 0 ? -r : r;
}

/** Text → Betrag in kleinster Einheit; null bei Unsinn. */
export function toMinor(input, currency = 'EUR') {
  const d = minorDigits(currency);
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    const v = roundHalfAway(input * pow10(d));
    return Math.abs(v) <= MAX_SAFE ? v : null;
  }
  if (typeof input !== 'string') return null;
  let s = input.replace(/[\s  ]/g, '').replace(/[−–—]/g, '-');
  s = s.replace(/[€$£]/g, '').replace(/^([+-]?)[A-Za-z]{3}(?=[\d.,])/, '$1').replace(/([\d.,])[A-Za-z]{3}$/, '$1');
  s = s.replace(/'/g, '');
  const m = /^([+-]?)([0-9.,]*)$/.exec(s);
  if (!m || !/\d/.test(m[2])) return null;
  const neg = m[1] === '-';
  const body = m[2];
  const seps = body.match(/[.,]/g) || [];
  let intPart = body;
  let frac = '';
  if (seps.length) {
    const last = Math.max(body.lastIndexOf('.'), body.lastIndexOf(','));
    const lastCh = body[last];
    const before = body.slice(0, last);
    const after = body.slice(last + 1);
    const mixed = new Set(seps).size > 1;
    let decimal;
    if (mixed) decimal = true; // "1.234,56" / "1,234.56"
    else if (seps.length > 1) decimal = false; // "1.234.567"
    else decimal = !(after.length === 3 && d !== 3 && before !== '' && before !== '0');
    if (decimal) {
      const thousandCh = lastCh === ',' ? '.' : ',';
      if (before.includes(lastCh)) return null;
      if (!groupsOk(before, thousandCh)) return null;
      intPart = before.split(thousandCh).join('');
      frac = after;
    } else {
      if (!groupsOk(body, lastCh)) return null;
      intPart = body.split(lastCh).join('');
    }
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac)) return null;
  let whole = Number(intPart || '0');
  let f = frac;
  let carry = 0;
  if (f.length > d) {
    carry = f.charCodeAt(d) >= 53 ? 1 : 0; // ab '5' aufrunden
    f = f.slice(0, d);
  }
  f = f.padEnd(d, '0');
  const v = whole * pow10(d) + (f ? Number(f) : 0) + carry;
  if (!Number.isSafeInteger(v)) return null;
  return neg ? -v : v;
}

/** "1.234.567": erste Gruppe 1–3 Ziffern, Rest genau 3. */
function groupsOk(s, sep) {
  const g = s.split(sep);
  if (g.length < 2) return true;
  if (!/^\d{1,3}$/.test(g[0])) return false;
  return g.slice(1).every((x) => /^\d{3}$/.test(x));
}

export function fromMinor(minor, currency = 'EUR') {
  return minor / pow10(minorDigits(currency));
}

export function formatMoney(minor, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(fromMinor(minor, currency));
  } catch (e) {
    return formatAmount(minor, currency) + ' ' + currency;
  }
}

export function formatAmount(minor, currency = 'EUR') {
  const d = minorDigits(currency);
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(fromMinor(minor, currency));
}

/** Betrag als schlichter Text mit Komma, ohne Tausenderpunkt (CSV). */
function plainDecimal(minor, currency) {
  const d = minorDigits(currency);
  const neg = minor < 0;
  const a = String(Math.abs(minor)).padStart(d + 1, '0');
  const s = d ? a.slice(0, -d) + ',' + a.slice(-d) : a;
  return (neg ? '-' : '') + s;
}

/* ---------- Verteilen und Umrechnen ---------- */

/** Größte-Reste-Verfahren: ganzzahlige Anteile, Summe exakt = total. */
export function allocate(total, weights) {
  if (!Array.isArray(weights) || !weights.length) throw new Error('Keine Gewichte angegeben.');
  if (!Number.isInteger(total)) throw new Error('Der Betrag muss eine ganze Zahl sein.');
  const W = weights.map((w) => {
    if (!Number.isFinite(w) || w < 0) throw new Error('Ungültiges Gewicht.');
    return BigInt(Math.round(w * 1e6));
  });
  if (total === 0) return W.map(() => 0);
  const S = W.reduce((a, b) => a + b, 0n);
  if (S === 0n) throw new Error('Die Gewichte ergeben null.');
  const t = BigInt(Math.abs(total));
  const q = [];
  const r = [];
  let used = 0n;
  W.forEach((w) => {
    const n = t * w;
    q.push(n / S);
    r.push(n % S);
    used += n / S;
  });
  let left = Number(t - used);
  const order = r.map((x, i) => i).sort((a, b) => (r[a] === r[b] ? a - b : r[a] > r[b] ? -1 : 1));
  for (let k = 0; k < left; k++) q[order[k]] += 1n;
  const sign = total < 0 ? -1 : 1;
  return q.map((x) => (x === 0n ? 0 : sign * Number(x)));
}

/** Umrechnen zwischen Währungen (1 fromCurrency = rate toCurrency), .5 weg von null. */
export function convert(minor, fromCurrency, rate, toCurrency) {
  if (fromCurrency === toCurrency) return minor;
  const v = minor * rate * pow10(minorDigits(toCurrency) - minorDigits(fromCurrency));
  const r = roundHalfAway(v);
  return r === 0 ? 0 : r;
}

/* ---------- Aufteilung eines Eintrags ---------- */

const uniq = (a) => Array.from(new Set(a));
const isoValid = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dt.getUTCFullYear() === +m[1] && dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3];
};

export function entryShares(entry, trip) {
  const errors = [];
  const cur = entry.currency || trip.currency;
  const members = new Map((trip.members || []).map((m) => [m.id, m]));
  const amount = entry.amount;
  const foreign = cur !== trip.currency;
  if (!Number.isInteger(amount) || amount <= 0) errors.push('Der Betrag muss größer als 0 sein.');
  if (foreign && !(typeof entry.rate === 'number' && Number.isFinite(entry.rate) && entry.rate > 0)) {
    errors.push('Bitte einen gültigen Wechselkurs angeben.');
  }
  const split = entry.split || {};
  let base = null;

  if (errors.length === 0) {
    if (entry.kind === 'transfer') {
      if (!members.has(entry.to)) errors.push('Der Empfänger der Überweisung ist kein Mitglied.');
      else base = { [entry.to]: amount };
    } else {
      const among = uniq(split.among || []);
      const wOf = (id) => {
        const w = split.weights && split.weights[id] != null ? split.weights[id] : members.get(id) && members.get(id).weight != null ? members.get(id).weight : 1;
        return w;
      };
      const unknown = (ids) => ids.some((id) => !members.has(id));
      const weightsOk = (ids) => ids.every((id) => Number.isFinite(wOf(id)) && wOf(id) >= 0);
      const addAmong = (acc, total) => {
        const parts = allocate(total, among.map(wOf));
        among.forEach((id, i) => { acc[id] = (acc[id] || 0) + parts[i]; });
      };
      try {
        if (split.mode === 'exact') {
          const ex = split.exact || {};
          const ids = Object.keys(ex);
          if (!ids.length) errors.push('Bitte Einzelbeträge angeben.');
          else if (unknown(ids)) errors.push('Unbekannte Person in den Einzelbeträgen.');
          else if (!ids.every((id) => Number.isInteger(ex[id]))) errors.push('Ungültiger Einzelbetrag.');
          else {
            const sum = ids.reduce((a, id) => a + ex[id], 0);
            if (sum !== amount) errors.push(`Die Einzelbeträge ergeben ${formatMoney(sum, cur)} statt ${formatMoney(amount, cur)}.`);
            else base = Object.assign({}, ex);
          }
        } else if (split.mode === 'items') {
          const items = split.items || [];
          const acc = {};
          let assigned = 0;
          let bad = false;
          items.forEach((it) => {
            if (!Number.isInteger(it.amount)) { errors.push('Ungültiger Betrag bei einem Posten.'); bad = true; return; }
            const who = uniq(it.who || []);
            if (!who.length) return;
            if (unknown(who)) { errors.push('Unbekannte Person bei einem Posten.'); bad = true; return; }
            const parts = allocate(it.amount, who.map(() => 1));
            who.forEach((id, i) => { acc[id] = (acc[id] || 0) + parts[i]; });
            assigned += it.amount;
          });
          if (unknown(among)) { errors.push('Unbekannte Person in der Aufteilung.'); bad = true; }
          if (!bad) {
            const rest = amount - assigned;
            if (rest !== 0) {
              if (!among.length) errors.push(`Der Rest von ${formatMoney(rest, cur)} ist keiner Person zugeordnet.`);
              else if (!weightsOk(among)) errors.push('Ungültiges Gewicht.');
              else addAmong(acc, rest);
            }
            if (!errors.length) base = acc;
          }
        } else {
          if (!among.length) errors.push('Bitte mindestens eine Person für die Aufteilung auswählen.');
          else if (unknown(among)) errors.push('Unbekannte Person in der Aufteilung.');
          else if (!weightsOk(among)) errors.push('Ungültiges Gewicht.');
          else { base = {}; addAmong(base, amount); }
        }
      } catch (e) {
        errors.push(e.message === 'Die Gewichte ergeben null.' ? 'Die Gewichte ergeben null.' : 'Aufteilung nicht möglich.');
        base = null;
      }
    }
  }
  if (errors.length || !base) return { ok: false, errors: errors.length ? errors : ['Aufteilung nicht möglich.'] };

  const index = new Map((trip.members || []).map((m, i) => [m.id, i]));
  const ids = Object.keys(base).sort((a, b) => index.get(a) - index.get(b));
  let total = amount;
  let out = {};
  if (!foreign) {
    ids.forEach((id) => { out[id] = base[id]; });
  } else {
    total = convert(amount, cur, entry.rate, trip.currency);
    let sum = 0;
    ids.forEach((id) => { out[id] = convert(base[id], cur, entry.rate, trip.currency); sum += out[id]; });
    let diff = total - sum;
    if (diff && ids.length) {
      const order = ids.map((id, i) => [id, i]).sort((a, b) => Math.abs(base[b[0]]) - Math.abs(base[a[0]]) || a[1] - b[1]).map((x) => x[0]);
      const step = diff > 0 ? 1 : -1;
      for (let k = 0; diff !== 0; k++) { out[order[k % order.length]] += step; diff -= step; }
    }
  }
  const shares = {};
  ids.forEach((id) => { if (out[id] !== 0) shares[id] = out[id]; });
  return { ok: true, total, shares };
}

export function validateEntry(entry, trip) {
  const errors = [];
  const add = (s) => { if (!errors.includes(s)) errors.push(s); };
  const isMember = (id) => (trip.members || []).some((m) => m.id === id);
  if (!KIND_LABEL[entry.kind]) add('Unbekannte Art des Eintrags.');
  if (entry.kind !== 'transfer' && !String(entry.title || '').trim()) add('Bitte einen Titel eingeben.');
  if (!isoValid(entry.date)) add('Bitte ein gültiges Datum angeben.');
  if (!isMember(entry.payer)) {
    add(entry.kind === 'income' ? 'Bitte angeben, wer das Geld erhalten hat.' : entry.kind === 'transfer' ? 'Bitte angeben, wer überwiesen hat.' : 'Bitte angeben, wer bezahlt hat.');
  }
  if (entry.kind === 'transfer') {
    if (entry.to && entry.to === entry.payer) add('Absender und Empfänger müssen verschieden sein.');
  }
  const r = entryShares(entry, trip);
  if (!r.ok) r.errors.forEach(add);
  return errors;
}

/* ---------- Salden und Ausgleich ---------- */

const live = (entries) => (entries || []).filter((e) => e && !e.deleted);

export function balances(trip, entries) {
  const res = {};
  (trip.members || []).forEach((m) => { res[m.id] = { paid: 0, share: 0, sent: 0, received: 0, balance: 0 }; });
  live(entries).forEach((e) => {
    if (validateEntry(e, trip).length) return;
    const r = entryShares(e, trip);
    if (e.kind === 'transfer') {
      res[e.payer].sent += r.total;
      res[e.to].received += r.total;
    } else if (e.kind === 'income') {
      res[e.payer].paid -= r.total;
      Object.keys(r.shares).forEach((id) => { res[id].share -= r.shares[id]; });
    } else {
      res[e.payer].paid += r.total;
      Object.keys(r.shares).forEach((id) => { res[id].share += r.shares[id]; });
    }
  });
  Object.keys(res).forEach((id) => {
    const b = res[id];
    b.balance = b.paid - b.share + b.sent - b.received;
  });
  return res;
}

/** Wenige Überweisungen: erst exakt passende Paare, dann größter Schuldner → größter Gläubiger. */
export function settle(balancesObj, memberOrder) {
  const keys = Object.keys(balancesObj);
  const val = (id) => (typeof balancesObj[id] === 'number' ? balancesObj[id] : balancesObj[id].balance);
  const pos = (id) => {
    const i = memberOrder ? memberOrder.indexOf(id) : -1;
    return i >= 0 ? i : (memberOrder ? memberOrder.length : 0) + keys.indexOf(id);
  };
  const byPos = (a, b) => pos(a.id) - pos(b.id);
  const debtors = keys.filter((id) => val(id) < 0).map((id) => ({ id, amt: -val(id) })).sort(byPos);
  const creditors = keys.filter((id) => val(id) > 0).map((id) => ({ id, amt: val(id) })).sort(byPos);
  const out = [];
  debtors.forEach((d) => {
    const c = creditors.find((x) => x.amt > 0 && x.amt === d.amt);
    if (c) { out.push({ from: d.id, to: c.id, amount: d.amt }); d.amt = 0; c.amt = 0; }
  });
  const biggest = (list) => list.filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt || pos(a.id) - pos(b.id))[0];
  for (;;) {
    const d = biggest(debtors);
    const c = biggest(creditors);
    if (!d || !c) break;
    const pay = Math.min(d.amt, c.amt);
    out.push({ from: d.id, to: c.id, amount: pay });
    d.amt -= pay;
    c.amt -= pay;
  }
  return out;
}

export function categoryTotals(trip, entries) {
  const sums = new Map();
  live(entries).forEach((e) => {
    if (e.kind !== 'expense' && e.kind !== 'income') return;
    if (validateEntry(e, trip).length) return;
    const t = entryShares(e, trip).total;
    const cat = e.category || 'sonstiges';
    sums.set(cat, (sums.get(cat) || 0) + (e.kind === 'income' ? -t : t));
  });
  const rank = (id) => { const i = CATEGORIES.findIndex((c) => c.id === id); return i < 0 ? 99 : i; };
  return Array.from(sums, ([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || rank(a.category) - rank(b.category) || (a.category < b.category ? -1 : 1));
}

/* ---------- Kassenbon-Erkennung (OCR-Text) ---------- */

const L = 'A-Za-zÀ-ÿ';
const NUM = '-?(?:\\d{1,3}(?:\\.\\d{3})+,\\d{2}|\\d{1,3}(?:,\\d{3})+\\.\\d{2}|\\d{1,6}[.,]\\d{2})';
const NUM_G = new RegExp(NUM + '(?!\\d)', 'g');
const PRICE_END = new RegExp('^(.*?)(?:^|[\\s:])(' + NUM + ')(-)?(?:\\s*(?:EUR|€|\\*|[ABC12])){0,3}\\s*$', 'i');
const PRICE_ONLY = new RegExp('^\\s*(?:€|EUR)?\\s*(' + NUM + ')\\s*(?:€|EUR)?\\s*$', 'i');
const word = (alts) => new RegExp('(^|[^' + L + '])(' + alts + ')([^' + L + ']|$)', 'i');
const PAY_RE = word('BAR|BARGELD|GEGEBEN|R[ÜU]E?CKGELD|KARTE|KARTENZAHLUNG|EC|EC-?KARTE|EC-?CASH|VISA|MASTERCARD|MAESTRO|GIROCARD|KREDITKARTE|CAMBIO|CHANGE|EFECTIVO|CONTANTI|RESTO|TARJETA|CARTA|CARTE|ESP[ÈE]CES|RENDU|CASH|ZAHLUNG|ENTREGADO|TENDERED|GIVEN');
const TAX_RE = word('MW\\.?\\s?ST|UST|STEUER|STEUERN|NETTO|BRUTTO|IVA|TVA|VAT|TAX|IMPOSTA|IMPUESTO|MEHRWERTSTEUER|UMSATZSTEUER');
const TOTALS_RE = /SUMME|GESAMT|TOTAL|ZU\s*ZAHLEN|ZAHLBETRAG|BETRAG|IMPORTE|A\s*PAGAR|ZWISCHEN|SUBTOTAL|TEILSUMME|TTC|AMOUNT\s*DUE|BALANCE/i;
const TOTAL_L3 = /ZU\s*ZAHLEN|ZAHLBETRAG|ENDBETRAG|ENDSUMME|GESAMTBETRAG|GESAMTSUMME|TOTAL\s*TTC|N[EÉ]T\s*[AÀ]\s*PAYER|TOTAL\s*[AÀ]\s*PAYER|A\s*PAGAR|IMPORTE\s*TOTAL|TOTALE\s*COMPLESSIVO|GRAND\s*TOTAL|AMOUNT\s*DUE|TOTAL\s*DUE|BALANCE\s*DUE/i;
const TOTAL_L2 = /SUMME|GESAMT|TOTAL/i;
const TOTAL_L1 = /BETRAG|IMPORTE/i;
const SUBTOTAL_RE = /ZWISCHEN|TEILSUMME|SUB\s*-?\s*TOTAL|SOUS\s*-?\s*TOTAL|NETTO|\bHT\b|SIN\s*IVA|IMPONIBILE/i;
const DATE_LINE = /(?:^|\D)\d{1,2}[./-]\d{1,2}[./-](?:\d{2}|\d{4})(?!\d)|\bUhr\b|\b\d{1,2}:\d{2}\b/i;

const cents = (s) => toMinor(s, 'EUR');

function cleanName(raw) {
  let n = raw;
  n = n.replace(/\b\d+\s*[x×X]\s*\d+[.,]\d{2}\b/g, ' ');
  n = n.replace(/^\s*\d+\s*[x×X]\s+/, ' ').replace(/^\s*\d+[x×X]\s*/, ' ');
  n = n.replace(/\s*\d*\s*[x×X]\s*$/, ' ');
  n = n.replace(/\b\d{5,}\b/g, ' ');
  n = n.replace(new RegExp("[^" + L + "0-9 .,&'+\\-/()%:]", 'g'), ' ');
  n = n.replace(/\s+/g, ' ').replace(/^[\s.,:;\-/]+|[\s.,:;\-/]+$/g, '');
  return n;
}

const letterCount = (s) => (s.match(new RegExp('[' + L + ']', 'g')) || []).length;

function findDate(text) {
  const pats = [
    { re: /(?:^|\D)((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g, f: (m) => [+m[1], +m[2], +m[3]] },
    { re: /(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})(?!\d)/g, f: (m) => [+m[3], +m[2], +m[1]] },
    { re: /(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-](\d{2})(?!\d)/g, f: (m) => [2000 + +m[3], +m[2], +m[1]] },
  ];
  for (const p of pats) {
    let m;
    p.re.lastIndex = 0;
    while ((m = p.re.exec(text))) {
      const [y, mo, d] = p.f(m);
      const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isoValid(iso)) return iso;
      p.re.lastIndex = m.index + 1;
    }
  }
  return null;
}

function findCurrency(s) {
  if (/€|\bEUR(?:O)?\b/i.test(s)) return 'EUR';
  if (/\bCHF\b/i.test(s)) return 'CHF';
  if (/£|\bGBP\b/i.test(s)) return 'GBP';
  if (/\$|\bUSD\b/i.test(s)) return 'USD';
  if (/Kč|\bCZK\b/i.test(s)) return 'CZK';
  if (/zł|\bPLN\b/i.test(s)) return 'PLN';
  if (/\d\s*Ft\b|\bHUF\b/.test(s)) return 'HUF';
  return null;
}

const SKIP_MERCHANT = /^(kassenbon|rechnung|beleg|quittung|receipt|invoice|ticket|factura|fattura|scontrino|ricevuta|facture|bon|kundenbeleg|tel|fax|www|http|datum|date|fecha|data)/i;

export function parseReceipt(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/[\t ]+/g, ' ').trim()).filter(Boolean);
  const res = { merchant: null, date: null, total: null, currency: null, items: [] };

  /* Summe */
  let best = null;
  lines.forEach((line, i) => {
    let level = 0;
    if (TOTAL_L3.test(line)) level = 3;
    else if (SUBTOTAL_RE.test(line) || PAY_RE.test(line) || TAX_RE.test(line)) level = 0;
    else if (TOTAL_L2.test(line)) level = 2;
    else if (TOTAL_L1.test(line)) level = 1;
    if (level === 3 && SUBTOTAL_RE.test(line) && !/N[EÉ]T\s*[AÀ]\s*PAYER/i.test(line)) level = 0;
    if (!level) return;
    const nums = line.match(NUM_G);
    let val = nums && nums.length ? cents(nums[nums.length - 1]) : null;
    if (val === null && lines[i + 1]) {
      const m = PRICE_ONLY.exec(lines[i + 1]);
      if (m) val = cents(m[1]);
    }
    if (val === null || val <= 0) return;
    if (!best || level >= best.level) best = { level, idx: i, val };
  });

  /* Posten */
  const stop = best ? best.idx : lines.length;
  const items = [];
  lines.forEach((line, i) => {
    if (i >= stop) return;
    const m = PRICE_END.exec(line);
    if (!m) return;
    if (TOTALS_RE.test(line) || TAX_RE.test(line) || PAY_RE.test(line) || DATE_LINE.test(line)) return;
    let amount = cents(m[2]);
    if (amount === null) return;
    if (m[3]) amount = -Math.abs(amount);
    const name = cleanName(m[1]);
    const stripped = name.replace(/\b(kg|g|stk|st|pcs|un|eur|x)\b/gi, '');
    if (letterCount(stripped) < 2) return;
    items.push({ name, amount });
  });
  res.items = items;

  if (best) res.total = best.val;
  else {
    const amounts = items.map((x) => x.amount).filter((x) => x > 0);
    if (amounts.length) res.total = Math.max(...amounts);
  }

  /* Währung: Summenzeile zuerst, sonst der ganze Text */
  res.currency = (best && findCurrency(lines[best.idx])) || findCurrency(lines.join('\n'));
  res.date = findDate(lines.join('\n'));

  /* Händler */
  for (const line of lines.slice(0, 8)) {
    if (SKIP_MERCHANT.test(line) || /^\d/.test(line) || PRICE_END.test(line) || DATE_LINE.test(line) || /\b\d{5}\b/.test(line)) continue;
    const n = cleanName(line);
    if (letterCount(n) >= 3) { res.merchant = n; break; }
  }
  return res;
}

/* ---------- IBAN, GiroCode, PayPal ---------- */

export function normIban(s) {
  return String(s || '').replace(/\s+/g, '').toUpperCase();
}

export function validIban(s) {
  const n = normIban(s);
  if (n.length < 15 || n.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(n)) return false;
  const r = n.slice(4) + n.slice(0, 4);
  let rem = 0;
  for (const ch of r) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const dgt of v) rem = (rem * 10 + Number(dgt)) % 97;
  }
  return rem === 1;
}

export function formatIban(s) {
  return (normIban(s).match(/.{1,4}/g) || []).join(' ');
}

/** Inhalt des GiroCode-QR (EPC069-12, Version 002, UTF-8). */
export function epcPayload({ name, iban, bic, amount, text } = {}) {
  if (!validIban(iban)) throw new Error('Ungültige IBAN.');
  const cents = Math.round(Number(amount) || 0);
  if (cents > 99999999999) throw new Error('Der Betrag ist zu groß für einen GiroCode.');
  const one = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
  const amt = cents > 0 ? 'EUR' + Math.floor(cents / 100) + '.' + String(cents % 100).padStart(2, '0') : '';
  const lines = ['BCD', '002', '1', 'SCT', one(bic).replace(/\s+/g, '').toUpperCase(), one(name).slice(0, 70), normIban(iban), amt, '', '', one(text).slice(0, 140)];
  while (lines.length > 7 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

export function paypalLink(user, amountMinor, currency = 'EUR') {
  let s = String(user || '').trim()
    .replace(/^https?:\/\//i, '').replace(/^www\./i, '')
    .replace(/^paypal\.me\//i, '').replace(/^paypal\.com\/paypalme\//i, '')
    .replace(/^@/, '');
  const name = s.split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9]+$/.test(name)) return null;
  const base = 'https://paypal.me/' + name;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return base;
  const d = minorDigits(currency);
  return base + '/' + (amountMinor / pow10(d)).toFixed(d) + String(currency || 'EUR').toUpperCase();
}

/* ---------- CSV ---------- */

const csvField = (v) => {
  const s = String(v == null ? '' : v);
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const deDate = (iso) => (isoValid(iso) ? iso.slice(8) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : String(iso || ''));

export function csvExport(trip, entries) {
  const members = trip.members || [];
  const nameOf = (id) => (members.find((m) => m.id === id) || {}).name || '';
  const cur = trip.currency;
  const rows = [];
  rows.push(['Datum', 'Art', 'Titel', 'Kategorie', 'Betrag', 'Währung', 'Kurs', `Betrag (${cur})`, 'Bezahlt von', 'An'].concat(members.map((m) => m.name)));
  const list = live(entries).map((e, i) => [e, i]).sort((a, b) => (a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : a[1] - b[1])).map((x) => x[0]);
  list.forEach((e) => {
    const ec = e.currency || cur;
    const r = entryShares(e, trip);
    const catLabel = (CATEGORIES.find((c) => c.id === e.category) || {}).label || e.category || '';
    let title = String(e.title || '');
    if (/^[=+@]/.test(title)) title = "'" + title;
    const sign = e.kind === 'income' ? -1 : 1;
    rows.push([
      deDate(e.date),
      KIND_LABEL[e.kind] || '',
      title,
      e.kind === 'transfer' ? '' : catLabel,
      Number.isInteger(e.amount) ? plainDecimal(e.amount, ec) : '',
      ec,
      ec !== cur && typeof e.rate === 'number' ? String(e.rate).replace('.', ',') : '',
      r.ok ? plainDecimal(r.total, cur) : '',
      nameOf(e.payer),
      e.kind === 'transfer' ? nameOf(e.to) : '',
    ].concat(members.map((m) => (r.ok && e.kind !== 'transfer' && r.shares[m.id] != null ? plainDecimal(sign * r.shares[m.id], cur) : ''))));
  });
  rows.push([]);
  rows.push(['Salden']);
  rows.push(['Name', 'Bezahlt', 'Anteil', 'Saldo']);
  const bal = balances(trip, entries);
  members.forEach((m) => {
    const b = bal[m.id];
    rows.push([m.name, plainDecimal(b.paid + b.sent - b.received, cur), plainDecimal(b.share, cur), plainDecimal(b.balance, cur)]);
  });
  return '﻿' + rows.map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n';
}

/* ---------- Kleinkram ---------- */

export function newId(len = 10) {
  const A = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  let out = '';
  while (out.length < len) {
    if (c && c.getRandomValues) {
      const buf = c.getRandomValues(new Uint8Array(len * 2));
      for (let i = 0; i < buf.length && out.length < len; i++) if (buf[i] < 252) out += A[buf[i] % 36];
    } else out += A[Math.floor(Math.random() * 36)];
  }
  return out;
}

export function todayISO(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
}
