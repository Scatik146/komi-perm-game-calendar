import { makeTransliterator } from './engine/anbur.js';
import {
  numberSign, eightSign, monthSign, printDigit, printEight, printMonth,
  dateSigns, dateDigits, yearSigns, octalDigits, octalSigns, oldParts, oldSigns, moneyParts, COINS, MONEY_MAX, textNumbers,
} from './engine/pasy.js';
import {
  calendarAt, dateOfDay, yearStart, monthLengths, isoOfDay,
} from './engine/kalendar.js';
import { DAY_MS } from './engine/sun.js';

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
const NUM_MODES = ['keep', 'signs', 'octal'];
let numMode = store.get('anbur-numtext');
if (!NUM_MODES.includes(numMode)) numMode = store.get('anbur-digits') === 'off' ? 'keep' : 'signs';
let pstyle = store.get('anbur-pstyle') === 'parade' ? 'parade' : 'print';
let K = null;   // названия календаря: data/kalendar.json

/** Текст анбуром; цифры — по выбранному правилу (знаками как есть или переводом в новый счёт). */
function write(text) {
  return textNumbers(tr(text, lang), numMode);
}

function render() {
  const text = $('src').value;
  const out = write(text);
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

/* ---------- знаки-пасы ---------- */

function pasKey(sign, caption, aria) {
  const b = key(caption, { cls: 'pas-key', aria, onPress: () => insert(sign) });
  const g = document.createElement('span');
  g.className = 'k-pas pas';
  g.textContent = sign;
  g.setAttribute('aria-hidden', 'true');
  b.prepend(g);
  return b;
}

const SIGN = {
  print: { day: printDigit, week: printEight, month: printMonth },
  parade: { day: numberSign, week: eightSign, month: monthSign },
};

function buildPasKeyboard() {
  const kbd = $('pas-kbd');
  kbd.replaceChildren();
  const s = SIGN[pstyle];
  const digits = pstyle === 'print'
    ? [pasKey(printDigit(0), '0', 'Ноль, новый счёт'), ...K.numbers.map((x) => pasKey(s.day(x.n), String(x.n), `${x.n}, ${x.kp}`))]
    : K.numbers.map((x) => pasKey(s.day(x.n), String(x.n), `${x.n}, ${x.kp}`));
  const rows = [
    digits,
    K.weeks.map((x) => pasKey(s.week(x.n), String(x.value), `Восьмёрка ${x.value}, неделя ${x.kp}`)),
    K.months.map((x) => pasKey(s.month(x.n), `${x.kp}\n${57 * x.n}`, `Месяц ${x.kp}, число ${57 * x.n}`)),
  ];
  for (const keys of rows) {
    const r = document.createElement('div');
    r.className = 'kbd-row';
    r.append(...keys);
    kbd.append(r);
  }
}

const opt = (sel, items) => items.forEach(([v, t]) => {
  const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o);
});

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

/* ---------- режим «Дата» ---------- */

let year = null;   // номер года для выбранной даты

function setDateFromDay(k) {
  const d = dateOfDay(k);
  year = d.yearNumber;
  $('d-month').value = d.month; $('d-week').value = d.week; $('d-day').value = d.day;
  $('d-greg').value = isoOfDay(k).padStart(10, '0');
  showDate();
}

/** Выбранная дата; null, если такого дня в месяце нет. */
function pickedDate() {
  const d = { month: +$('d-month').value, week: +$('d-week').value, day: +$('d-day').value };
  const dom = (d.week - 1) * 8 + d.day;
  const len = monthLengths(year)[d.month - 1];
  return { ...d, dom, len, ok: dom <= len };
}

/** Дата для текста: обычная (печатные знаки) или парадная (резы в ромбе). */
function dateText(d) {
  const mode = document.querySelector('input[name="dmode"]:checked').value;
  const st = document.querySelector('input[name="dstyle"]:checked').value;
  let s = mode === 'sets' ? dateSigns(d, st) : dateDigits(d, st);
  if ($('d-year').checked) s += ` ${yearSigns(dateOfDay(yearStart(year)), st)}`;
  return s;
}

/* ---------- дата резами: плашка ---------- */

let PASY = null;   // знаки: data/pasy.json (резы в ромбе)

/** Резы одного парадного знака в клетке 100×100 со сдвигом (x, y); разметка — круг и ромб 4×4. */
function cellSvg(id, x, y, guides) {
  const s = PASY[id];
  let g = '';
  if (guides) {
    const R = 44, C = 50;
    const pt = (u, v) => [C + R * (u - v) / 4, C - R + R * (u + v) / 4];
    g += `<circle cx="50" cy="50" r="47" class="pl-mark"/>`;
    for (let i = 0; i <= 4; i++) {
      const [a, b] = [pt(i, 0), pt(i, 4)];
      const [c, e] = [pt(0, i), pt(4, i)];
      g += `<path class="pl-mark" d="M${a}L${b}M${c}L${e}"/>`;
    }
  }
  const cuts = s.lines.map((l) => `M${l.p.map((q) => q.join(' ')).join('L')}`).join('');
  return `<g transform="translate(${x} ${y})">${g}<path class="pl-cut" d="${cuts}"/><path class="pl-groove" d="${cuts}"/></g>`;
}

/** Плашка: дата тремя знаками (или числами по местам), ниже — год, если выбран. */
function plankSvg(d) {
  const mode = document.querySelector('input[name="dmode"]:checked').value;
  const guides = $('d-guides').checked;
  const rows = [mode === 'sets' ? [`m${d.month}`, `w${d.week}`, `n${d.day}`] : [d.month, d.week, d.day].map((n) => `n${n}`)];
  if ($('d-year').checked) {
    const y = dateOfDay(yearStart(year));
    rows.push([y.era, y.circle, y.octave, y.year].map((n) => `n${n}`));
  }
  const cell = 100, gap = 18, pad = 28;
  const w = Math.max(...rows.map((r) => r.length)) * (cell + gap) - gap + pad * 2;
  const h = rows.length * (cell + gap) - gap + pad * 2;
  let body = '';
  rows.forEach((r, j) => {
    const x0 = (w - (r.length * (cell + gap) - gap)) / 2;
    r.forEach((id, i) => { body += cellSvg(id, x0 + i * (cell + gap), pad + j * (cell + gap), guides); });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" role="img" aria-label="Дата резами на плашке">`
    + '<style>.pl-cut{fill:none;stroke:#4b2e1a;stroke-width:6;stroke-linecap:square;stroke-linejoin:miter}'
    + '.pl-groove{fill:none;stroke:#86552f;stroke-width:1.6;stroke-linecap:square}'
    + '.pl-mark{fill:none;stroke:#b08a5e;stroke-width:0.6}</style>'
    + `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="10" fill="#dcbf8f" stroke="#8b5e34" stroke-width="4"/>`
    + `${body}</svg>`;
}

function savePlank(kind) {
  const d = pickedDate();
  if (!d.ok) return;
  const svg = plankSvg(d);
  const name = `plashka-${d.month}-${d.week}-${d.day}`;
  if (kind === 'svg') { download(`${name}.svg`, new Blob([svg], { type: 'image/svg+xml' })); return; }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width * 2; c.height = img.height * 2;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => b && download(`${name}.png`, b), 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function showDate() {
  const d = pickedDate();
  const m = K.months[d.month - 1];
  if (!d.ok) {
    $('d-ru').textContent = `В месяце ${m.kp} (${m.ru}) в этом году ${d.len} ${plural(d.len, 'день', 'дня', 'дней')} — такого дня нет.`;
    $('d-signs').textContent = '';
    $('d-plank').innerHTML = '';
    $('d-insert').disabled = true;
    $('d-greg').value = '';
    return;
  }
  $('d-insert').disabled = false;
  const y = dateOfDay(yearStart(year));
  const yr = $('d-year').checked ? `; год ${year} — ${y.era}·${y.circle}·${y.octave}·${y.year}` : '';
  $('d-ru').textContent = `${m.ru}, ${K.weeks[d.week - 1].ord} неделя, ${K.numbers[d.day - 1].ru} день `
    + `(${m.kp} · ${K.weeks[d.week - 1].kp} · ${K.numbers[d.day - 1].kp})${yr}`;
  $('d-signs').textContent = dateText(d);
  $('d-plank').innerHTML = plankSvg(d);
  const k = yearStart(year) + monthLengths(year).slice(0, d.month - 1).reduce((a, b) => a + b, 0) + d.dom - 1;
  $('d-greg').value = isoOfDay(k).padStart(10, '0');
}

function fillDateForm() {
  opt($('d-month'), K.months.map((x) => [x.n, `${x.n} — ${x.kp}, ${x.animal}`]));
  opt($('d-week'), K.weeks.map((x) => [x.n, `${x.n} — ${x.kp} (${x.value})`]));
  opt($('d-day'), K.numbers.map((x) => [x.n, `${x.n} — ${x.kp}`]));
  const today = () => {
    const kud = { lat: 59.01, lon: 54.66 };
    setDateFromDay(calendarAt(Date.now(), kud).dayNumber);
  };
  today();
  $('d-today').addEventListener('click', today);
  $('d-greg').addEventListener('change', () => {
    const v = $('d-greg').value;
    if (!v) return;
    const [y, m, dd] = v.split('-').map(Number);
    const t = new Date(0);
    t.setUTCFullYear(y, m - 1, dd);
    setDateFromDay(Math.floor(t.getTime() / DAY_MS));
  });
  for (const id of ['d-month', 'd-week', 'd-day', 'd-year', 'd-guides']) $(id).addEventListener('change', showDate);
  $('d-plank-svg').addEventListener('click', () => savePlank('svg'));
  $('d-plank-png').addEventListener('click', () => savePlank('png'));
  document.querySelectorAll('input[name="dmode"]').forEach((r) => r.addEventListener('change', showDate));
  const ds = store.get('anbur-dstyle') === 'parade' ? 'parade' : 'print';
  document.querySelectorAll('input[name="dstyle"]').forEach((r) => {
    r.checked = r.value === ds;
    r.addEventListener('change', () => { store.set('anbur-dstyle', r.value); showDate(); });
  });
  showDate();
  $('d-insert').addEventListener('click', () => { if (pickedDate().ok) insert(dateText(pickedDate())); });
}

/* ---------- режим «Новый счёт» ---------- */

function readInt(id, min, max) {
  const v = Number($(id).value);
  return Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function showNew() {
  const n = readInt('n-in', 0, 16777215);
  if (n === null) { $('n-ru').textContent = 'Введите целое число от 0.'; $('n-signs').textContent = ''; return; }
  const ds = octalDigits(n);
  const terms = ds.map((d, i) => {
    const p = 8 ** (ds.length - 1 - i);
    return p === 1 ? `${d}` : `${d} · ${p}`;
  });
  $('n-ru').textContent = `${n} = ${terms.join(' + ')} — по восьми: ${ds.join('')}`;
  $('n-signs').textContent = octalSigns(n);
}

/* ---------- режим «Старый счёт, деньги» ---------- */

function oldWords(v) {
  const p = oldParts(v);
  const parts = [];
  if (p.month) parts.push(`${K.months[p.month - 1].kp} (${57 * p.month})`);
  if (p.week) parts.push(`${K.weeks[p.week - 1].kp} (${8 * p.week})`);
  if (p.day) parts.push(`${p.day}`);
  return parts.join(' + ');
}

const RU_COIN = {
  niz: ['низь', 'низи', 'низей'],
  ruch: ['руч', 'руча', 'ручей'],
  ur: ['ур', 'ура', 'уров'],
};

/** Сумма для текста: каждая часть — старым числом и названием монеты анбуром (пустые части пропускаются). */
function moneyText(total, preview = false) {
  const p = moneyParts(total);
  const word = (c) => (preview ? tr(c.kp, lang) : c.kp);   // в поле ввода — кириллицей, анбуром станет в надписи
  return COINS.filter((c) => p[c.id]).map((c) => `${oldSigns(p[c.id], pstyle)} ${word(c)}`).join(' ');
}

function showOld() {
  const n = readInt('o-in', 1, MONEY_MAX);
  if (n === null) { $('o-ru').textContent = `Введите сумму от 1 до ${MONEY_MAX.toLocaleString('ru')} уров.`; $('o-signs').textContent = ''; return; }
  const p = moneyParts(n);
  const say = (v, id) => `${v} ${plural(v, ...RU_COIN[id])}`;
  const eq = (v) => (oldWords(v) === String(v) ? '' : ` (${oldWords(v)})`);
  const parts = COINS.filter((c) => p[c.id]).map((c) => `${say(p[c.id], c.id)}${eq(p[c.id])}`);
  $('o-ru').textContent = `${say(n, 'ur')} = ${parts.join(', ')}`;
  $('o-signs').textContent = moneyText(n, true);
}

/* ---------- вкладки ---------- */

const TABS = { date: 'm-date', new: 'm-new', old: 'm-old' };

function openTab(name) {
  for (const [t, panel] of Object.entries(TABS)) {
    $(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(panel).hidden = t !== name;
  }
  store.set('anbur-tab', name);
}

function fillModes() {
  fillDateForm();
  $('n-in').addEventListener('input', showNew);
  $('n-insert').addEventListener('click', () => { const n = readInt('n-in', 0, 16777215); if (n !== null) insert(octalSigns(n)); });
  $('o-in').addEventListener('input', showOld);
  $('o-insert').addEventListener('click', () => { const n = readInt('o-in', 1, MONEY_MAX); if (n !== null) insert(moneyText(n)); });
  for (const t of Object.keys(TABS)) $(`tab-${t}`).addEventListener('click', () => openTab(t));
  openTab(TABS[store.get('anbur-tab')] ? store.get('anbur-tab') : 'date');
  showNew();
  showOld();
}

function setStyle(s) {
  pstyle = s;
  store.set('anbur-pstyle', s);
  buildPasKeyboard();
  showDate();
  showOld();
}

/* ---------- сохранение ---------- */

async function fontDataUrl(file = 'fonts/NotoSansOldPermic-Regular.ttf') {
  try {
    const res = await fetch(file);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:font/ttf;base64,${btoa(bin)}`;
  } catch { return null; }
}

function lines() {
  return write($('src').value).split('\n');
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
  await document.fonts.load('64px "Pasy"', numberSign(1) + printDigit(1));
  const size = 96;
  const pad = size * 0.6;
  const ls = lines();
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${size}px "Anbur", "Pasy"`;
  const w = Math.max(...ls.map((l) => ctx.measureText(l).width), size);
  c.width = Math.ceil(w + pad * 2);
  c.height = Math.ceil(ls.length * size * 1.35 + pad * 2);
  ctx.fillStyle = '#f4ead8';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#2b2221';
  ctx.font = `${size}px "Anbur", "Pasy"`;
  ctx.textBaseline = 'top';
  ls.forEach((l, i) => ctx.fillText(l, pad, pad + i * size * 1.35));
  c.toBlob((b) => b && download('anbur.png', b), 'image/png');
  $('msg').textContent = 'Картинка сохранена.';
}

async function saveSvg() {
  const font = await fontDataUrl();
  const pas = await fontDataUrl('fonts/Pasy.ttf');
  const size = 72;
  const ls = lines();
  const h = ls.length * size * 1.35 + size;
  const w = Math.max(...ls.map((l) => [...l].length), 1) * size * 0.75 + size;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const face = (font ? `@font-face{font-family:"Anbur";src:url(${font}) format("truetype");}` : '')
    + (pas ? `@font-face{font-family:"Pasy";src:url(${pas}) format("truetype");}` : '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">`
    + `<style>${face}text{font-family:"Anbur","Pasy","Noto Sans Old Permic";font-size:${size}px;fill:#2b2221}</style>`
    + ls.map((l, i) => `<text x="${size / 2}" y="${size * 1.1 + i * size * 1.35}">${esc(l)}</text>`).join('')
    + '</svg>';
  download('anbur.svg', new Blob([svg], { type: 'image/svg+xml' }));
  $('msg').textContent = font ? 'SVG сохранён, шрифт встроен в файл.' : 'SVG сохранён. Для показа нужен шрифт Noto Sans Old Permic.';
}

async function copy() {
  try {
    await navigator.clipboard.writeText(write($('src').value));
    $('msg').textContent = 'Надпись скопирована. Чтобы её увидеть в другом месте, там нужен шрифт с анбуром, например Noto Sans Old Permic, а для знаков-пасов — шрифт Pasy с этого сайта.';
  } catch {
    $('msg').textContent = 'Не удалось скопировать. Выделите надпись и скопируйте вручную.';
  }
}

async function start() {
  try {
    let pasy;
    [table, K, pasy] = await Promise.all([
      fetch('data/anbur.json').then((r) => r.json()),
      fetch('data/kalendar.json').then((r) => r.json()),
      fetch('data/pasy.json').then((r) => r.json()),
    ]);
    PASY = Object.fromEntries(pasy.signs.filter((s) => s.set === 'parade').map((s) => [s.id, s]));
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
  $('numtext').value = numMode;
  $('numtext').addEventListener('change', () => {
    numMode = $('numtext').value;
    store.set('anbur-numtext', numMode);
    render();
  });
  document.querySelectorAll('input[name="pstyle"]').forEach((r) => {
    r.checked = r.value === pstyle;
    r.addEventListener('change', () => setStyle(r.value));
  });
  buildPasKeyboard();
  fillModes();
  $('copy').addEventListener('click', copy);
  $('png').addEventListener('click', savePng);
  $('svg').addEventListener('click', saveSvg);
  buildKeyboard();
  buildTable();
  render();
}

start();
