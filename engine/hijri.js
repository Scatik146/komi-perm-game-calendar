// Дата по хиджре. Основной расчёт — календарь Умм аль-Кура через Intl (в браузере);
// названия месяцев — свои: на Android урезанные данные ICU подставляют григорианские названия.
// Запасной расчёт — табличный (гражданский) исламский календарь: может расходиться на день.

/** Названия месяцев хиджры по-русски (как в CLDR). */
export const HIJRI_MONTHS_RU = [
  'мухаррам', 'сафар', 'раби-уль-авваль', 'раби-уль-ахир', 'джумад-уль-авваль', 'джумад-уль-ахир',
  'раджаб', 'шаабан', 'рамадан', 'шавваль', 'зуль-каада', 'зуль-хиджжа',
];

/** Табличный исламский календарь для дня k (от 1970-01-01): {year, month, day}. */
export function hijriCivil(k) {
  const jd = k + 2440588;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  return { year: 30 * n + j - 30, month, day };
}

/** Умм аль-Кура через Intl числами; null — если браузер не знает этого календаря. */
export function hijriUmmAlQura(ms) {
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric',
    });
    if (!/^islamic/.test(f.resolvedOptions().calendar)) return null;
    const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
    const r = { year: parseInt(p.year, 10), month: parseInt(p.month, 10), day: parseInt(p.day, 10) };
    return [r.year, r.month, r.day].every(Number.isFinite) && r.month >= 1 && r.month <= 12 ? r : null;
  } catch {
    return null;
  }
}

/** Подпись даты по хиджре для дня k: «29 джумад-уль-авваль 1448 г. хиджры». */
export function hijriText(k) {
  const ms = k * 86400000 + 12 * 3600000;
  const u = hijriUmmAlQura(ms);
  const h = u || hijriCivil(k);
  return `${h.day} ${HIJRI_MONTHS_RU[h.month - 1]} ${h.year} г. хиджры${u ? '' : ' (табличный расчёт, ±1 день)'}`;
}
