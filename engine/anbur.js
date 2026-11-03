// Транслитерация кириллицы (коми-пермяцкой и русской) в анбур — древнепермское письмо.
// Таблица соответствий — data/anbur.json; правила и источники — docs/anbur.md.

/**
 * Готовит транслитератор по таблице.
 * @param {{letters: Array<{cyr:string, anbur:string, ru?:string}>}} table
 * @returns {(text:string, lang?:'kp'|'ru') => string}
 */
export function makeTransliterator(table) {
  const kp = new Map();
  const ru = new Map();
  let maxLen = 1;
  for (const l of table.letters) {
    kp.set(l.cyr, l.anbur);
    ru.set(l.cyr, l.ru ?? l.anbur);
    maxLen = Math.max(maxLen, l.cyr.length);
  }
  ru.delete('дж'); // в русском дж и дз — два звука
  ru.delete('дз');

  return function transliterate(text, lang = 'kp') {
    const map = lang === 'ru' ? ru : kp;
    const src = text.toLocaleLowerCase('ru').normalize('NFC');
    let out = '';
    for (let i = 0; i < src.length;) {
      let hit = false;
      for (let n = maxLen; n >= 1; n--) {
        const chunk = src.slice(i, i + n);
        if (chunk.length === n && map.has(chunk)) {
          out += map.get(chunk);
          i += n;
          hit = true;
          break;
        }
      }
      if (!hit) {
        out += src[i];
        i += 1;
      }
    }
    return out;
  };
}
