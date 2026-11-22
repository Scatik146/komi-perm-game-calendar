import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zmanimDnya, vidDnya, svyatoj, OKRUGLENIE } from '../engine/zmanim.js';
import { sutkiPoDate } from '../engine/namaz.js';

// Скрины страницы зманим chabad.org (автор, 22.11.2026). Пермь — 58,01° с. ш., 56,23° в. д., UTC+5;
// Санкт-Петербург — 59,94° с. ш., 30,31° в. д., UTC+3. Время после полуночи — следующего числа.
const PERM = { lat: 58.01, lon: 56.23, tz: 5 };
const PITER = { lat: 59.9386, lon: 30.3141, tz: 3 };
const SKRINY = [
  [PERM, '2026-11-20', { alot: '6:57', misheyakir: '7:51', nec: '9:12', shma: '11:02', tfila: '11:41',
    hacot: '12:59', minhaGdola: '13:20', minhaKtana: '15:18', plag: '16:07', svechi: '16:30',
    shkia: '16:48', cet: '17:35', hacotLajla: '1:01' }],
  [PERM, '2026-11-22', { alot: '7:01', misheyakir: '7:54', nec: '9:16', hacot: '13:00',
    minhaGdola: '13:20', shkia: '16:45', cet: '17:32' }],
  [PERM, '2026-11-28', { alot: '7:10', misheyakir: '8:04', nec: '9:28', shma: '11:11', tfila: '11:48',
    hacot: '13:02', minhaGdola: '13:21', minhaKtana: '15:12', plag: '15:58', shkia: '16:36',
    ishod: '17:47', hacotLajla: '1:03' }],
  [PERM, '2026-06-20', { alot: '1:16', misheyakir: '1:16', nec: '4:11', shma: '8:39', tfila: '10:11',
    hacot: '13:16', minhaGdola: '14:03', minhaKtana: '18:40', plag: '20:36', shkia: '22:22',
    ishod: '1:01', hacotLajla: '1:16' }],
  [PITER, '2026-06-20', { alot: '0:59', misheyakir: '0:59', nec: '3:35', shma: '8:12', tfila: '9:48',
    hacot: '12:59', minhaGdola: '13:48', minhaKtana: '18:36', plag: '20:36', shkia: '22:25',
    ishod: '0:59', hacotLajla: '1:00' }],
  // Исход праздника и субботы — кеш-копии страницы свечей (Алиса).
  [PERM, '2026-09-19', { ishod: '20:22' }],
  [PERM, '2026-09-21', { ishod: '20:16' }],
  [PERM, '2026-09-27', { ishod: '19:59' }],
];

// minutySutok: минуты от местной полуночи (0–1439)
function minutySutok(t, tz) {
  return (((t / 60000 + tz * 60) % 1440) + 1440) % 1440;
}

// raznica: страница минус расчёт, мин, через полночь — кратчайшим путём
function raznica(stranica, t, tz) {
  const [h, m] = stranica.split(':').map(Number);
  const r = (((h * 60 + m - minutySutok(t, tz)) % 1440) + 2160) % 1440 - 720;
  return r;
}

for (const [mesto, data, stranica] of SKRINY) {
  test(`зманим ${data} (${mesto.tz === 5 ? 'Пермь' : 'Петербург'}) — как на chabad.org ±1 мин`, () => {
    const [g, m, d] = data.split('-').map(Number);
    const { vremena } = zmanimDnya(sutkiPoDate(g, m, d), mesto.lat, mesto.lon);
    for (const [imya, vremya] of Object.entries(stranica)) {
      assert.ok(vremena[imya] !== null, `${imya}: нет времени`);
      const r = raznica(vremya, vremena[imya], mesto.tz);
      assert.ok(Math.abs(r) <= 1, `${imya}: страница ${vremya}, разница ${r} мин`);
    }
  });
}

test('скрины: больше трёх четвертей времён совпадают с chabad.org точно', () => {
  let vsego = 0;
  let tochno = 0;
  for (const [mesto, data, stranica] of SKRINY) {
    const [g, m, d] = data.split('-').map(Number);
    const { vremena } = zmanimDnya(sutkiPoDate(g, m, d), mesto.lat, mesto.lon);
    for (const [imya, vremya] of Object.entries(stranica)) {
      vsego += 1;
      if (raznica(vremya, vremena[imya], mesto.tz) === 0) tochno += 1;
    }
  }
  assert.ok(tochno / vsego > 0.75, `точно ${tochno} из ${vsego}`);
});

test('летом: мишеякир и алот — полночь, исход субботы в Петербурге — полночь', () => {
  const perm = zmanimDnya(sutkiPoDate(2026, 6, 20), PERM.lat, PERM.lon);
  assert.equal(perm.vremena.misheyakir, perm.vremena.alot);
  assert.deepEqual(perm.zameny, ['alot', 'misheyakir']);
  const piter = zmanimDnya(sutkiPoDate(2026, 6, 20), PITER.lat, PITER.lon);
  assert.equal(piter.vremena.ishod, piter.vremena.hacotLajla);
  assert.deepEqual(piter.zameny, ['alot', 'misheyakir', 'ishod']);
});

test('зимой в Перми замен нет; вторая строка минхи — 30 мин после хацота', () => {
  const z = zmanimDnya(sutkiPoDate(2026, 11, 22), PERM.lat, PERM.lon);
  assert.deepEqual(z.zameny, []);
  assert.equal(z.vremena.minhaGdola30 - z.vremena.hacot, 31 * 60000);
  const leto = zmanimDnya(sutkiPoDate(2026, 6, 20), PERM.lat, PERM.lon);
  assert.equal(leto.vremena.minhaGdola30, null);
});

test('свечи и исход: пятница, суббота, праздники сентября 2026 г.', () => {
  const vid = (m, d) => vidDnya(sutkiPoDate(2026, m, d));
  assert.equal(vid(11, 27).svechi, true);
  assert.equal(vid(11, 28).ishod, true);
  assert.equal(vid(11, 26).svechi, false);
  assert.equal(vid(9, 20).svechi, true);           // канун Йом Киппура (воскресенье)
  assert.equal(vid(9, 21).ishod, true);            // исход Йом Киппура
  assert.equal(vid(9, 25).svechi, true);           // пятница, канун Суккота
  assert.equal(vid(9, 26).svechiPosleIshoda, true); // первый день Суккота → второй
  assert.equal(vid(9, 27).ishod, true);
  assert.equal(svyatoj(sutkiPoDate(2026, 9, 28)), false);
});

test('свечи: шкия − 18 мин, только в пятницу и канун праздника', () => {
  const pt = zmanimDnya(sutkiPoDate(2026, 11, 27), PERM.lat, PERM.lon);
  assert.ok(pt.vremena.svechi !== null);
  assert.ok(Math.abs(pt.vremena.shkia - pt.vremena.svechi - 18 * 60000) <= 60000);
  assert.equal(zmanimDnya(sutkiPoDate(2026, 11, 26), PERM.lat, PERM.lon).vremena.svechi, null);
  assert.equal(OKRUGLENIE.svechi, 'vniz');
});

test('полярный день: восхода и заката нет — времена по «часам времени» пустые', () => {
  const z = zmanimDnya(sutkiPoDate(2026, 6, 20), 69.0, 33.1);
  assert.equal(z.vremena.shkia, null);
  assert.equal(z.vremena.shma, null);
});
