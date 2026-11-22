// Проверка: каждый знак, который сайт показывает, есть в одном из наших шрифтов (те, что подключены в CSS).
// Системными шрифтами сайт не пользуется. Запуск после сборки: node scripts/proverit-shrifty.mjs
// Нужен пакет fontkit (на GitHub ставится в pages.yml). Код выхода 1 — есть знаки без шрифта.
import fs from 'node:fs';
import path from 'node:path';
import * as fontkit from 'fontkit';

const ISTOCHNIKI = ['web', 'data'];
const RASSHIRENIYA = ['.html', '.js', '.json'];

// bezKommentariev: текст JS без комментариев — их на сайте не видно
function bezKommentariev(tekst, imya) {
  let itog = tekst;
  if (imya.endsWith('.js')) itog = tekst.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return itog;
}

// znakiSajta: все знаки страниц, скриптов и данных сайта (кроме служебных)
function znakiSajta() {
  const znaki = new Set();
  for (const papka of ISTOCHNIKI) {
    for (const imya of fs.readdirSync(papka).filter((f) => RASSHIRENIYA.includes(path.extname(f)))) {
      const tekst = bezKommentariev(fs.readFileSync(path.join(papka, imya), 'utf8'), imya);
      for (const z of tekst) if (z.codePointAt(0) > 0x7e) znaki.add(z.codePointAt(0));
    }
  }
  return znaki;
}

// shrifty: открытые файлы шрифтов, на которые ссылаются стили сайта
function shrifty() {
  const css = fs.readdirSync('web').filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join('web', f), 'utf8')).join('\n');
  const fajly = [...new Set(css.match(/fonts\/[\w.-]+\.(woff2|ttf)/g))];
  return fajly.map((f) => fontkit.openSync(path.join('_site', f)));
}

// bezShrifta: знаки, которых нет ни в одном шрифте (пробелы и невидимые не считаем)
function bezShrifta(znaki, spisok) {
  const nevidimye = (k) => k === 0xa0 || (k >= 0x2000 && k <= 0x200f) || k === 0xfeff || k === 0x2028;
  const net = [...znaki].filter((k) => !nevidimye(k) && !spisok.some((s) => s.hasGlyphForCodePoint(k)));
  return net;
}

const net = bezShrifta(znakiSajta(), shrifty());
for (const k of net) console.error(`Нет шрифта для U+${k.toString(16).toUpperCase().padStart(4, '0')} «${String.fromCodePoint(k)}»`);
console.log(net.length ? `знаков без шрифта: ${net.length}` : 'все знаки сайта есть в наших шрифтах');
process.exitCode = net.length ? 1 : 0;
