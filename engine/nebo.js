// Астрономические события календаря для промежутка дней и места.
// Точные расчёты (сезоны, фазы и расстояние Луны, затмения) — библиотека Astronomy Engine
// (engine/astronomy.js, MIT, Don Cross). Событие относится к календарным суткам по правилу
// «сутки начинаются на закате» (kalendar.js, calendarDayAt).
// Событие: {k, id, kind:'astro'|'moon'|'eclipse', ru, kp?, t?, span?, cont?, note?}

import * as A from './astronomy.js';
import { calendarDayAt } from './kalendar.js';
import { sunAltitude, solarNoon } from './sun.js';

const DAY_MS = 86400000;
const toTime = (ms) => A.MakeTime(new Date(ms));
const msOf = (t) => t.date.getTime();
const dayOf = (ms, place) => calendarDayAt(ms, place).k;

/** Метеорные потоки и долгота Солнца в максимуме (IMO). Согласованы — docs/sistema.md. */
export const METEORS = [
  { id: 'perseidy', lon: 140.0, ru: 'Персеиды' },
  { id: 'geminidy', lon: 262.2, ru: 'Геминиды' },
];

/** Ковш Большой Медведицы почти в зените в полночь: 7–19 марта в эре Слова (долгота Солнца). */
export const KOVSH = { id: 'kovsh', from: 346.5, to: 358.5, ru: 'Ковш почти в зените в полночь', kp: 'Кош' };

/** Белые ночи начинаются, когда Солнце в полночь выше −12°. */
export const WHITE_NIGHT_ALT = -12;

/** Суперлуние: полнолуние ближе 90 % пути от апогея к перигею своего лунного месяца (по Ноллю). */
export const SUPERMOON_SHARE = 0.1;

function inRange(k, k0, k1) {
  return k >= k0 && k <= k1;
}

function seasonEvents(k0, k1, place, out) {
  const y0 = new Date(k0 * DAY_MS).getUTCFullYear();
  const y1 = new Date(k1 * DAY_MS).getUTCFullYear();
  const names = [
    ['mar_equinox', 'ravnodenstvie-v', 'Весеннее равноденствие'],
    ['jun_solstice', 'solncestoyanie-l', 'Летнее солнцестояние'],
    ['sep_equinox', 'ravnodenstvie-o', 'Осеннее равноденствие'],
    ['dec_solstice', 'solncestoyanie-z', 'Зимнее солнцестояние'],
  ];
  for (let y = y0; y <= y1; y++) {
    const s = A.Seasons(y);
    for (const [key, id, ru] of names) {
      const ms = msOf(s[key]);
      const k = dayOf(ms, place);
      if (inRange(k, k0, k1)) out.push({ k, id, kind: 'astro', ru, t: ms });
    }
  }
}

function sunLongitudeDay(lon, k0) {
  const t = A.SearchSunLongitude(lon, toTime((k0 - 2) * DAY_MS), 400);
  return t ? msOf(t) : null;
}

function meteorEvents(k0, k1, place, out) {
  for (const m of METEORS) {
    let from = k0 - 2;
    while (from <= k1) {
      const ms = sunLongitudeDay(m.lon, from);
      if (ms === null) break;
      const k = dayOf(ms, place);
      if (k > k1) break;
      if (k >= k0) out.push({ k, id: m.id, kind: 'astro', ru: m.ru, t: ms });
      from = k + 300;
    }
  }
  let from = k0 - 20;
  while (from <= k1) {
    const a = sunLongitudeDay(KOVSH.from, from);
    if (a === null) break;
    const b = sunLongitudeDay(KOVSH.to, dayOf(a, place));
    const ka = dayOf(a, place);
    const kb = dayOf(b, place);
    if (ka > k1) break;
    for (let k = ka; k <= kb; k++) {
      if (inRange(k, k0, k1)) {
        out.push({ k, id: KOVSH.id, kind: 'astro', ru: KOVSH.ru, kp: KOVSH.kp, span: [ka, kb], cont: k !== ka });
      }
    }
    from = ka + 300;
  }
}

/** Высота Солнца в местную солнечную полночь перед полднем дня k. */
function midnightAltitude(k, place) {
  const mid = (solarNoon(k - 1, place.lon) + solarNoon(k, place.lon)) / 2;
  return sunAltitude(mid, place.lat, place.lon);
}

function whiteNightEvents(k0, k1, place, out) {
  const y0 = new Date(k0 * DAY_MS).getUTCFullYear();
  const y1 = new Date(k1 * DAY_MS).getUTCFullYear();
  for (let y = y0; y <= y1; y++) {
    const start = Math.floor(Date.UTC(y, 3, 1) / DAY_MS);
    const solstice = Math.floor(Date.UTC(y, 5, 22) / DAY_MS);
    if (midnightAltitude(solstice, place) <= WHITE_NIGHT_ALT) continue; // на этой широте белых ночей нет
    for (let k = start; k <= solstice; k++) {
      if (midnightAltitude(k, place) > WHITE_NIGHT_ALT) {
        if (inRange(k, k0, k1)) out.push({ k, id: 'belye-nochi', kind: 'astro', ru: 'Начало белых ночей' });
        break;
      }
    }
  }
}

function moonDistanceKm(t) {
  const v = A.GeoMoon(t);
  return Math.hypot(v.x, v.y, v.z) * A.KM_PER_AU;
}

/** Ближайшие к моменту t перигей и апогей (км). */
function apsidesAround(t) {
  let a = A.SearchLunarApsis(t.AddDays(-16));
  let per = null;
  let apo = null;
  for (let i = 0; i < 4; i++) {
    const dt = Math.abs(a.time.ut - t.ut);
    if (a.kind === A.ApsisKind.Pericenter && (!per || dt < per.dt)) per = { km: a.dist_km, dt };
    if (a.kind === A.ApsisKind.Apocenter && (!apo || dt < apo.dt)) apo = { km: a.dist_km, dt };
    a = A.NextLunarApsis(a);
  }
  return { perigee: per.km, apogee: apo.km };
}

/** Является ли полнолуние в момент t суперлунием. */
export function isSupermoon(t) {
  const d = moonDistanceKm(t);
  const { perigee, apogee } = apsidesAround(t);
  return { super: d <= perigee + SUPERMOON_SHARE * (apogee - perigee), km: d };
}

const QUARTERS = [
  { id: 'novolunie', ru: 'Новолуние', sign: '●' },
  { id: 'pervaya-chetvert', ru: 'Первая четверть', sign: '◐' },
  { id: 'polnolunie', ru: 'Полнолуние', sign: '○' },
  { id: 'poslednyaya-chetvert', ru: 'Последняя четверть', sign: '◑' },
];

function moonEventsRange(k0, k1, place, out, { phases = true } = {}) {
  let q = A.SearchMoonQuarter(toTime((k0 - 2) * DAY_MS));
  while (true) {
    const ms = msOf(q.time);
    const k = dayOf(ms, place);
    if (k > k1) break;
    if (k >= k0) {
      const Q = QUARTERS[q.quarter];
      if (phases) out.push({ k, id: Q.id, kind: 'moon', ru: Q.ru, sign: Q.sign, t: ms });
      if (q.quarter === 2) {
        const s = isSupermoon(q.time);
        if (s.super) out.push({ k, id: 'superlunie', kind: 'astro', ru: 'Суперлуние', t: ms, note: `${Math.round(s.km).toLocaleString('ru-RU')} км` });
      }
    }
    q = A.NextMoonQuarter(q);
  }
}

function observer(place) {
  return new A.Observer(place.lat, place.lon, place.elev || 150);
}

function moonAltitudeAt(ms, obs) {
  const t = toTime(ms);
  const eq = A.Equator(A.Body.Moon, t, obs, true, true);
  return A.Horizon(t, obs, eq.ra, eq.dec, 'normal').altitude;
}

const LUNAR_KIND = { partial: 'Частное лунное затмение', total: 'Полное лунное затмение' };
const SOLAR_KIND = { partial: 'Частное солнечное затмение', annular: 'Кольцеобразное солнечное затмение', total: 'Полное солнечное затмение' };

function eclipseEvents(k0, k1, place, out) {
  const obs = observer(place);
  // лунные: видно, если Луна над горизонтом хотя бы часть частной фазы
  let e = A.SearchLunarEclipse(toTime((k0 - 2) * DAY_MS));
  while (true) {
    const peak = msOf(e.peak);
    if (peak > (k1 + 2) * DAY_MS) break;
    if (e.kind === 'partial' || e.kind === 'total') {
      const half = e.sd_partial * 60000;
      let seen = 0;
      let n = 0;
      for (let ms = peak - half; ms <= peak + half; ms += 5 * 60000) {
        n++;
        if (moonAltitudeAt(ms, obs) > 0) seen++;
      }
      const k = dayOf(peak, place);
      if (seen > 0 && inRange(k, k0, k1)) {
        out.push({
          k, id: `luna-${e.kind}`, kind: 'eclipse', ru: LUNAR_KIND[e.kind], t: peak,
          note: seen === n ? 'видно целиком' : 'видно частично: Луна у горизонта',
        });
      }
    }
    e = A.NextLunarEclipse(e.peak);
  }
  // солнечные: местные обстоятельства для места
  let s = A.SearchLocalSolarEclipse(toTime((k0 - 2) * DAY_MS), obs);
  while (true) {
    const peak = msOf(s.peak.time);
    if (peak > (k1 + 2) * DAY_MS) break;
    const alts = [s.partial_begin.altitude, s.peak.altitude, s.partial_end.altitude];
    if (Math.max(...alts) > 0) {
      const k = dayOf(Math.max(peak, msOf(s.partial_begin.time)), place);
      if (inRange(k, k0, k1)) {
        out.push({
          k, id: `solnce-${s.kind}`, kind: 'eclipse', ru: SOLAR_KIND[s.kind] || 'Солнечное затмение', t: peak,
          note: `закрыто ${Math.round(s.obscuration * 100)} % диска${s.peak.altitude > 0 ? '' : ', у горизонта'}`,
        });
      }
    }
    s = A.NextLocalSolarEclipse(s.peak.time, obs);
  }
}

/**
 * Астрономические события в днях [k0, k1] для места {lat, lon}.
 * opts: {phases} — четверти Луны (по умолчанию да).
 */
export function astroEvents(k0, k1, place, opts = {}) {
  const out = [];
  seasonEvents(k0, k1, place, out);
  meteorEvents(k0, k1, place, out);
  whiteNightEvents(k0, k1, place, out);
  moonEventsRange(k0, k1, place, out, opts);
  eclipseEvents(k0, k1, place, out);
  return out;
}

/** Фаза Луны для дня k (полдень по UTC): освещённость 0…1 и возраст 0…1. */
export function moonPhaseOfDay(k) {
  const t = toTime(k * DAY_MS + 12 * 3600000);
  const angle = A.MoonPhase(t);
  return { angle, illumination: (1 - Math.cos((angle * Math.PI) / 180)) / 2, age: angle / 360 };
}
