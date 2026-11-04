// Знаки-пасы «Солнечной восьмёрки» в шрифте Pasy (область частного использования Юникода).
// Геометрия — data/pasy.json (собирает scripts/build-pasy.py); описание — docs/pasy.md.

/** Число 1–8 (день, год, октава, круг, эра; часть суток) → знак. */
export const numberSign = (n) => String.fromCodePoint(0xE000 + n);
/** Восьмёрка — неделя месяца: 1 Кабыр (8) … 6 Чаль (48) → знак. */
export const eightSign = (w) => String.fromCodePoint(0xE010 + w);
/** Месяц 1 Ур … 8 Кӧч → знак. */
export const monthSign = (m) => String.fromCodePoint(0xE020 + m);

/** Год числом: эра, круг, октава, год — четыре знака. */
export function yearSigns({ era, circle, octave, year }) {
  return [era, circle, octave, year].map(numberSign).join('');
}

/** Дата в году «тремя наборами»: пас месяца, восьмёрка, день. */
export function dateSigns({ month, week, day }) {
  return monthSign(month) + eightSign(week) + numberSign(day);
}

/** Дата в году поразрядно: месяц, неделя, день — знаками чисел. */
export function dateDigits({ month, week, day }) {
  return [month, week, day].map(numberSign).join('');
}

/** Заменяет в тексте цифры 1–8 знаками чисел (0 и 9 остаются как есть). */
export function digitsToSigns(text) {
  return text.replace(/[1-8]/g, (d) => numberSign(Number(d)));
}
