// Праздники и события неба: сверка с календарём автора на 1190 год (2025/26),
// исправленным 11 ноября 2026 г., и с опубликованными датами.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orthodoxEaster, orthodoxEvents, muslimEvents, jewishEvents, julianFromK, kFromJulian,
} from '../engine/prazdniki.js';
import { hebrewFromK, kFromHebrew, hebrewYearDays } from '../engine/evrei.js';
import { astroEvents, isSupermoon } from '../engine/nebo.js';
import { yearStart } from '../engine/kalendar.js';

const DAY = 86400000;
const k = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / DAY);
const iso = (kk) => new Date(kk * DAY).toISOString().slice(0, 10);
const first = (list, id) => list.find((e) => e.id === id && !e.cont);
const Y0 = yearStart(1190);
const Y1 = yearStart(1191) - 1;
const kudymkar = { lat: 59.01, lon: 54.66, tz: 'Asia/Yekaterinburg' };

test('юлианский календарь: 7 января = 25 декабря ст. ст.', () => {
  assert.deepEqual(julianFromK(k('2026-01-07')), { year: 2025, month: 12, day: 25 });
  assert.equal(kFromJulian(2026, 10, 1), k('2026-10-14'));
});

test('православная Пасха', () => {
  assert.equal(iso(orthodoxEaster(2025)), '2025-04-20');
  assert.equal(iso(orthodoxEaster(2026)), '2026-04-12');
  assert.equal(iso(orthodoxEaster(2027)), '2027-05-02');
});

test('православные праздники 1190 года', () => {
  const ev = orthodoxEvents(Y0, Y1);
  const want = {
    sochelnik: '2026-01-06', rozhdestvo: '2026-01-07', kreshchenie: '2026-01-19',
    maslenitsa: '2026-02-16', 'chistyy-chetverg': '2026-04-09', pasha: '2026-04-12', egoriy: '2026-05-06',
    semik: '2026-05-28', troitsa: '2026-05-31', 'petr-pavel': '2026-07-12', ilya: '2026-08-02',
    'spas-medovyy': '2026-08-14', 'spas-yablochnyy': '2026-08-19', 'spas-hlebnyy': '2026-08-29',
    pokrov: '2026-10-14', 'nikola-zimniy': '2026-12-19',
  };
  for (const [id, d] of Object.entries(want)) assert.equal(iso(first(ev, id).k), d, id);
  assert.equal(first(ev, 'rozhdestvo').kp, 'Розосво');
  assert.equal(iso(first(ev, 'maslenitsa').span[1]), '2026-02-22');
});

test('мусульманские праздники 1190 года (Умм аль-Кура)', () => {
  const ev = muslimEvents(Y0, Y1);
  const want = {
    ragaib: '2025-12-26', miradzh: '2026-01-16', baraat: '2026-02-03', ramadan: '2026-02-18',
    kadr: '2026-03-16', uraza: '2026-03-20', kurban: '2026-05-27', 'hijra-ny': '2026-06-16',
    ashura: '2026-06-25', mavlid: '2026-08-25',
  };
  for (const [id, d] of Object.entries(want)) assert.equal(iso(first(ev, id).k), d, id);
  assert.equal(iso(first(ev, 'ramadan').span[1]), '2026-03-19');
  const ragaib = ev.filter((e) => e.id === 'ragaib').map((e) => iso(e.k));
  assert.deepEqual(ragaib, ['2025-12-26', '2026-12-11']);
});

test('еврейский календарь: годы и праздники 1190 года (диаспора)', () => {
  assert.deepEqual(hebrewFromK(k('2026-12-05')), { year: 5787, month: 9, day: 25 });
  assert.equal(kFromHebrew(5787, 7, 1), k('2026-09-12'));
  assert.equal(hebrewYearDays(5784), 383);
  const ev = jewishEvents(Y0, Y1);
  const want = {
    'tu-bi-shvat': '2026-02-02', purim: '2026-03-03', pesah: '2026-04-02', 'lag-ba-omer': '2026-05-05',
    shavuot: '2026-05-22', 'tisha-be-av': '2026-07-23', 'rosh-ha-shana': '2026-09-12',
    'yom-kippur': '2026-09-21', sukkot: '2026-09-26', hanuka: '2026-12-05',
  };
  for (const [id, d] of Object.entries(want)) assert.equal(iso(first(ev, id).k), d, id);
  assert.equal(iso(first(ev, 'hanuka').span[1]), '2026-12-12');
  assert.equal(iso(first(ev, 'pesah').span[1]), '2026-04-09');
});

test('небо 1190 года для Кудымкара: сезоны, потоки, Ковш, белые ночи, суперлуния', () => {
  const ev = astroEvents(Y0, Y1, kudymkar, { phases: false });
  // солнцестояние 21.12.2025 в 20:03 по местному — уже после заката: Ур кык
  assert.equal(iso(first(ev, 'solncestoyanie-z').k), '2025-12-22');
  assert.equal(iso(first(ev, 'solncestoyanie-l').k), '2026-06-21');
  assert.equal(iso(first(ev, 'ravnodenstvie-o').k), '2026-09-23');
  assert.equal(iso(first(ev, 'geminidy').k), '2026-12-14');
  assert.ok(['2026-08-12', '2026-08-13'].includes(iso(first(ev, 'perseidy').k)));
  const kovsh = first(ev, 'kovsh');
  assert.equal(iso(kovsh.span[0]), '2026-03-07');
  assert.equal(iso(kovsh.span[1]), '2026-03-19');
  const white = iso(first(ev, 'belye-nochi').k);
  assert.ok(white >= '2026-05-12' && white <= '2026-05-20', white);
  const sm = ev.filter((e) => e.id === 'superlunie').map((e) => iso(e.k));
  assert.deepEqual(sm, ['2026-01-03', '2026-11-25']); // 24.11 в 19:54 по местному — после заката
});

test('суперлуния 2026: только 3 января, 24 ноября и 24 декабря', () => {
  assert.equal(isSupermoon(makeT('2026-01-03T10:03Z')).super, true);
  assert.equal(isSupermoon(makeT('2026-02-01T22:09Z')).super, false);
  assert.equal(isSupermoon(makeT('2026-10-26T04:12Z')).super, false);
  assert.equal(isSupermoon(makeT('2026-12-24T01:28Z')).super, true);
});

test('затмения по месту: 12.08.2026 в крае не видно, 7.09.2025 и 1.06.2030 — видно', () => {
  const y2026 = astroEvents(k('2026-01-01'), k('2026-12-31'), kudymkar, { phases: false }).filter((e) => e.kind === 'eclipse');
  assert.ok(!y2026.some((e) => e.id.startsWith('solnce')));
  const s2025 = astroEvents(k('2025-09-01'), k('2025-09-30'), kudymkar, { phases: false }).filter((e) => e.kind === 'eclipse');
  assert.equal(s2025[0].id, 'luna-total');
  const s2030 = astroEvents(k('2030-05-25'), k('2030-06-05'), kudymkar, { phases: false }).filter((e) => e.kind === 'eclipse');
  assert.ok(s2030.some((e) => e.id.startsWith('solnce')));
});

import * as A from '../engine/astronomy.js';
function makeT(s) { return A.MakeTime(new Date(s)); }
