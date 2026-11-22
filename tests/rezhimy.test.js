import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rezhimPoId, rezhimDostupen, vybratRezhim, vybratSloi, nastrojkaPoUmolchaniyu,
  prochestNastrojku, zapisatNastrojku,
} from '../engine/rezhimy.js';

const dannye = JSON.parse(readFileSync(new URL('../data/rezhimy.json', import.meta.url)));

// Те же данные, но мусульманский режим и слой ислама «готовы» — чтобы проверить включение.
const gotovye = structuredClone(dannye);
gotovye.rezhimy.find((r) => r.id === 'musulmanskij').gotov = true;
gotovye.sloiKombo.find((s) => s.id === 'islam').gotov = true;

const VSE_VYKL = { iudaizm: false, islam: false, pravoslavie: false };

test('описание: пять режимов по порядку работы, у каждой веры есть запись', () => {
  assert.deepEqual(dannye.rezhimy.map((r) => r.id), ['igrovoj', 'evrejskij', 'musulmanskij', 'kombo', 'rpc']);
  const very = dannye.very.map((v) => v.id);
  for (const r of dannye.rezhimy) if (r.vera) assert.ok(very.includes(r.vera), r.id);
  for (const s of dannye.sloiKombo) assert.ok(very.includes(s.vera), s.id);
});

test('РПЦ — 12-часовой циферблат, игровой — 24', () => {
  assert.equal(rezhimPoId(dannye, 'rpc').cifer, 12);
  assert.equal(rezhimPoId(dannye, 'igrovoj').cifer, 24);
  assert.equal(rezhimPoId(dannye, 'net-takogo'), null);
});

test('пример: игровой и еврейский режимы доступны; контрпример: комбо пока нет', () => {
  assert.equal(rezhimDostupen(dannye, 'igrovoj'), true);
  assert.equal(rezhimDostupen(dannye, 'evrejskij'), true);
  assert.equal(rezhimDostupen(dannye, 'kombo'), false);
});

test('выбор режима: неготовый и неизвестный — игровой, готовый — он сам', () => {
  assert.equal(vybratRezhim(dannye, 'kombo'), 'igrovoj');
  assert.equal(vybratRezhim(dannye, 'evrejskij'), 'evrejskij');
  assert.equal(vybratRezhim(dannye, 'abc'), 'igrovoj');
  assert.equal(vybratRezhim(gotovye, 'musulmanskij'), 'musulmanskij');
});

test('слои: включается только готовый слой, о котором просили', () => {
  assert.deepEqual(vybratSloi(dannye, { islam: true }), VSE_VYKL);
  assert.deepEqual(vybratSloi(gotovye, { islam: true, iudaizm: true }), { ...VSE_VYKL, islam: true });
  assert.deepEqual(vybratSloi(gotovye, null), VSE_VYKL);
});

test('настройка: по умолчанию, запись и чтение туда и обратно, испорченный текст', () => {
  const umolch = nastrojkaPoUmolchaniyu(dannye);
  assert.deepEqual(umolch, { rezhim: 'igrovoj', sloi: VSE_VYKL });
  const n = { rezhim: 'musulmanskij', sloi: { ...VSE_VYKL, islam: true } };
  assert.deepEqual(prochestNastrojku(gotovye, zapisatNastrojku(n)), n);
  assert.deepEqual(prochestNastrojku(dannye, '{не json'), umolch);
  assert.deepEqual(prochestNastrojku(dannye, null), umolch);
});
