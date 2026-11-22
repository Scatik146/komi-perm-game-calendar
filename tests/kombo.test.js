import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  vnutriOkna, bezPovtorov, imenaIudeev, imenaMusulman, sloiKombo, vseTochki, sleduyushchayaTochka,
} from '../engine/kombo.js';
import { stateAt } from '../engine/sutki.js';

const chitat = (imya) => JSON.parse(readFileSync(new URL(`../data/${imya}`, import.meta.url)));
const imena = { iudaizm: imenaIudeev(chitat('zmanim.json')), islam: imenaMusulman(chitat('namaz.json')) };
const PERM = { lat: 58.01, lon: 56.23 };
const OBE = { iudaizm: true, islam: true };

// sutkiPerm: игровые сутки Перми в момент UTC
function sutkiPerm(god, mes, den, chas) {
  return stateAt(Date.UTC(god, mes - 1, den, chas), PERM).sutki;
}

test('имена: у иудеев — семь начал молитв, у мусульман — пять намазов без шурука', () => {
  assert.deepEqual(imena.iudaizm, ['cet', 'ishod', 'alot', 'nec', 'minhaGdola', 'minhaKtana', 'plag']);
  assert.deepEqual(imena.islam, ['magrib', 'isha', 'fadzhr', 'zuhr', 'asr']);
});

test('окно: начало входит, конец — нет; пустое время — нет', () => {
  assert.equal(vnutriOkna(5, 5, 10), true);
  assert.equal(vnutriOkna(10, 5, 10), false);
  assert.equal(vnutriOkna(null, 5, 10), false);
  assert.deepEqual(bezPovtorov([{ id: 'a', t: 2 }, { id: 'b', t: 1 }, { id: 'a', t: 2 }]).map((s) => s.id), ['b', 'a']);
});

test('пример: Пермь, 23.11.2026 (сутки от заката 22.11) — пять зелёных точек и шесть синих', () => {
  const sutki = sutkiPerm(2026, 11, 23, 8);
  const sloi = sloiKombo(sutki, PERM.lat, PERM.lon, OBE, imena);
  assert.deepEqual(sloi.islam.tochki.map((p) => p.id), ['magrib', 'isha', 'fadzhr', 'zuhr', 'asr']);
  // будний день: выход звёзд есть, исхода нет
  assert.deepEqual(sloi.iudaizm.tochki.map((p) => p.id), ['cet', 'alot', 'nec', 'minhaGdola', 'minhaKtana', 'plag']);
  for (const p of vseTochki(sloi)) assert.ok(p.t >= sutki.start && p.t < sutki.end, p.id);
  assert.equal(sloi.iudaizm.net, false);
});

test('контрпример: шурука среди точек нет; выключенный слой — null', () => {
  const sutki = sutkiPerm(2026, 11, 22, 8);
  const sloi = sloiKombo(sutki, PERM.lat, PERM.lon, { iudaizm: false, islam: true }, imena);
  assert.equal(sloi.iudaizm, null);
  assert.ok(!sloi.islam.tochki.some((p) => p.id === 'shuruk'));
});

test('сутки от заката субботы 28.11.2026: у иудеев исход вместо выхода звёзд', () => {
  const sutki = sutkiPerm(2026, 11, 28, 14);
  const ids = sloiKombo(sutki, PERM.lat, PERM.lon, OBE, imena).iudaizm.tochki.map((p) => p.id);
  assert.ok(ids.includes('ishod') && !ids.includes('cet'), ids.join(' '));
});

test('следующая точка: после восхода в Перми — минха гдола или зухр', () => {
  const sutki = sutkiPerm(2026, 11, 22, 8);
  const sloi = sloiKombo(sutki, PERM.lat, PERM.lon, OBE, imena);
  const nec = sloi.iudaizm.tochki.find((p) => p.id === 'nec');
  assert.ok(['minhaGdola', 'zuhr'].includes(sleduyushchayaTochka(sloi, nec.t).id));
  assert.equal(sleduyushchayaTochka(sloi, sutki.end), null);
});

test('полярный день (69° с. ш., 20.06.2026): у мусульман точки с 45°, у иудеев — нет', () => {
  const ot = Date.UTC(2026, 5, 20, 0);
  const sloi = sloiKombo({ start: ot, end: ot + 86400000 }, 69.0, 33.1, OBE, imena);
  assert.equal(sloi.islam.tochki.length, 5);
  assert.equal(sloi.islam.stupen, 3);
  assert.equal(sloi.iudaizm.tochki.length, 0);
  assert.equal(sloi.iudaizm.net, true);
});
