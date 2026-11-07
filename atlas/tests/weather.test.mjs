import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimes, nowIndex, nearestStep, dayTicks, forecastHtml } from '../public/weather.js';

test('parseTimes: Intervall und Liste, sortiert, ohne Doppelte', () => {
  const iv = parseTimes('2026-11-05T12:00:00.000Z/2026-11-05T15:00:00.000Z/PT1H');
  assert.deepEqual(iv.map((t) => new Date(t).toISOString().slice(11, 16)), ['12:00', '13:00', '14:00', '15:00']);
  const list = parseTimes('2026-11-05T18:00:00.000Z, 2026-11-05T12:00:00.000Z,2026-11-05T12:00:00.000Z,Müll');
  assert.equal(list.length, 2);
  assert.ok(list[0] < list[1]);
  assert.deepEqual(parseTimes('2026-11-05T12:00:00Z/2026-11-05T13:00:00Z/PT30M').length, 3);
  assert.deepEqual(parseTimes(''), []);
  assert.deepEqual(parseTimes('2026-11-05T12:00:00Z/2026-11-06T12:00:00Z/P1D'), [], 'unbekannte Schrittweite wird ignoriert');
});

test('nowIndex: neuestes Radarbild vor der Vorhersage, sonst nächster Zeitpunkt', () => {
  const now = Date.parse('2026-11-06T23:55:00Z');
  const steps = [{ t: now - 20 * 60e3, src: 'Radar' }, { t: now - 10 * 60e3, src: 'Radar' }, { t: now + 5 * 60e3, src: 'ICON-EU' }];
  assert.equal(nowIndex(steps, now), 1);
  assert.equal(nowIndex(steps.slice(2), now), 0);
  assert.equal(nearestStep(steps, now + 60 * 60e3), 2);
});

test('dayTicks: eine Marke je Mitternacht, Position auf der Zeitachse', () => {
  const t0 = new Date(2026, 10, 6, 12).getTime();
  const steps = [{ t: t0 }, { t: t0 + 48 * 3600e3 }];
  const ticks = dayTicks(steps);
  assert.equal(ticks.length, 2);
  assert.equal(ticks[0].pos, 0.25);
  assert.equal(ticks[1].pos, 0.75);
});

test('forecastHtml: Wochen-Zusammenfassung und eine Zeile je Tag, HTML-sicher', () => {
  const days = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(7 + i).padStart(2, '0')}`, code: 61, max: 10, min: 2, rain: i < 7 ? 2 : 0, wind: 20 }));
  const html = forecastHtml(days);
  assert.match(html, /Diese Woche/);
  assert.match(html, /14 mm · 7 Regentage/);
  assert.match(html, /0 mm · 0 Regentage/);
  assert.equal((html.split('<tbody>')[1].match(/<tr>/g) || []).length, 14);
  assert.doesNotMatch(forecastHtml([{ day: '2026-11-07', code: '<b>', max: null }]), /<b>x/);
});
