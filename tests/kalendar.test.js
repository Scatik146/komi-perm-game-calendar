import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  calendarAt, dateOfDay, yearStart, isLongYear, monthLengths, yearPositions,
  numberSign, eightSign, monthSign, dateSigns, dateDigits, digitsToSigns, DAY_MS,
} from '../engine/index.js';

const { places } = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url)));
const kudymkar = places.find((p) => p.id === 'kudymkar');
const at = (iso) => calendarAt(Date.parse(iso), kudymkar);
const pos = (d) => [d.era, d.circle, d.octave, d.year].join('-');

test('примеры дат из sistema.md, раздел 7', () => {
  let d = at('2026-11-04T09:00:00Z');                    // 4 ноября 2026, днём
  assert.equal(d.yearNumber, 1190);
  assert.equal(pos(d), '3-3-5-6');
  assert.deepEqual([d.month, d.week, d.day], [7, 6, 6]);  // Сир · Чаль · квать

  d = at('2026-11-05T09:00:00Z');                        // 5 ноября — Кӧч Кабыр ӧтік
  assert.deepEqual([d.month, d.week, d.day], [8, 1, 1]);

  d = at('2026-12-21T09:00:00Z');                        // Новый год 1191
  assert.equal(d.yearNumber, 1191);
  assert.equal(pos(d), '3-3-5-7');
  assert.deepEqual([d.month, d.week, d.day], [1, 1, 1]);

  d = at('1861-03-03T09:00:00Z');                        // 19.02.1861 по юлианскому
  assert.equal(pos(d), '3-1-1-1');
  assert.deepEqual([d.month, d.week, d.day], [2, 4, 5]); // Ош · Шӧр · вит

  d = at('0837-04-15T09:00:00Z');                        // комета Галлея, 11.04.837 по юлианскому
  assert.equal(pos(d), '1-1-1-1');
  assert.deepEqual([d.month, d.week, d.day], [3, 4, 3]); // Дозмӧр · Шӧр · куим

  assert.equal(pos(yearPositions(536)), '2-1-3-8');       // азбука Стефана, 1372
  assert.equal(pos(yearPositions(626)), '2-2-7-2');       // крещение Перми Великой, 1462
  assert.equal(pos(yearPositions(1024)), '2-8-8-8');      // грамматика Рогова, 1860
});

test('сутки начинаются на закате: вечером 4 ноября уже Кӧч ӧтік', () => {
  const evening = at('2026-11-04T16:00:00Z');            // 21:00 по Кудымкару, после заката
  assert.deepEqual([evening.month, evening.week, evening.day], [8, 1, 1]);
  assert.ok(evening.sutkiStart < Date.parse('2026-11-04T16:00:00Z'));
  assert.ok(evening.sutkiEnd > Date.parse('2026-11-04T16:00:00Z'));
});

test('длинные годы — по руке: делится на 4 и не делится на 128', () => {
  assert.equal(isLongYear(1188), true);
  assert.equal(isLongYear(1190), false);
  assert.equal(isLongYear(1152), false);
  assert.equal(isLongYear(1280), false);
  for (let n = 1025; n <= 1536; n++) {
    const len = yearStart(n + 1) - yearStart(n);
    assert.equal(len, isLongYear(n) ? 366 : 365, `год ${n}`);
    assert.equal(monthLengths(n).reduce((a, b) => a + b), len, `месяцы года ${n}`);
  }
});

test('каждый день эры Слова получает правильную дату подряд', () => {
  let prev = null;
  for (let k = yearStart(1025); k < yearStart(1537); k++) {
    const d = dateOfDay(k);
    assert.ok(d.month >= 1 && d.month <= 8 && d.week >= 1 && d.week <= 6 && d.day >= 1 && d.day <= 8);
    assert.equal(d.dayOfMonth, (d.week - 1) * 8 + d.day);
    if (prev && prev.yearNumber === d.yearNumber && prev.month === d.month) assert.equal(d.dayOfMonth, prev.dayOfMonth + 1);
    else assert.equal(d.dayOfMonth, 1);
    prev = d;
  }
  assert.equal(new Date(yearStart(1190) * DAY_MS).toISOString().slice(0, 10), '2025-12-21');
});

test('знаки: коды шрифта Pasy и запись даты', () => {
  assert.equal(numberSign(1), '');
  assert.equal(eightSign(6), '');
  assert.equal(monthSign(7), '');
  assert.equal(dateSigns({ month: 7, week: 6, day: 6 }), '');
  assert.equal(dateDigits({ month: 7, week: 6, day: 6 }), '');
  assert.equal(digitsToSigns('3-3-5-6, 90'), '---, 90');
});

test('пасы: в числе n — n борозд, в каждом месяце — восемь резов, коды не повторяются', () => {
  const data = JSON.parse(readFileSync(new URL('../data/pasy.json', import.meta.url)));
  const cps = new Set();
  for (const s of data.signs) {
    assert.ok(!cps.has(s.cp), `код ${s.cp.toString(16)} повторяется`);
    cps.add(s.cp);
    if (s.kind === 'number') {          // черта поперёк ряда — 2, короткая вертикальная — 1
      const sum = s.lines.reduce((a, l) => a + (l.p[0][1] === l.p[1][1] ? 2 : 1), 0);
      assert.equal(sum, s.value);
      assert.equal(s.pits.length, 0);
    }
    if (s.kind === 'month') {
      let cuts = 0;
      for (const p of s.lattice) {
        const dirs = p.slice(1).map((q, i) => `${Math.sign(q[0] - p[i][0])},${Math.sign(q[1] - p[i][1])}`);
        cuts += 1 + dirs.slice(1).filter((x, i) => x !== dirs[i]).length;
      }
      assert.equal(cuts, 8, `месяц ${s.kp}`);
    }
  }
  assert.equal(data.signs.filter((s) => s.kind === 'number').length, 8);
  assert.equal(data.signs.filter((s) => s.kind === 'eight').length, 6);
  assert.equal(data.signs.filter((s) => s.kind === 'month').length, 8);
  assert.ok(existsSync(new URL('../web/fonts/Pasy.ttf', import.meta.url)));
});
