// Транслитерация кириллицы в анбур — древнепермское письмо — и обратно.
// Одна азбука для всех языков земли календаря: у каждого знака одно значение,
// каждый язык берёт свой набор букв. Таблица — data/anbur.json; правила и источники — docs/anbur.md.

/** Языки записи: коми-пермяцкий, русский, булгарский, угорский (остяки Прикамья). */
export const LANGS = ['kp', 'ru', 'bg', 'ug'];

/**
 * Буквы, которыми пишет язык, — с тем знаком, который у них в этом языке.
 * Буквы, которых в языке нет (в `use` языка нет), не переводятся и остаются кириллицей.
 * @param {{letters: Array<{cyr:string, anbur:string, use?:Object<string,string>, by?:Object<string,string>}>}} table
 * @param {string} lang
 * @returns {Map<string, string>} кириллица → знак анбура
 */
export function letterMap(table, lang = 'kp') {
  const map = new Map();
  for (const l of table.letters) {
    if (l.use && !l.use[lang]) continue;
    map.set(l.cyr, l.by?.[lang] ?? l.anbur);
  }
  return map;
}

/** Длинное соответствие раньше короткого: дж прежде д. */
function greedy(map) {
  let maxLen = 1;
  for (const k of map.keys()) maxLen = Math.max(maxLen, [...k].length);
  return (src) => {
    const chars = [...src];
    let out = '';
    for (let i = 0; i < chars.length;) {
      let hit = false;
      for (let n = maxLen; n >= 1; n--) {
        if (i + n > chars.length) continue;
        const chunk = chars.slice(i, i + n).join('');
        if (map.has(chunk)) {
          out += map.get(chunk);
          i += n;
          hit = true;
          break;
        }
      }
      if (!hit) {
        out += chars[i];
        i += 1;
      }
    }
    return out;
  };
}

/**
 * Готовит транслитератор по таблице.
 * @param {object} table
 * @returns {(text:string, lang?:string) => string}
 */
export function makeTransliterator(table) {
  const run = new Map(LANGS.map((g) => [g, greedy(letterMap(table, g))]));
  return function transliterate(text, lang = 'kp') {
    const f = run.get(lang) ?? run.get('kp');
    return f(text.toLocaleLowerCase('ru').normalize('NFC'));
  };
}

/**
 * Обратное чтение: анбур → кириллица в выбранном языке.
 * Знак — буква вместе с надстрочными точками; надпись читается однозначно,
 * потому что внутри языка у каждой буквы свой знак.
 * @param {object} table
 * @returns {(text:string, lang?:string) => string}
 */
export function makeReader(table) {
  const run = new Map(LANGS.map((g) => {
    const back = new Map();
    for (const [cyr, sign] of letterMap(table, g)) back.set(sign, cyr);
    return [g, greedy(back)];
  }));
  return function read(text, lang = 'kp') {
    const f = run.get(lang) ?? run.get('kp');
    return f(text.normalize('NFC'));
  };
}
