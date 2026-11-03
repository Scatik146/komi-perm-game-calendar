import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeTransliterator } from '../engine/index.js';

const table = JSON.parse(readFileSync(new URL('../data/anbur.json', import.meta.url)));
const tr = makeTransliterator(table);

test('у каждой кириллической буквы свой знак — запись обратима', () => {
  const seen = new Map();
  for (const l of table.letters) {
    assert.ok(!seen.has(l.anbur), `${l.cyr} и ${seen.get(l.anbur)} совпадают`);
    seen.set(l.anbur, l.cyr);
  }
  const all = 'абвгдеёжзиійклмноӧпрстуфхцчшщъыьэюя';
  for (const ch of all) assert.ok(table.letters.some((l) => l.cyr === ch), `нет буквы ${ch}`);
});

test('о и ӧ различаются: о — вой, ӧ — о', () => {
  assert.equal(tr('о'), '𐍞');
  assert.equal(tr('ӧ'), '𐍩');
  assert.notEqual(tr('пемдӧм'), tr('пемдом'));
});

test('дж и дз — одна буква; в русском — две', () => {
  assert.equal(tr('дж'), '𐍖');
  assert.equal(tr('дз'), '𐍘');
  assert.equal(tr('дж', 'ru'), '𐍓𐍕');
});

test('русское о пишется омегой', () => {
  assert.equal(tr('о', 'ru'), '𐍩');
});

test('слова календаря', () => {
  assert.equal(tr('луншӧр'), '𐍛𐍣𐍝𐍥𐍩𐍠');
  assert.equal(tr('ойшӧр'), '𐍞𐍙̈𐍥𐍩𐍠');
  assert.equal(tr('асъяой'), '𐍐𐍡𐍯𐍴𐍞𐍙̈');
  assert.equal(tr('Шонді'), '𐍥𐍞𐍝𐍓𐍙̇');
});

test('прочие знаки не меняются', () => {
  assert.equal(tr('лун, ой!'), '𐍛𐍣𐍝, 𐍞𐍙̈!');
});
