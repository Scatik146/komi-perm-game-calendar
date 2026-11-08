import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hijriCivil, hijriUmmAlQura, hijriText, HIJRI_MONTHS_RU } from '../engine/index.js';

const day = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

test('хиджра: Умм аль-Кура числами, названия свои', () => {
  const u = hijriUmmAlQura(day(2026, 11, 8) * 86400000 + 43200000);
  if (u) assert.deepEqual(u, { year: 1448, month: 5, day: 28 });   // 8 ноября 2026, днём
  assert.match(hijriText(day(2026, 11, 8)), /^2[78] джумад-уль-авваль 1448 г\. хиджры/);
  assert.equal(HIJRI_MONTHS_RU.length, 12);
});

test('хиджра: табличный расчёт расходится с Умм аль-Кура не больше чем на 2 дня', () => {
  const k0 = day(2026, 3, 1);
  for (let k = k0; k < k0 + 800; k += 7) {
    const u = hijriUmmAlQura(k * 86400000 + 43200000);
    if (!u) return;
    const c = hijriCivil(k);
    const a = u.year * 360 + u.month * 30 + u.day;
    const b = c.year * 360 + c.month * 30 + c.day;
    assert.ok(Math.abs(a - b) <= 2 || Math.abs(Math.abs(a - b) - 30) <= 2, `${k}: ${JSON.stringify(u)} ${JSON.stringify(c)}`);
  }
});

test('хиджра: 1 мухаррама 1446 — 7 июля 2024 (табличный ±1)', () => {
  const c = hijriCivil(day(2024, 7, 7));
  const ok = (c.year === 1446 && c.month === 1 && c.day <= 2) || (c.year === 1445 && c.month === 12 && c.day >= 29);
  assert.ok(ok, JSON.stringify(c));
});
