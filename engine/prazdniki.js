// Праздники трёх традиций для любого промежутка дней.
// Номер дня k — дни от 1970-01-01 (дневная дата). Сутки «Солнечной восьмёрки», хиджры
// и еврейского календаря начинаются на закате, поэтому «ночь на 16 марта» — это день 16 марта.
// Событие: {k, id, kind, ru, kp?, night?, span?:[k0,k1], cont?}
//   kind — orthodox | muslim | jewish; span — праздник на несколько дней (событие ставится
//   на первый день, остальные дни получают то же событие с cont: true).

import { hijriUmmAlQura, hijriCivil } from './hijri.js';
import { kFromHebrew, hebrewFromK, hebrewLeap } from './evrei.js';

const DAY_MS = 86400000;
const JDN_K = 2440588; // юлианский день 1970-01-01

/** День недели: 0 — воскресенье … 6 — суббота. */
export function weekday(k) {
  return (((k + 4) % 7) + 7) % 7;
}

/* ---------- юлианский календарь ---------- */

/** Номер дня k для даты юлианского календаря. */
export function kFromJulian(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083 - JDN_K;
}

/** Дата юлианского календаря («старый стиль») для дня k: {year, month, day}. */
export function julianFromK(k) {
  const c = k + JDN_K + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  };
}

/** Православная Пасха года y (юлианская пасхалия) — номер дня k. */
export function orthodoxEaster(y) {
  const a = y % 4;
  const b = y % 7;
  const c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return kFromJulian(y, month, day);
}

/* ---------- православные (они же коми-пермяцкие) ---------- */

// Твёрдые праздники — по юлианскому календарю (ст. ст.); kp — коми-пермяцкое название
// там, где оно есть в календаре автора (2025/26).
export const ORTHODOX_FIXED = [
  { id: 'sochelnik', jm: 12, jd: 24, ru: 'Сочельник', kp: 'Куття-вун' },
  { id: 'rozhdestvo', jm: 12, jd: 25, ru: 'Рождество Христово', kp: 'Розосво', span: 12, spanRu: 'Святки' },
  { id: 'kr-sochelnik', jm: 1, jd: 5, ru: 'Крещенский сочельник', kp: 'Куття' },
  { id: 'kreshchenie', jm: 1, jd: 6, ru: 'Крещение', kp: 'Вежа лун' },
  { id: 'sretenie', jm: 2, jd: 2, ru: 'Сретение' },
  { id: 'blagoveshchenie', jm: 3, jd: 25, ru: 'Благовещение' },
  { id: 'egoriy', jm: 4, jd: 23, ru: 'Егорий вешний' },
  { id: 'nikola-veshniy', jm: 5, jd: 9, ru: 'Никола вешний' },
  { id: 'ivan-kupala', jm: 6, jd: 24, ru: 'Иван Купала' },
  { id: 'petr-pavel', jm: 6, jd: 29, ru: 'Пётр и Павел', kp: 'Петрӧ да Паш' },
  { id: 'ilya', jm: 7, jd: 20, ru: 'Ильин день', kp: 'Илля лун' },
  { id: 'spas-medovyy', jm: 8, jd: 1, ru: 'Медовый Спас', kp: 'Ма лун' },
  { id: 'spas-yablochnyy', jm: 8, jd: 6, ru: 'Яблочный Спас', kp: 'Яблӧг лун' },
  { id: 'spas-hlebnyy', jm: 8, jd: 16, ru: 'Хлебный Спас', kp: 'Нянь лун' },
  { id: 'flor-lavr', jm: 8, jd: 18, ru: 'Флор и Лавр' },
  { id: 'pokrov', jm: 10, jd: 1, ru: 'Покров', kp: 'Покров лун' },
  { id: 'kazanskaya', jm: 10, jd: 22, ru: 'Казанская' },
  { id: 'mihaylov', jm: 11, jd: 8, ru: 'Михайлов день', kp: 'Микайлӧв лун' }, // Никонов 2025, Коса
  { id: 'nikola-zimniy', jm: 12, jd: 6, ru: 'Никола зимний', kp: 'Кольӧ лун' },
];

// Подвижные — от Пасхи (дней).
export const ORTHODOX_MOVABLE = [
  { id: 'maslenitsa', off: -55, ru: 'Масленица', kp: 'Масленьча', span: 7 },
  { id: 'chistyy-chetverg', off: -3, ru: 'Чистый четверг', kp: 'Ыджыт четверг' }, // Грибова 1964 (Никонов 2026)
  { id: 'pasha', off: 0, ru: 'Пасха', kp: 'Ыджыт лун' }, // так у автора и в записях Никонова 2025 (Пелым)
  { id: 'semik', off: 46, ru: 'Семик', kp: 'Семик' },
  { id: 'troitsa', off: 49, ru: 'Троица', kp: 'Стрӧча' },
];

function pushSpan(out, ev, k, days, k0, k1) {
  for (let i = 0; i < days; i++) {
    const kk = k + i;
    if (kk < k0 || kk > k1) continue;
    out.push(i === 0 ? { ...ev, k: kk, span: [k, k + days - 1] } : { ...ev, k: kk, span: [k, k + days - 1], cont: true });
  }
}

export function orthodoxEvents(k0, k1) {
  const out = [];
  const y0 = julianFromK(k0).year - 1;
  const y1 = julianFromK(k1).year + 1;
  for (let y = y0; y <= y1; y++) {
    for (const f of ORTHODOX_FIXED) {
      const k = kFromJulian(y, f.jm, f.jd);
      const ev = { id: f.id, kind: 'orthodox', ru: f.ru, kp: f.kp };
      if (f.span) {
        if (k >= k0 && k <= k1) out.push({ ...ev, k });
        // Святки — от Рождества до Крещенского сочельника
        pushSpan(out, { id: 'svyatki', kind: 'orthodox', ru: f.spanRu, kp: null, band: true }, k, f.span, k0, k1);
      } else if (k >= k0 && k <= k1) out.push({ ...ev, k });
    }
    const easter = orthodoxEaster(y);
    for (const f of ORTHODOX_MOVABLE) {
      const k = easter + f.off;
      const ev = { id: f.id, kind: 'orthodox', ru: f.ru, kp: f.kp };
      if (f.span) pushSpan(out, ev, k, f.span, k0, k1);
      else if (k >= k0 && k <= k1) out.push({ ...ev, k });
    }
  }
  return out;
}

/* ---------- мусульманские ---------- */

/** Дата по хиджре для дня k: Умм аль-Кура, если её знает среда, иначе табличный расчёт. */
export function hijriOf(k) {
  return hijriUmmAlQura(k * DAY_MS + 12 * 3600000) || hijriCivil(k);
}

export const MUSLIM = [
  { id: 'ragaib', ru: 'Рагаиб', night: true },                 // ночь на первую пятницу раджаба
  { id: 'miradzh', m: 7, d: 27, ru: 'Мирадж', night: true },
  { id: 'baraat', m: 8, d: 15, ru: 'Бараат', night: true },
  { id: 'ramadan', m: 9, d: 1, ru: 'Рамадан', spanMonth: true },
  { id: 'kadr', m: 9, d: 27, ru: 'Ночь Кадр', night: true },
  { id: 'uraza', m: 10, d: 1, ru: 'Ураза-байрам' },
  { id: 'arafa', m: 12, d: 9, ru: 'День Арафа' },
  { id: 'kurban', m: 12, d: 10, ru: 'Курбан-байрам' },
  { id: 'hijra-ny', m: 1, d: 1, ru: 'Новый год по хиджре' },
  { id: 'ashura', m: 1, d: 10, ru: 'Ашура' },
  { id: 'mavlid', m: 3, d: 12, ru: 'Мавлид', night: true },
];

export function muslimEvents(k0, k1) {
  const out = [];
  const from = k0 - 31;
  const h = [];
  for (let k = from; k <= k1; k++) h.push(hijriOf(k));
  const at = (k) => h[k - from];
  for (let k = k0; k <= k1; k++) {
    const x = at(k);
    for (const f of MUSLIM) {
      const ev = { id: f.id, kind: 'muslim', ru: f.ru, night: !!f.night };
      if (f.id === 'ragaib') {
        if (x.month === 7 && x.day <= 7 && weekday(k) === 5) out.push({ ...ev, k });
        continue;
      }
      if (f.spanMonth) {
        if (x.month === f.m) {
          // начало и конец месяца
          let s = k; while (s - 1 >= from && at(s - 1).month === f.m) s--;
          let e = k; while (hijriOf(e + 1).month === f.m) e++;
          out.push(x.day === 1 ? { ...ev, k, span: [s, e] } : { ...ev, k, span: [s, e], cont: true });
        }
        continue;
      }
      if (x.month === f.m && x.day === f.d) out.push({ ...ev, k });
    }
  }
  return out;
}

/* ---------- иудейские (по диаспоре) ---------- */

function jewishDefs(y) {
  const adar = hebrewLeap(y) ? 13 : 12;
  // Тиша бе-Ав переносится на 10 ава, если 9 ава — суббота
  let av9 = kFromHebrew(y, 5, 9);
  if (weekday(av9) === 6) av9 += 1;
  return [
    { id: 'rosh-ha-shana', k: kFromHebrew(y, 7, 1), days: 2, ru: 'Рош ха-Шана' },
    { id: 'yom-kippur', k: kFromHebrew(y, 7, 10), ru: 'Йом Киппур' },
    { id: 'sukkot', k: kFromHebrew(y, 7, 15), days: 7, ru: 'Суккот' },
    { id: 'shmini-atzeret', k: kFromHebrew(y, 7, 22), ru: 'Шмини Ацерет' },
    { id: 'simhat-tora', k: kFromHebrew(y, 7, 23), ru: 'Симхат Тора' },
    { id: 'hanuka', k: kFromHebrew(y, 9, 25), days: 8, ru: 'Ханука' },
    { id: 'tu-bi-shvat', k: kFromHebrew(y, 11, 15), ru: 'Ту би-Шват' },
    { id: 'purim', k: kFromHebrew(y, adar, 14), ru: 'Пурим' },
    { id: 'pesah', k: kFromHebrew(y, 1, 15), days: 8, ru: 'Песах' },
    { id: 'lag-ba-omer', k: kFromHebrew(y, 2, 18), ru: 'Лаг ба-Омер' },
    { id: 'shavuot', k: kFromHebrew(y, 3, 6), days: 2, ru: 'Шавуот' },
    { id: 'tisha-be-av', k: av9, ru: 'Тиша бе-Ав' },
  ];
}

export function jewishEvents(k0, k1) {
  const out = [];
  const y0 = hebrewFromK(k0).year;
  const y1 = hebrewFromK(k1).year;
  for (let y = y0; y <= y1; y++) {
    for (const f of jewishDefs(y)) {
      const ev = { id: f.id, kind: 'jewish', ru: f.ru };
      if (f.days) pushSpan(out, ev, f.k, f.days, k0, k1);
      else if (f.k >= k0 && f.k <= k1) out.push({ ...ev, k: f.k });
    }
  }
  return out;
}

