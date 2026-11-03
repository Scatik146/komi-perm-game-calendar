import { makeTransliterator } from './engine/anbur.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* недоступно */ } },
};

const ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ё'],
];
const EXTRA = ['ӧ', 'і', 'дж', 'дз'];
const BASIS = { stefan: 'стефановская', late: 'поздняя', convention: 'условная' };

let table = null;
let tr = null;
let lang = store.get('anbur-lang') === 'ru' ? 'ru' : 'kp';

function render() {
  const text = $('src').value;
  const out = tr(text, lang);
  $('out').textContent = out || ' ';
  $('out-src').textContent = text;
  store.set('anbur-text', text);
}

function glyphFor(cyr) {
  return tr(cyr, lang);
}

function insert(s) {
  const ta = $('src');
  const { selectionStart: a, selectionEnd: b, value } = ta;
  ta.value = value.slice(0, a) + s + value.slice(b);
  ta.selectionStart = ta.selectionEnd = a + s.length;
  ta.focus();
  render();
}

function backspace() {
  const ta = $('src');
  const { selectionStart: a, selectionEnd: b, value } = ta;
  if (a !== b) { ta.value = value.slice(0, a) + value.slice(b); ta.selectionStart = ta.selectionEnd = a; }
  else if (a > 0) { ta.value = value.slice(0, a - 1) + value.slice(a); ta.selectionStart = ta.selectionEnd = a - 1; }
  ta.focus();
  render();
}

function key(label, { anb = '', cls = '', onPress, aria }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `key ${cls}`.trim();
  b.setAttribute('aria-label', aria || label);
  const c = document.createElement('span');
  c.className = 'k-cyr';
  c.textContent = label;
  b.append(c);
  if (anb) {
    const g = document.createElement('span');
    g.className = 'k-anb anbur';
    g.textContent = anb;
    g.setAttribute('aria-hidden', 'true');
    b.append(g);
  }
  // mousedown не отбирает фокус у поля ввода
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', onPress);
  return b;
}

function buildKeyboard() {
  const kbd = $('kbd');
  kbd.replaceChildren();
  const rows = lang === 'kp' ? [EXTRA, ...ROWS] : ROWS;
  rows.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'kbd-row';
    for (const ch of row) {
      r.append(key(ch, { anb: glyphFor(ch), cls: EXTRA.includes(ch) ? 'extra' : '', onPress: () => insert(ch) }));
    }
    kbd.append(r);
  });
  const last = document.createElement('div');
  last.className = 'kbd-row';
  last.append(
    key('⌫', { cls: 'mid', aria: 'Стереть', onPress: backspace }),
    key('пробел', { cls: 'wide', onPress: () => insert(' ') }),
    key('·', { aria: 'Точка-разделитель', onPress: () => insert('·') }),
    key('↵', { cls: 'mid', aria: 'Новая строка', onPress: () => insert('\n') }),
  );
  kbd.append(last);
}

function buildTable() {
  const ol = $('table');
  ol.replaceChildren();
  for (const l of table.letters) {
    const li = document.createElement('li');
    li.className = l.basis;
    li.innerHTML = '<span class="g anbur"></span><span class="c"></span><span class="n"></span><span class="b"></span>';
    li.querySelector('.g').textContent = l.anbur;
    li.querySelector('.c').textContent = l.cyr;
    li.querySelector('.n').textContent = l.meaning ? `${l.name} — ${l.meaning}` : l.name;
    li.querySelector('.b').textContent = BASIS[l.basis] + (l.cyr === 'о' ? '; в русском — о' : '');
    if (l.note) li.title = l.note;
    ol.append(li);
  }
}

/* ---------- сохранение ---------- */

async function fontDataUrl() {
  try {
    const res = await fetch('fonts/NotoSansOldPermic-Regular.ttf');
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:font/ttf;base64,${btoa(bin)}`;
  } catch { return null; }
}

function lines() {
  return tr($('src').value, lang).split('\n');
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function savePng() {
  await document.fonts.load('64px "Anbur"', '𐍐');
  const size = 96;
  const pad = size * 0.6;
  const ls = lines();
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${size}px "Anbur"`;
  const w = Math.max(...ls.map((l) => ctx.measureText(l).width), size);
  c.width = Math.ceil(w + pad * 2);
  c.height = Math.ceil(ls.length * size * 1.35 + pad * 2);
  ctx.fillStyle = '#f4ead8';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#2b2221';
  ctx.font = `${size}px "Anbur"`;
  ctx.textBaseline = 'top';
  ls.forEach((l, i) => ctx.fillText(l, pad, pad + i * size * 1.35));
  c.toBlob((b) => b && download('anbur.png', b), 'image/png');
  $('msg').textContent = 'Картинка сохранена.';
}

async function saveSvg() {
  const font = await fontDataUrl();
  const size = 72;
  const ls = lines();
  const h = ls.length * size * 1.35 + size;
  const w = Math.max(...ls.map((l) => [...l].length), 1) * size * 0.75 + size;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const face = font ? `@font-face{font-family:"Anbur";src:url(${font}) format("truetype");}` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">`
    + `<style>${face}text{font-family:"Anbur","Noto Sans Old Permic";font-size:${size}px;fill:#2b2221}</style>`
    + ls.map((l, i) => `<text x="${size / 2}" y="${size * 1.1 + i * size * 1.35}">${esc(l)}</text>`).join('')
    + '</svg>';
  download('anbur.svg', new Blob([svg], { type: 'image/svg+xml' }));
  $('msg').textContent = font ? 'SVG сохранён, шрифт встроен в файл.' : 'SVG сохранён. Для показа нужен шрифт Noto Sans Old Permic.';
}

async function copy() {
  try {
    await navigator.clipboard.writeText(tr($('src').value, lang));
    $('msg').textContent = 'Надпись скопирована. Чтобы её увидеть в другом месте, там нужен шрифт с анбуром, например Noto Sans Old Permic.';
  } catch {
    $('msg').textContent = 'Не удалось скопировать. Выделите надпись и скопируйте вручную.';
  }
}

async function start() {
  try {
    table = await fetch('data/anbur.json').then((r) => r.json());
  } catch {
    $('msg').textContent = 'Не удалось загрузить таблицу букв. Обновите страницу.';
    return;
  }
  tr = makeTransliterator(table);
  const saved = store.get('anbur-text');
  if (saved !== null) $('src').value = saved;
  document.querySelectorAll('input[name="lang"]').forEach((r) => {
    r.checked = r.value === lang;
    r.addEventListener('change', () => {
      lang = r.value;
      store.set('anbur-lang', lang);
      buildKeyboard();
      render();
    });
  });
  $('src').addEventListener('input', render);
  $('copy').addEventListener('click', copy);
  $('png').addEventListener('click', savePng);
  $('svg').addEventListener('click', saveSvg);
  buildKeyboard();
  buildTable();
  render();
}

start();
