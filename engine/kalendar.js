// Календарная дата «Солнечной восьмёрки»: год, месяц, неделя, день; эра, круг, октава.
// Описание системы — docs/sistema.md (разделы 4–7), решения — docs/kalendar.md.
// Вариант Б: дата месяца — дневная часть суток; сутки начинаются накануне на закате.

import { DAY_MS, altitudeCrossing } from './sun.js';
import { RULES, solarDayIndex } from './sutki.js';

/** Длины месяцев Ур … Кӧч; в длинный год Сир на день длиннее. */
export const MONTH_LENGTHS = [44, 45, 45, 45, 48, 46, 46, 46];
export const MONTH_IDS = ['ur', 'osh', 'dozmor', 'vormos', 'chuzhmor', 'yus', 'sir', 'koch'];
const SIR = 6;

/** Опорный год: 1190 начался 21 декабря 2025 (дневная дата Ур ӧтік). */
const ANCHOR_YEAR = 1190;
const ANCHOR_DAY = Math.floor(Date.UTC(2025, 11, 21) / DAY_MS);

/** Длинный год (366 суток): номер делится на 4 и не делится на 128 — счёт по руке. */
export function isLongYear(n) {
  return n % 4 === 0 && n % 128 !== 0;
}

/** Сколько длинных лет среди номеров 1…n (для n ≤ 0 — со знаком минус, разности верны). */
function longYearsUpTo(n) {
  return Math.floor(n / 4) - Math.floor(n / 128);
}

/** Номер дня (от 1970-01-01, UTC) первого дня года n — Ур ӧтік. */
export function yearStart(n) {
  return ANCHOR_DAY + 365 * (n - ANCHOR_YEAR) + longYearsUpTo(n - 1) - longYearsUpTo(ANCHOR_YEAR - 1);
}

/** Длины месяцев года n. */
export function monthLengths(n) {
  return MONTH_LENGTHS.map((d, i) => d + (i === SIR && isLongYear(n) ? 1 : 0));
}

/**
 * Позиции года n: эра, круг, октава, год — каждая 1–8.
 * Эра 1 — Пути (годы 1–512, с 837), 2 — Света, 3 — Слова. Годы до кометы (n ≤ 0) — эра Чуди: era = 0.
 */
export function yearPositions(n) {
  const y = (((n - 1) % 512) + 512) % 512;
  return {
    era: Math.floor((n - 1) / 512) + 1,
    circle: Math.floor(y / 64) + 1,
    octave: Math.floor((y % 64) / 8) + 1,
    year: (y % 8) + 1,
  };
}

/** Дата календаря для номера дня k (дневная дата). */
export function dateOfDay(k) {
  let n = ANCHOR_YEAR + Math.floor((k - ANCHOR_DAY) / 365.2421875);
  while (yearStart(n) > k) n--;
  while (yearStart(n + 1) <= k) n++;
  let d = k - yearStart(n);
  const lengths = monthLengths(n);
  let m = 0;
  while (d >= lengths[m]) { d -= lengths[m]; m++; }
  return {
    yearNumber: n,
    ...yearPositions(n),
    month: m + 1,
    monthLength: lengths[m],
    dayOfMonth: d + 1,
    week: Math.floor(d / 8) + 1,          // 1 — Кабыр … 6 — Чаль
    day: (d % 8) + 1,                     // 1 — ӧтік … 8 — кыкьямыс
    dayOfYear: k - yearStart(n) + 1,
    longYear: isLongYear(n),
    dayNumber: k,
  };
}

/** Закат (мс UTC) в солнечные сутки k в точке {lat, lon}; null — Солнце не заходит или не встаёт. */
export function sunsetOf(k, place) {
  return altitudeCrossing(k, place.lat, place.lon, RULES.horizon, +1).t;
}

/**
 * Номер дня календаря для момента ms в точке {lat, lon}: сутки начинаются на закате,
 * поэтому после заката идёт уже следующий день. Возвращает и начало этих суток.
 */
export function calendarDayAt(ms, place) {
  const k = solarDayIndex(ms, place.lon);
  const set = sunsetOf(k, place);
  if (set !== null && ms >= set) return { k: k + 1, sutkiStart: set, sutkiEnd: sunsetOf(k + 1, place) };
  return { k, sutkiStart: sunsetOf(k - 1, place), sutkiEnd: set };
}

/** Полная дата календаря в момент ms в точке {lat, lon}. */
export function calendarAt(ms, place) {
  const at = calendarDayAt(ms, place);
  return { ...dateOfDay(at.k), sutkiStart: at.sutkiStart, sutkiEnd: at.sutkiEnd };
}

/** Гражданская (григорианская) дата UTC для номера дня k — «ГГГГ-ММ-ДД». */
export function isoOfDay(k) {
  return new Date(k * DAY_MS).toISOString().slice(0, 10);
}
