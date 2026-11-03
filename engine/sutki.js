// Деление суток: восемь рубежей, восемь частей, четыре четверти.
// Описание системы — docs/sutki.md.

import {
  DAY_MS, solarNoon, altitudeCrossing, asrAltitude, apparentSolarTime, sunAltitude,
} from './sun.js';

/** Параметры системы. */
export const RULES = {
  horizon: -0.833,     // видимый край диска с учётом рефракции
  twilight: -6,        // рубежи II и IV: по образцу булгарского определителя времени в Афкуле
  asrShadow: 2,        // ханафитский аср: тень = 2 предмета + полуденная тень
};

/** Порядок рубежей внутри солнечных суток (от полуночи до полуночи). */
export const ORDER = ['III', 'IV', 'V', 'VI', 'VII', 'VIII', 'I', 'II'];

/** Порядок рубежей в календарных сутках (сутки начинаются с заката). */
export const SUTKI_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Какой четверти принадлежит часть, начинающаяся с данного рубежа. */
export const QUARTER_OF_PART = {
  VIII: 'ryt', I: 'ryt',
  II: 'oy', III: 'oy',
  IV: 'asyv', V: 'asyv',
  VI: 'lun', VII: 'lun',
};

/** Номер солнечных суток для момента ms на долготе lon. */
export function solarDayIndex(ms, lonDeg) {
  return Math.floor((ms + (lonDeg / 15) * 3600000) / DAY_MS);
}

/**
 * Рубежи солнечных суток k (от полуночи III до темноты II).
 * Каждый рубеж: {id, t, merged?} — merged=true, если рубеж слился с полуночью
 * из-за того, что Солнце не опускается на −6°.
 */
export function rubezhiForDay(k, lat, lon) {
  const noonPrev = solarNoon(k - 1, lon);
  const noon = solarNoon(k, lon);
  const noonNext = solarNoon(k + 1, lon);
  const midnight = (noonPrev + noon) / 2;
  const midnightNext = (noon + noonNext) / 2;

  const dawn = altitudeCrossing(k, lat, lon, RULES.twilight, -1);
  const rise = altitudeCrossing(k, lat, lon, RULES.horizon, -1);
  const set = altitudeCrossing(k, lat, lon, RULES.horizon, +1);
  const dusk = altitudeCrossing(k, lat, lon, RULES.twilight, +1);
  const asr = altitudeCrossing(k, lat, lon, (decl) => asrAltitude(lat, decl, RULES.asrShadow), +1);

  const list = [];
  list.push({ id: 'III', t: midnight });
  list.push(dawn.t !== null ? { id: 'IV', t: dawn.t } : { id: 'IV', t: midnight, merged: true });
  if (rise.t !== null) list.push({ id: 'V', t: rise.t });
  if (rise.t !== null) list.push({ id: 'VI', t: (rise.t + noon) / 2 });
  list.push({ id: 'VII', t: noon });
  if (asr.t !== null) list.push({ id: 'VIII', t: asr.t });
  if (set.t !== null) list.push({ id: 'I', t: set.t });
  list.push(dusk.t !== null ? { id: 'II', t: dusk.t } : { id: 'II', t: midnightNext, merged: true });
  return list;
}

/** Все рубежи в окне солнечных суток [k0, k1], по времени. */
export function rubezhiRange(k0, k1, lat, lon) {
  const all = [];
  for (let k = k0; k <= k1; k++) all.push(...rubezhiForDay(k, lat, lon).map((r) => ({ ...r, day: k })));
  // слитые рубежи II/IV стоят в одной точке с III: порядок II → III → IV
  const rank = { II: 0, III: 1, IV: 2 };
  all.sort((a, b) => a.t - b.t || (rank[a.id] ?? 1) - (rank[b.id] ?? 1));
  return all;
}

/** Число долей в части, начинающейся рубежом id. */
export function subdivisionsOf(id, config = { default: 6, byPart: {} }) {
  return (config.byPart && config.byPart[id]) || config.default || 1;
}

/**
 * Мелкое деление: какая по счёту доля текущей части идёт сейчас.
 * Доли внутри части равны; части между собой неравны.
 * @returns {{index:number, of:number, start:number, end:number}} index — с 1
 */
export function subdivisionAt(now, current, next, config) {
  const of = subdivisionsOf(current.id, config);
  const len = (next.t - current.t) / of;
  if (len <= 0) return { index: 1, of, start: current.t, end: next.t };
  const i = Math.min(of - 1, Math.floor((now - current.t) / len));
  return { index: i + 1, of, start: current.t + i * len, end: current.t + (i + 1) * len };
}

/**
 * Состояние в момент now для точки {lat, lon}.
 * @returns {{
 *   now:number, solarTime:number, altitude:number,
 *   current:{id:string,t:number,merged?:boolean}, next:{id:string,t:number,merged?:boolean},
 *   part:string, quarter:string, progress:number,
 *   sutki:{start:number, end:number, rubezhi:Array<{id:string,t:number,merged?:boolean}>}
 * }}
 * part — id рубежа, после которого идёт текущая часть; sutki — календарные сутки от заката до заката.
 */
export function stateAt(now, place) {
  const { lat, lon } = place;
  const k = solarDayIndex(now, lon);
  const all = rubezhiRange(k - 2, k + 2, lat, lon);

  let i = all.findIndex((r) => r.t > now);
  if (i <= 0) throw new Error('Окно расчёта слишком узкое');
  // в точке слияния II=III=IV текущим считаем последний из слитых
  const current = all[i - 1];
  const next = all[i];

  const sunsets = all.filter((r) => r.id === 'I');
  const start = [...sunsets].reverse().find((r) => r.t <= now);
  const end = sunsets.find((r) => r.t > now);
  const rubezhi = all.filter((r) => r.t >= start.t && r.t < end.t);

  return {
    now,
    solarTime: apparentSolarTime(now, lon),
    altitude: sunAltitude(now, lat, lon),
    current,
    next,
    part: current.id,
    quarter: QUARTER_OF_PART[current.id],
    progress: (now - current.t) / (next.t - current.t),
    sutki: { start: start.t, end: end.t, rubezhi },
  };
}
