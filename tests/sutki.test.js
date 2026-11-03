import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rubezhiForDay, stateAt, solarNoon, solarParams, solarDayIndex, DAY_MS, ORDER,
} from '../engine/index.js';

const { places } = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url)));
const byId = Object.fromEntries(places.map((p) => [p.id, p]));
const MIN = 60000;

const k2026 = Math.floor(Date.UTC(2026, 0, 1) / DAY_MS);
const days2026 = Array.from({ length: 365 }, (_, i) => k2026 + i);

test('уравнение времени и склонение — в известных пределах', () => {
  // начало ноября: уравнение времени ≈ +16,4 мин; солнцестояние: склонение ≈ +23,44°
  const nov3 = solarParams(Date.UTC(2026, 10, 3, 12));
  assert.ok(nov3.eqTime > 16 && nov3.eqTime < 16.6, `eqTime=${nov3.eqTime}`);
  const jun21 = solarParams(Date.UTC(2026, 5, 21, 12));
  assert.ok(Math.abs(jun21.decl * 180 / Math.PI - 23.44) < 0.05);
});

test('полдень в Кудымкаре 3 ноября 2026 ≈ 13:05 по пермскому времени', () => {
  const p = byId.kudymkar;
  const noon = solarNoon(solarDayIndex(Date.UTC(2026, 10, 3, 8), p.lon), p.lon);
  const perm = new Date(noon + 5 * 3600000); // UTC+5
  const minutes = perm.getUTCHours() * 60 + perm.getUTCMinutes();
  assert.ok(Math.abs(minutes - (13 * 60 + 5)) <= 2, `полдень ${perm.toISOString()}`);
});

test('день в равноденствие в Кудымкаре ≈ 12 ч 12 мин', () => {
  const p = byId.kudymkar;
  const k = solarDayIndex(Date.UTC(2026, 2, 20, 8), p.lon);
  const r = Object.fromEntries(rubezhiForDay(k, p.lat, p.lon).map((x) => [x.id, x.t]));
  const len = (r.I - r.V) / MIN;
  assert.ok(Math.abs(len - 732) < 8, `день ${len} мин`);
});

for (const p of places) {
  test(`${p.name}: порядок рубежей верен весь 2026 год`, () => {
    for (const k of days2026) {
      const list = rubezhiForDay(k, p.lat, p.lon);
      assert.deepEqual(list.map((x) => x.id), ORDER);
      for (let i = 1; i < list.length; i++) assert.ok(list[i].t >= list[i - 1].t, `${p.id} день ${k}`);
      const r = Object.fromEntries(list.map((x) => [x.id, x.t]));
      assert.ok(r.I - r.VIII >= 100 * MIN, `${p.id}: аср слишком близко к закату`);
      assert.ok(r.VIII > r.VII && r.VI < r.VII);
    }
  });
}

function nightStats(p) {
  let merged = 0;
  let shortest = Infinity;
  for (const k of days2026) {
    const list = rubezhiForDay(k, p.lat, p.lon);
    const II = list.find((x) => x.id === 'II');
    const IVnext = rubezhiForDay(k + 1, p.lat, p.lon).find((x) => x.id === 'IV');
    if (II.merged) merged++;
    else shortest = Math.min(shortest, (IVnext.t - II.t) / MIN);
  }
  return { merged, shortest };
}

test('ночь по −6° есть во всех районных центрах круглый год', () => {
  for (const p of places.filter((x) => x.kind === 'district')) {
    assert.equal(nightStats(p).merged, 0, p.name);
  }
});

test('самая короткая ночь: Чердынь ≈ 48 мин, Кудымкар ≈ 2 ч 35 мин', () => {
  const ch = nightStats(byId.cherdyn).shortest;
  const ku = nightStats(byId.kudymkar).shortest;
  assert.ok(ch > 35 && ch < 65, `Чердынь ${ch}`);
  assert.ok(ku > 140 && ku < 170, `Кудымкар ${ku}`);
});

test('Искор: в июне около 11 суток без ночи — рубежи сливаются в полночь', () => {
  const { merged } = nightStats(byId.iskor);
  assert.ok(merged >= 6 && merged <= 16, `слияний ${merged}`);
});

test('состояние: текущий и следующий рубеж, календарные сутки от заката до заката', () => {
  const now = Date.UTC(2026, 10, 3, 18, 0);
  const s = stateAt(now, byId.kudymkar);
  assert.ok(s.current.t <= now && s.next.t > now);
  assert.equal(s.sutki.rubezhi[0].id, 'I');
  assert.equal(s.sutki.rubezhi.length, 8);
  assert.ok(s.sutki.end - s.sutki.start > 23 * 3600000 && s.sutki.end - s.sutki.start < 25 * 3600000);
});

import { moonPhase, moonEvents } from '../engine/index.js';

test('Луна: полнолуние 3 марта 2026 (лунное затмение) и новолуние 17 февраля 2026 (солнечное затмение)', () => {
  const full = moonPhase(Date.UTC(2026, 2, 3, 11, 33));
  assert.ok(full.illumination > 0.99, `полнолуние ${full.illumination}`);
  assert.equal(full.phase, 'полнолуние');
  const nw = moonPhase(Date.UTC(2026, 1, 17, 12, 0));
  assert.ok(nw.illumination < 0.01, `новолуние ${nw.illumination}`);
  assert.equal(nw.phase, 'новолуние');
  const first = moonPhase(Date.UTC(2026, 1, 24, 12, 0));
  assert.ok(first.waxing && first.illumination > 0.4 && first.illumination < 0.7);
});

test('Луна: за сутки один-два восхода/захода и одна кульминация', () => {
  const p = byId.kudymkar;
  const from = Date.UTC(2026, 10, 3, 0);
  const { events, up } = moonEvents(from, from + 86400000, p.lat, p.lon);
  const transits = events.filter((e) => e.type === 'transit').length;
  assert.ok(transits <= 1);
  assert.ok(events.length >= 2 && events.length <= 4, JSON.stringify(events));
  for (const [a, b] of up) assert.ok(b > a);
});
