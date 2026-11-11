// Еврейский календарь: чисто расчётный (молад и правила переноса Нового года).
// Алгоритм — Reingold, Dershowitz. Calendrical Calculations (3-е изд., 2008), гл. 8.
// Номер дня k — дни от 1970-01-01 (как в kalendar.js); еврейские сутки, как и наши,
// начинаются на закате, поэтому дата k — это дневная часть суток.
// Месяцы нумеруются по Календарным вычислениям: 1 — нисан … 6 — элул, 7 — тишрей … 12 — адар
// (в високосный год 12 — адар I, 13 — адар II). Год начинается с тишрея.

const RD_TO_K = 719163;   // R.D. 1970-01-01 = 719163
const EPOCH = -1373427;   // R.D. начала еврейской эры (7 октября 3761 г. до н. э., юлиан.)

/** Високосный год (13 месяцев). */
export function hebrewLeap(y) {
  return ((7 * y + 1) % 19 + 19) % 19 < 7;
}

function lastMonth(y) {
  return hebrewLeap(y) ? 13 : 12;
}

function calendarElapsedDays(y) {
  const monthsElapsed = Math.floor((235 * y - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  const days = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  return ((3 * (days + 1)) % 7) < 3 ? days + 1 : days;
}

function yearLengthCorrection(y) {
  const ny0 = calendarElapsedDays(y - 1);
  const ny1 = calendarElapsedDays(y);
  const ny2 = calendarElapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

/** R.D. первого тишрея года y. */
function newYearRD(y) {
  return EPOCH + calendarElapsedDays(y) + yearLengthCorrection(y);
}

/** Число дней в году y. */
export function hebrewYearDays(y) {
  return newYearRD(y + 1) - newYearRD(y);
}

/** Длина месяца m года y. */
export function hebrewMonthDays(y, m) {
  const len = hebrewYearDays(y);
  if ([2, 4, 6, 10, 13].includes(m)) return 29;
  if (m === 8) return len % 10 === 5 ? 30 : 29;      // хешван длинный
  if (m === 9) return len % 10 === 3 ? 29 : 30;      // кислев короткий
  if (m === 12) return hebrewLeap(y) ? 30 : 29;      // адар I в високосный год — 30
  return 30;
}

/** Порядок месяцев в году: тишрей … элул. */
export function hebrewMonthsOfYear(y) {
  const list = [7, 8, 9, 10, 11, 12];
  if (hebrewLeap(y)) list.push(13);
  list.push(1, 2, 3, 4, 5, 6);
  return list;
}

/** Номер дня k для еврейской даты (год, месяц, день). */
export function kFromHebrew(y, m, d) {
  let rd = newYearRD(y) + d - 1;
  for (const mm of hebrewMonthsOfYear(y)) {
    if (mm === m) break;
    rd += hebrewMonthDays(y, mm);
  }
  return rd - RD_TO_K;
}

/** Еврейская дата для номера дня k: {year, month, day}. */
export function hebrewFromK(k) {
  const rd = k + RD_TO_K;
  let y = Math.floor((rd - EPOCH) / 365.2468) + 1;
  while (newYearRD(y) > rd) y--;
  while (newYearRD(y + 1) <= rd) y++;
  let rest = rd - newYearRD(y);
  for (const m of hebrewMonthsOfYear(y)) {
    const len = hebrewMonthDays(y, m);
    if (rest < len) return { year: y, month: m, day: rest + 1 };
    rest -= len;
  }
  throw new Error('hebrewFromK: выход за год');
}

/** Название месяца по-русски (с учётом адара I / адара II). */
export function hebrewMonthName(y, m) {
  const names = {
    1: 'нисан', 2: 'ияр', 3: 'сиван', 4: 'таммуз', 5: 'ав', 6: 'элул',
    7: 'тишрей', 8: 'хешван', 9: 'кислев', 10: 'тевет', 11: 'шват', 12: 'адар', 13: 'адар II',
  };
  if (m === 12 && hebrewLeap(y)) return 'адар I';
  return names[m];
}
