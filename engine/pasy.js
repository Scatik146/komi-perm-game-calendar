// Знаки-пасы «Солнечной восьмёрки» в шрифте Pasy (область частного использования Юникода).
// Геометрия — data/pasy.json (собирает scripts/build-pasy.py); описание — docs/pasy.md.
//
// Два набора знаков:
//   парадный (резы в ромбе): дни U+E001–E008, недели U+E011–E016, месяцы U+E021–E028;
//   печатный (для строки анбура): ноль и цифры U+E030–E038, недели U+E041–E046, месяцы U+E051–E058.
// Два счёта:
//   новый — восьмеричный позиционный, цифры 0–7 (знак 8 есть только в дате);
//   старый — без разрядов и без нуля: число = месяц (57·k) + неделя (8·k) + день (1–8), до 512.
//   Старым счётом пишут деньги: крупная монета — 512 мелких.

/** Число 1–8 (день, год, октава, круг, эра; часть суток) → парадный знак. */
export const numberSign = (n) => String.fromCodePoint(0xE000 + n);
/** Восьмёрка — неделя месяца: 1 Кабыр (8) … 6 Чаль (48) → парадный знак. */
export const eightSign = (w) => String.fromCodePoint(0xE010 + w);
/** Месяц 1 Ур … 8 Кӧч → парадный знак. */
export const monthSign = (m) => String.fromCodePoint(0xE020 + m);

/** Печатная цифра 0–8. */
export const printDigit = (n) => String.fromCodePoint(0xE030 + n);
/** Печатная неделя 1 Кабыр … 6 Чаль. */
export const printEight = (w) => String.fromCodePoint(0xE040 + w);
/** Печатный месяц 1 Ур … 8 Кӧч. */
export const printMonth = (m) => String.fromCodePoint(0xE050 + m);

const SETS = {
  parade: { day: numberSign, week: eightSign, month: monthSign },
  print: { day: printDigit, week: printEight, month: printMonth },
};

/** Год числом: эра, круг, октава, год — четыре знака. */
export function yearSigns({ era, circle, octave, year }, set = 'parade') {
  return [era, circle, octave, year].map(SETS[set].day).join('');
}

/** Дата в году «тремя наборами»: месяц, восьмёрка, день. */
export function dateSigns({ month, week, day }, set = 'parade') {
  const s = SETS[set];
  return s.month(month) + s.week(week) + s.day(day);
}

/** Дата в году поразрядно: месяц, неделя, день — знаками чисел. */
export function dateDigits({ month, week, day }, set = 'parade') {
  return [month, week, day].map(SETS[set].day).join('');
}

/** Заменяет в тексте цифры 1–8 парадными знаками чисел (0 и 9 остаются как есть). */
export function digitsToSigns(text) {
  return text.replace(/[1-8]/g, (d) => numberSign(Number(d)));
}

// ---------- новый счёт: восьмеричный, с нулём ----------

/** Восьмеричные цифры целого неотрицательного числа: 453 → [7, 0, 5]. */
export function octalDigits(n) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('нужно целое число ≥ 0');
  return n.toString(8).split('').map(Number);
}

/** Число в новом счёте печатными цифрами: 453 → знаки 7, 0, 5. */
export const octalSigns = (n) => octalDigits(n).map(printDigit).join('');

/**
 * Числа в тексте. mode: 'keep' — не трогать; 'signs' — цифры 0–8 заменить печатными знаками
 * (текст уже записан по восьми, 9 остаётся); 'octal' — каждое десятичное число перевести
 * в новый счёт (453 → 705) и записать печатными знаками.
 */
export function textNumbers(text, mode = 'keep') {
  if (mode === 'signs') return text.replace(/[0-8]/g, (d) => printDigit(Number(d)));
  if (mode === 'octal') return text.replace(/\d+/g, (s) => octalSigns(Number(s)));
  return text;
}

// ---------- старый счёт: месяц + неделя + день ----------

export const OLD_MAX = 512;

/** Разложение числа 1–512 в старом счёте: {month, week, day}; 0 — места нет. 94 → Ур + Шӧр + 5. */
export function oldParts(v) {
  if (!Number.isInteger(v) || v < 1 || v > OLD_MAX) throw new RangeError('старым счётом пишут числа 1–512');
  const month = Math.floor(v / 57);
  const r = v - 57 * month;          // 0–56: неделя и день
  if (r === 0) return { month, week: 0, day: 0 };
  const day = ((r - 1) % 8) + 1;
  return { month, week: (r - day) / 8, day };
}

/** Значение частей старого счёта: обратное к oldParts. */
export const oldValue = ({ month = 0, week = 0, day = 0 }) => 57 * month + 8 * week + day;

/** Число 1–512 знаками старого счёта (печатными или парадными). */
export function oldSigns(v, set = 'print') {
  const { month, week, day } = oldParts(v);
  const s = SETS[set];
  return (month ? s.month(month) : '') + (week ? s.week(week) : '') + (day ? s.day(day) : '');
}

// ---------- деньги: старый счёт, две монеты ----------

/** Сумма в мелких монетах → {big, small}: крупная монета — 512 мелких; каждая часть — старым счётом. */
export function moneyParts(total) {
  if (!Number.isInteger(total) || total < 1) throw new RangeError('нужна сумма ≥ 1');
  const big = Math.floor(total / OLD_MAX);
  if (big > OLD_MAX) throw new RangeError('больше 512 крупных монет старым счётом не пишут');
  return { big, small: total - OLD_MAX * big };
}
