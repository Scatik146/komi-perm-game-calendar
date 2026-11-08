import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  oldParts, oldValue, oldSigns, octalDigits, octalSigns, moneyParts, dateSigns,
  printDigit, printEight, printMonth, monthSign, OLD_MAX, textNumbers,
} from '../engine/index.js';

const pasy = JSON.parse(readFileSync(new URL('../data/pasy.json', import.meta.url)));

test('старый счёт: каждое число 1–512 раскладывается однозначно и обратно', () => {
  const seen = new Set();
  for (let v = 1; v <= OLD_MAX; v++) {
    const p = oldParts(v);
    assert.equal(oldValue(p), v);
    assert.ok(p.month >= 0 && p.month <= 8 && p.week >= 0 && p.week <= 6 && p.day >= 0 && p.day <= 8);
    const key = `${p.month}.${p.week}.${p.day}`;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
});

test('старый счёт: опорные числа', () => {
  assert.deepEqual(oldParts(56), { month: 0, week: 6, day: 8 });
  assert.deepEqual(oldParts(57), { month: 1, week: 0, day: 0 });     // Ур
  assert.deepEqual(oldParts(94), { month: 1, week: 4, day: 5 });     // Ур + Шӧр + 5
  assert.deepEqual(oldParts(512), { month: 8, week: 6, day: 8 });    // Кӧч + Чаль + 8
  assert.equal(oldSigns(94), printMonth(1) + printEight(4) + printDigit(5));
  assert.equal(oldSigns(57, 'parade'), monthSign(1));
  assert.throws(() => oldParts(0));
  assert.throws(() => oldParts(513));
});

test('новый счёт: восьмеричный, с нулём', () => {
  assert.deepEqual(octalDigits(453), [7, 0, 5]);
  assert.deepEqual(octalDigits(0), [0]);
  assert.deepEqual(octalDigits(512), [1, 0, 0, 0]);
  assert.equal(octalSigns(8), printDigit(1) + printDigit(0));
});

test('числа в тексте: знаками как есть или переводом в восьмеричный счёт', () => {
  assert.equal(textNumbers('цена 94', 'keep'), 'цена 94');
  assert.equal(textNumbers('7-0-5, 9', 'signs'), `${printDigit(7)}-${printDigit(0)}-${printDigit(5)}, 9`);
  assert.equal(textNumbers('453 и 8', 'octal'), `${octalSigns(453)} и ${printDigit(1)}${printDigit(0)}`);
});

test('деньги: крупная монета — 512 мелких', () => {
  assert.deepEqual(moneyParts(94), { big: 0, small: 94 });
  assert.deepEqual(moneyParts(512), { big: 1, small: 0 });
  assert.deepEqual(moneyParts(1000), { big: 1, small: 488 });
});

test('печатная дата: месяц, неделя, день', () => {
  assert.equal(dateSigns({ month: 7, week: 6, day: 6 }, 'print'), '');
});

test('в шрифте есть все знаки, коды не повторяются', () => {
  const cps = pasy.signs.map((s) => s.cp);
  assert.equal(new Set(cps).size, cps.length);
  for (const cp of [0xE001, 0xE008, 0xE016, 0xE028, 0xE030, 0xE038, 0xE046, 0xE058]) {
    assert.ok(cps.includes(cp), cp.toString(16));
  }
  for (const s of pasy.signs.filter((x) => x.set === 'print')) {
    for (const p of s.outline) for (const [, y] of p) assert.ok(y >= -88 && y <= 650, `${s.id}: ${y}`);
  }
});

test('в шрифте Pasy есть табличные цифры (tnum)', () => {
  const font = readFileSync(new URL('../web/fonts/Pasy.ttf', import.meta.url));
  assert.ok(font.includes(Buffer.from('GSUB')) && font.includes(Buffer.from('tnum')));
});
