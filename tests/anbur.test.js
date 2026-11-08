import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeTransliterator, makeReader, letterMap, LANGS } from '../engine/index.js';

const table = JSON.parse(readFileSync(new URL('../data/anbur.json', import.meta.url)));
const tr = makeTransliterator(table);
const rd = makeReader(table);

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

test('в каждом языке у каждой буквы свой знак — надпись читается обратно', () => {
  for (const lang of LANGS) {
    const seen = new Map();
    for (const [cyr, sign] of letterMap(table, lang)) {
      assert.ok(!seen.has(sign), `${lang}: ${cyr} и ${seen.get(sign)} пишутся одним знаком`);
      seen.set(sign, cyr);
    }
    const letters = [...letterMap(table, lang).keys()];
    const text = letters.join(' ');
    assert.equal(rd(tr(text, lang), lang), text, `${lang}: буквы не читаются обратно`);
  }
});

test('обратное чтение слов', () => {
  for (const [text, lang] of [
    ['луншӧр', 'kp'], ['асъяой', 'kp'], ['шонді', 'kp'], ['пемдӧм', 'kp'],
    ['дождь у моста', 'ru'], ['джаз', 'ru'],
  ]) assert.equal(rd(tr(text, lang), lang), text, `${text} (${lang})`);
});

test('долгота — удвоением, и при вводе, и в анбуре', () => {
  assert.equal(tr('аа', 'bg'), '𐍐𐍐');
  assert.equal(rd('𐍐𐍐', 'bg'), 'аа');
  assert.equal(rd(tr('ӳӳ тт', 'ug'), 'ug'), 'ӳӳ тт');
});

test('новые буквы — только точками', () => {
  assert.equal(tr('ӑ', 'bg'), '𐍐̇');
  assert.equal(tr('ӗ', 'bg'), '𐍔̇');
  assert.equal(tr('ӳ', 'bg'), '𐍣̈');
  assert.equal(tr('ӳ', 'ug'), '𐍣̈');
  assert.equal(tr('ў', 'ug'), '𐍣̇');
  assert.equal(tr('ӈ', 'ug'), '𐍝⃛');
  for (const l of table.letters) {
    for (const s of [l.anbur, ...Object.values(l.by ?? {})]) {
      assert.ok(!s.includes('\u0306'), `${l.cyr}: бреве в анбуре не используем`);
    }
  }
});

test('у знака одно значение: ӧ в угорском — ö, в коми — ӧ', () => {
  assert.equal(tr('ӧ', 'kp'), '𐍩');
  assert.equal(tr('ӧ', 'ug'), '𐍩̈');
  assert.equal(tr('о', 'ug'), '𐍞');
  assert.equal(tr('о', 'bg'), '𐍞');
  assert.equal(tr('й', 'bg'), '𐍙̈');
  assert.equal(tr('й', 'ug'), '𐍙̈');
});

test('буквы, которых нет в языке, остаются кириллицей', () => {
  assert.equal(tr('ӑ'), 'ӑ');
  assert.equal(tr('щ', 'bg'), 'щ');
  assert.equal(tr('ӧ', 'ru'), 'ӧ');
});

test('у каждой буквы сказано, кто ею пишет', () => {
  for (const l of table.letters) {
    assert.ok(l.use && Object.keys(l.use).length, `${l.cyr}: нет use`);
    for (const [g, v] of Object.entries(l.use)) {
      assert.ok(LANGS.includes(g) && ['own', 'loan'].includes(v), `${l.cyr}: ${g}=${v}`);
    }
  }
});
