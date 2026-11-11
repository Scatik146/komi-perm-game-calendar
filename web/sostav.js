// «Составить календарь»: год, месяц, неделя, сутки — по «Солнечной восьмёрке»,
// православный (по гражданским месяцам с датой по старому стилю), мусульманский
// (по месяцам хиджры) и иудейский (по еврейским месяцам) календари.
// Восьмёрка, хиджра и еврейский календарь идут справа налево, сверху вниз.

import {
  DAY_MS, dateOfDay, yearStart, monthLengths, calendarDayAt, sunsetOf, rubezhiRange, QUARTER_OF_PART,
  orthodoxEvents, muslimEvents, jewishEvents, hijriOf, julianFromK, weekday,
  makeTransliterator, numberSign, eightSign, printDigit, printEight, dateSigns,
  hebrewFromK, kFromHebrew, hebrewMonthDays, hebrewMonthsOfYear, hebrewMonthName, HIJRI_MONTHS_RU,
} from './engine/index.js';
import { astroEvents } from './engine/nebo.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* хранилище недоступно */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

let K = null;        // data/kalendar.json
let NAMES = null;    // data/names.json
let PICS = null;     // data/kartinki.json (может отсутствовать)
let TR = null;       // транслитерация в анбур (data/anbur.json)
let places = [];
let place = null;
let anchor = null;   // номер дня, вокруг которого строится лист

const MONTH_IDS = ['ur', 'osh', 'dozmor', 'vormos', 'chuzhmor', 'yus', 'sir', 'koch'];
const RU_MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const RU_MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const RU_MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const RU_WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const RU_WD_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const ORD_RU = ['первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой'];
const KIND_RU = { orthodox: 'православные', muslim: 'мусульманские', jewish: 'иудейские', astro: 'небо', eclipse: 'затмения' };

/* ---------- состояние ---------- */

const state = {
  cal: 'v8', view: 'month', signs: 'words', script: 'ru',
  orth: false, musl: false, jew: false, astro: true, moon: true, kp: false, pics: true,
};

const DEFAULT_LAYERS = {
  v8: { orth: false, musl: false, jew: false },
  orth: { orth: true, musl: false, jew: false },
  komi: { orth: true, musl: false, jew: false },
  musl: { orth: false, musl: true, jew: false },
  jew: { orth: false, musl: false, jew: true },
};

function readControls() {
  state.cal = document.querySelector('input[name="cal"]:checked').value;
  state.view = document.querySelector('input[name="view"]:checked').value;
  state.signs = document.querySelector('input[name="signs"]:checked').value;
  state.script = document.querySelector('input[name="script"]:checked').value;
  state.kp = state.script !== 'ru';
  for (const id of ['orth', 'musl', 'jew', 'astro', 'moon', 'pics']) state[id] = $(`l-${id}`).checked;
}

function saveState() {
  store.set('sostav', JSON.stringify(state));
}

function restoreState() {
  try {
    const s = JSON.parse(store.get('sostav') || 'null');
    if (s) Object.assign(state, s);
    if (document.querySelector(`input[name="view"][value="${state.view}"]`)?.disabled) state.view = 'month'; // год, неделя и сутки — в работе
  } catch { /* старое или испорченное значение */ }
  document.querySelector(`input[name="cal"][value="${state.cal}"]`).checked = true;
  document.querySelector(`input[name="view"][value="${state.view}"]`).checked = true;
  const sg = document.querySelector(`input[name="signs"][value="${state.signs}"]`);
  if (sg) sg.checked = true;
  for (const id of ['orth', 'musl', 'jew', 'astro', 'moon', 'pics']) $(`l-${id}`).checked = !!state[id];
  const sc = document.querySelector(`input[name="script"][value="${state.script}"]`);
  if (sc) sc.checked = true;
  state.kp = state.script !== 'ru';
}

/* ---------- даты ---------- */

const gDate = (k) => new Date(k * DAY_MS);
const gDay = (k) => gDate(k).getUTCDate();
const gMonth = (k) => gDate(k).getUTCMonth();
const gYear = (k) => gDate(k).getUTCFullYear();
const kOf = (y, m, d) => Math.floor(Date.UTC(y, m, d) / DAY_MS);
const isoOf = (k) => gDate(k).toISOString().slice(0, 10);
const gText = (k) => `${gDay(k)} ${RU_MON_GEN[gMonth(k)]} ${gYear(k)}`;
const gShort = (k) => `${gDay(k)} ${RU_MON_GEN[gMonth(k)]}`;
const fmtSpan = (k0, k1) => (gYear(k0) === gYear(k1) ? `${gShort(k0)} – ${gText(k1)}` : `${gText(k0)} – ${gText(k1)}`);
const civilTime = (ms) => new Intl.DateTimeFormat('ru-RU', { timeZone: place.tz || deviceTz, hour: '2-digit', minute: '2-digit' }).format(ms);

const nb = (s) => s.replace(/-/g, '\u2011');
function hijriLabel(h) {
  return `${h.day} ${HIJRI_MONTHS_RU[h.month - 1]} ${h.year}`;
}
function hebrewLabel(h) {
  return `${h.day} ${hebrewMonthName(h.year, h.month)} ${h.year}`;
}
function julianLabel(j) {
  return `${j.day} ${RU_MON_GEN[j.month - 1]} ${j.year}`;
}

function todayK() {
  return calendarDayAt(Date.now(), place).k;
}

/* ---------- названия «Солнечной восьмёрки» ---------- */

/* ---------- надписи: русский, коми-пермяцкий, анбур ---------- */

/** «Только анбуром» или «только по-коми-пермяцки»: русской расшифровки названий нет. */
const anbOnly = () => (state.script === 'anb' && TR) || state.script === 'kpo';
/** Надпись анбуром: коми-пермяцкое слово (kp) или русское (ru) — своим набором букв. */
const A = (s, lang = 'kp') => (TR && state.script !== 'kpo' ? `<span class="anbur">${esc(TR(String(s), lang))}</span>` : esc(s));
/** Вторая строка с коми-пермяцким словом: кириллицей или анбуром. */
const KP = (s) => (state.script === 'ranb' || state.script === 'anb' ? A(s) : esc(s));
/** Главная надпись: по-русски, а в режиме «только анбуром» — коми-пермяцкое слово анбуром (нет — русское). */
const NAME = (ru, kp) => (anbOnly() ? (kp ? A(kp) : A(ru, 'ru')) : esc(ru));
/** Свободный русский текст: в режиме «только анбуром» — русским набором анбура. */
const RU = (s) => (state.script === 'anb' && TR ? A(s, 'ru') : esc(s));
/** Коми-пермяцкое слово в режимах «только по-коми-пермяцки» и «только анбуром». */
const W = (kp) => A(kp);
/** Вторая строка с коми-пермяцким словом — если нужна. */
const SEC = (kp) => (state.kp && !anbOnly() && kp ? KP(kp) : '');

/** Знак дня (1–8) и недели (1–6): печатный или парадный. */
const daySign = (n) => (state.signs === 'print' ? printDigit(n) : numberSign(n));
const weekSign = (w) => (state.signs === 'print' ? printEight(w) : eightSign(w));
const useSigns = () => state.signs !== 'words';

const v8Month = (m) => K.months[m - 1];
const v8Week = (w) => K.weeks[w - 1];
const v8Num = (n) => K.numbers[n - 1];

function v8MonthTitle(m) {
  const x = v8Month(m);
  return { main: x.ru, kp: x.kp };
}
function v8YearLine(n) {
  const d = dateOfDay(yearStart(n));
  const era = K.eras.find((e) => e.n === d.era);
  const circle = K.circles[d.circle - 1];
  const oct = K.octaves[d.octave - 1];
  const yr = v8Num(d.year);
  const base = `${n}-й год: эра ${era ? era.ru : '—'}, круг ${circle.ru}, ${oct.ru} октава, год ${ORD_RU[d.year - 1]}`;
  const kp = `${circle.kp}, ${oct.kp}, ${yr.kp}`;
  // без русской расшифровки: что есть по-коми-пермяцки — по-коми-пермяцки (эр — нет), цифры не трогаем
  if (anbOnly()) return `${RU(`${n}, эра ${era ? era.ru : '—'}`)}, ${W(circle.kp)}, ${W(oct.kp)}, ${W(yr.kp)}`;
  return state.kp ? `${base} <span class="muted">(${KP(kp)})</span>` : base;
}

/* ---------- события ---------- */

/** Шаббат — каждую субботу (от заката пятницы до заката субботы). */
function shabbatEvents(k0, k1) {
  const out = [];
  for (let k = k0; k <= k1; k++) if (weekday(k) === 6) out.push({ k, id: 'shabbat', kind: 'jewish', ru: 'Шаббат', minor: true });
  return out;
}

function collectEvents(k0, k1) {
  // праздники берём на день дальше: праздник следующего дня начинается на закате последнего
  const faith = [];
  const komi = state.cal === 'komi';
  if (state.orth) faith.push(...orthodoxEvents(k0, k1 + 1).filter((e) => !komi || e.kp).map((e) => (komi ? { ...e, ru: e.kp } : e)));
  if (state.musl) faith.push(...muslimEvents(k0, k1 + 1));
  // шаббат отмечаем только в чистом иудейском календаре: на общих листах он перегружает сетку
  if (state.jew) faith.push(...jewishEvents(k0, k1 + 1), ...(state.cal === 'jew' ? shabbatEvents(k0, k1 + 1) : []));
  const list = faith.filter((e) => e.k <= k1 && !e.minor);
  if (state.astro || state.moon) {
    for (const e of astroEvents(k0, k1, place, { phases: state.moon })) {
      if (e.kind === 'moon' ? state.moon : state.astro) list.push(e);
    }
  }
  const byDay = new Map();
  for (const e of list) {
    if (!byDay.has(e.k)) byDay.set(e.k, []);
    byDay.get(e.k).push(e);
  }
  return { list, byDay, segs: buildSegs(faith, k0, k1) };
}

/* ---------- праздник от заката до заката ---------- */

const sunsetFracCache = new Map();
/** Доля гражданских суток дня k, когда в выбранном месте заходит Солнце (0…1). */
function sunsetFrac(k) {
  const key = `${place.lat},${place.lon},${k}`;
  if (sunsetFracCache.has(key)) return sunsetFracCache.get(key);
  let f = 0.75;
  const t = sunsetOf(k, place);
  if (t !== null) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: place.tz || deviceTz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(t).map((x) => [x.type, x.value]));
    f = (Number(p.hour) * 60 + Number(p.minute)) / 1440;
  }
  sunsetFracCache.set(key, f);
  return f;
}

const KIND_ORDER = { orthodox: 0, muslim: 1, jewish: 2 };

/**
 * Отрезки праздников по клеткам (гражданским суткам): праздник дней [a, b] длится
 * от заката дня a−1 до заката дня b. Клетка получает {kind, id, from, to, start, end}.
 */
function buildSegs(faith, k0, k1) {
  const c0 = k0 - 7;
  const c1 = k1 + 7;
  const segs = new Map();
  const seen = new Set();
  const evs = [];
  for (const e of faith) {
    const a = e.span ? e.span[0] : e.k;
    const b = e.span ? e.span[1] : e.k;
    const key = `${e.id}:${a}`;
    if (seen.has(key) || b < k0 || a > k1) continue; // только праздники этого листа
    seen.add(key);
    evs.push({ e, a, b, key });
  }
  // дорожки: длинные праздники — ниже, у каждого праздника своя дорожка на всём протяжении
  evs.sort((x, y) => (y.b - y.a) - (x.b - x.a) || x.a - y.a || KIND_ORDER[x.e.kind] - KIND_ORDER[y.e.kind]);
  const lanes = [];
  evs.forEach((x) => {
    let lane = lanes.findIndex((busy) => busy.every(([p, q]) => x.b < p - 1 || x.a - 1 > q));
    if (lane < 0) { lanes.push([]); lane = lanes.length - 1; }
    lanes[lane].push([x.a, x.b]);
    x.lane = lane;
  });
  evs.forEach(({ e, a, b, key, lane }) => {
    const row = lane;
    for (let c = Math.max(a - 1, c0); c <= Math.min(b, c1); c++) {
      const start = c === a - 1;
      const end = c === b;
      const from = start ? sunsetFrac(c) : 0;
      const to = end ? sunsetFrac(c) : 1;
      if (!segs.has(c)) segs.set(c, []);
      segs.get(c).push({ kind: e.kind, id: key, from, to, start, end, row });
    }
  });
  return segs;
}

/** Полосы праздников и пунктир закатов в клетке. */
function segsHtml(k, segMap) {
  const list = (segMap && segMap.get(k)) || [];
  if (!list.length) return '';
  return list.map((x) => {
    const r = x.row;
    const pos = (v) => `${(v * 100).toFixed(2)}%`;
    let h = `<i class="seg ${x.kind}" style="--from:${pos(x.from)};--w:${pos(x.to - x.from)};--row:${r}"></i>`;
    if (x.start) h += `<i class="vl ${x.kind}" style="--at:${pos(x.from)}" title="закат: начало праздника"></i>`;
    if (x.end) h += `<i class="vl ${x.kind}" style="--at:${pos(x.to)}" title="закат: конец праздника"></i>`;
    return h;
  }).join('');
}

const label = (e) => e.ru;
/** Русское название первым; коми-пермяцкое — рядом, если включено. */
const labelHtml = (e) => (anbOnly() ? NAME(e.ru, e.kp) : `${esc(e.ru)}${state.kp && e.kp && e.kp !== e.ru ? ` <span class="kpn">${KP(e.kp)}</span>` : ''}`);
let sheetRange = null; // границы текущего листа: полоса на весь лист не нужна

const MOON_SVG = {
  novolunie: '<circle cx="6" cy="6" r="4.6" fill="currentColor"/>',
  'pervaya-chetvert': '<circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 1.4a4.6 4.6 0 0 1 0 9.2z" fill="currentColor"/>',
  polnolunie: '<circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  'poslednyaya-chetvert': '<circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 1.4a4.6 4.6 0 0 0 0 9.2z" fill="currentColor"/>',
};
const moonIcon = (id) => `<svg class="moon-i" viewBox="0 0 12 12" aria-hidden="true" style="color:var(--c-moon)">${MOON_SVG[id] || ''}</svg>`;

const FAITH = new Set(['orthodox', 'muslim', 'jewish']);

function evHtml(e, withNote, inGrid = false) {
  const title = [e.ru, e.kp && e.kp !== e.ru ? e.kp : '', FAITH.has(e.kind) ? 'начинается на закате накануне' : '', e.note || ''].filter(Boolean).join(' · ');
  // в сетке месяца срок праздника виден по полосе и пунктиру — подпись «до …» не нужна
  const span = e.span && !e.cont && !inGrid ? ` <span class="note">до ${gShort(e.span[1])}</span>` : '';
  const note = withNote && e.note ? ` <span class="note">${esc(e.note)}</span>` : '';
  // как в календаре автора: праздник вынесен на часть суток назад — начинается на закате накануне
  const eve = e.minor ? ' minor' : '';
  return `<div class="ev ${e.kind}${eve}" title="${esc(title)}">${labelHtml(e)}${span}${note}</div>`;
}

function cellExtras(evs, withNote, inGrid = false) {
  const main = evs.filter((e) => !e.cont && e.kind !== 'moon');
  const whole = (e) => sheetRange && e.span && e.span[0] <= sheetRange.k0 && e.span[1] >= sheetRange.k1;
  const bands = [...new Set(evs.filter((e) => e.span && !whole(e) && !FAITH.has(e.kind)).map((e) => e.kind))];
  const moon = evs.find((e) => e.kind === 'moon');
  return {
    html: main.map((e) => evHtml(e, withNote, inGrid)).join(''),
    bands: bands.length ? `<div class="bands">${bands.map((b) => `<i class="band ${b}"></i>`).join('')}</div>` : '',
    moon: moon ? `<span class="moon" title="${esc(moon.ru)} ${civilTime(moon.t)}">${moonIcon(moon.id)}</span>` : '',
    moonEv: moon,
    dots: [...new Set(evs.filter((e) => !e.cont && e.kind !== 'moon').map((e) => e.kind))],
  };
}

function wdClass(k) {
  const w = weekday(k);
  return w === 5 ? 'fri' : w === 6 ? 'sat' : w === 0 ? 'sun' : '';
}

/** Мелкие подписи дня: хиджра, еврейская дата, старый стиль. */
function subDates(k, { musl, jew, jul }) {
  const out = [];
  if (musl) {
    const h = hijriOf(k);
    out.push(`<span class="h" title="По хиджре: ${esc(hijriLabel(h))}" style="color:var(--c-musl)">${h.day}</span>`);
  }
  if (jew) {
    const h = hebrewFromK(k);
    out.push(`<span title="По еврейскому календарю: ${esc(hebrewLabel(h))}" style="color:var(--c-jew)">${h.day}</span>`);
  }
  if (jul) {
    const j = julianFromK(k);
    out.push(`<span title="По старому стилю: ${esc(julianLabel(j))}" style="color:var(--c-orth)">${j.day}</span>`);
  }
  return out.join('');
}

/* ---------- ячейка и сетка месяца ---------- */

function dayCell(k, evMap, opts) {
  const evs = evMap.get(k) || [];
  const x = cellExtras(evs, false, true);
  const showMon = gDay(k) === 1 || opts.first;
  const g = `${gDay(k)}${showMon ? `<small>${RU(RU_MON_SHORT[gMonth(k)])}</small>` : ''}`;
  const cls = ['cell', wdClass(k), k === opts.today ? 'today' : '', opts.rowStart ? 'row-start' : ''].join(' ');
  if (opts.compact) {
    return `<div class="${cls}" title="${esc(gText(k))}${evs.filter((e) => !e.cont && e.kind !== 'moon').map((e) => ' · ' + label(e)).join('')}">`
      + `<span class="g">${opts.mainNum ? opts.mainNum(k) : gDay(k)}</span>`
      + (x.dots.length ? `<span class="dot">${x.dots.map((d) => `<i class="${d}"></i>`).join('')}</span>` : '')
      + '</div>';
  }
  const top = opts.mainNum
    ? `<span class="g">${opts.mainNum(k)}</span><span class="wd">${gDay(k)} ${RU(RU_MON_SHORT[gMonth(k)])} · ${RU(RU_WD[weekday(k)])}</span>`
    : `<span class="g">${g}</span><span class="wd">${RU(RU_WD[weekday(k)])}</span>`;
  // праздники веры — внизу клетки, над своими полосами, в пределах своего пунктира
  const faith = opts.segs ? evs.filter((e) => !e.cont && !e.minor && FAITH.has(e.kind)) : [];
  const other = evs.filter((e) => !(faith.includes(e)) && !e.cont && e.kind !== 'moon');
  const segHere = (opts.segs && opts.segs.get(k)) || [];
  const lanes = segHere.length ? Math.max(...segHere.map((x) => x.row)) + 1 : 0;
  const labels = faith.map((e) => {
    const a = e.span ? e.span[0] : e.k;
    const b = e.span ? e.span[1] : e.k;
    const seg = segHere.find((x) => x.id === `${e.id}:${a}`);
    // ширина: от начала суток клетки до пунктира конца; многодневный — вдоль строки
    const rowLeft = (opts.ncols ?? 1) - 1 - (opts.col ?? 0);
    const lastHere = Math.min(b, k + rowLeft);
    const width = lastHere === k ? sunsetFrac(b) : 1; // подпись — в своей клетке, до пунктира конца
    return { e, lane: seg ? seg.row : 0, width };
  }).sort((p, q) => q.lane - p.lane);
  const evs2 = labels.length
    ? `<div class="evs" style="padding-bottom:calc(0.2rem + ${lanes} * 0.3rem)">${labels.map(({ e, width }) => `<div class="ev evl ${e.kind}" style="--lw:${(width * 100).toFixed(1)}%" title="${esc(e.ru)}">${labelHtml(e)}</div>`).join('')}</div>`
    : '';
  return `<div class="${cls}"><div class="top">${top}</div>`
    + `<div class="sub">${subDates(k, opts.sub)}</div>${other.map((e) => evHtml(e, false, true)).join('')}${evs2}${x.bands}${x.moon}${segsHtml(k, opts.segs)}</div>`;
}

/**
 * Сетка месяца. rows — массив строк; строка — {label?, days: [k|null]}.
 * heads — подписи колонок; rtl — справа налево.
 */
function gridHtml({ rows, heads, rtl, labelCol, evMap, opts }) {
  const cols = heads.length;
  const tpl = `${labelCol ? '6.4rem ' : ''}repeat(${cols}, minmax(0, 1fr))`;
  const compactTpl = `${labelCol ? '1.6rem ' : ''}repeat(${cols}, minmax(0, 1fr))`;
  let h = `<div class="grid${rtl ? ' rtl' : ''}" style="grid-template-columns:${opts.compact ? compactTpl : tpl}">`;
  if (labelCol) h += '<div class="gh"></div>';
  h += heads.map((x) => `<div class="gh">${x}</div>`).join('');
  let first = true;
  for (const r of rows) {
    if (labelCol) h += `<div class="wl">${r.label}</div>`;
    r.days.forEach((k, i) => {
      if (k === null) { h += '<div class="cell empty"></div>'; return; }
      if (typeof k === 'object') { h += `<div class="cell empty">${opts.compact ? '' : segsHtml(k.out, opts.segs)}</div>`; return; }
      h += dayCell(k, evMap, { ...opts, first, rowStart: i === 0, col: i, ncols: r.days.length });
      first = false;
    });
  }
  return h + '</div>';
}

/* ---------- Солнечная восьмёрка ---------- */

function v8MonthRange(n, m) {
  const L = monthLengths(n);
  const k0 = yearStart(n) + L.slice(0, m - 1).reduce((a, b) => a + b, 0);
  return { k0, k1: k0 + L[m - 1] - 1 };
}

function v8Heads(compact) {
  return K.numbers.map((x, i) => {
    const word = anbOnly() ? A(x.kp) : `${ORD_RU[i]}${state.kp ? `, ${KP(x.kp)}` : ''}`;
    if (useSigns()) return compact ? `<span class="pas sg">${daySign(i + 1)}</span>` : `<span class="pas sg" title="${ORD_RU[i]} день">${daySign(i + 1)}</span><small>${word}</small>`;
    if (compact) return String(i + 1);
    if (anbOnly()) return A(x.kp);
    return state.kp ? `${ORD_RU[i]}<small>${KP(x.kp)}</small>` : `${ORD_RU[i]}<small>день</small>`;
  });
}

function v8Rows(k0, k1, compact) {
  const rows = [];
  for (let w = 0; w * 8 <= k1 - k0; w++) {
    const days = [];
    for (let d = 0; d < 8; d++) {
      const k = k0 + w * 8 + d;
      days.push(k <= k1 ? k : { out: k });
    }
    const wk = v8Week(w + 1);
    const wword = anbOnly() ? A(wk.kp) : `${esc(cap(wk.ru))}${state.kp ? `, ${KP(wk.kp)}` : ''}`;
    const lab = useSigns() ? (compact ? `<span class="pas sg">${weekSign(w + 1)}</span>` : `<span class="pas sg" title="${esc(wk.ru)}">${weekSign(w + 1)}</span><small>${wword}</small>`)
      : compact ? String(w + 1)
      : anbOnly() ? A(wk.kp)
      : state.kp ? `${esc(cap(wk.ru))}<small>${KP(wk.kp)}</small>` : `${esc(cap(wk.ru))}<small>${wk.ord} неделя</small>`;
    rows.push({ label: lab, days });
  }
  return rows;
}

function districtOf(m) {
  const kp = v8Month(m).kp;
  return places.find((p) => p.totem && p.totem.kp === kp);
}

function v8Pictures(m) {
  const id = MONTH_IDS[m - 1];
  const dist = districtOf(m);
  const pm = PICS && PICS.months && PICS.months[id];
  const pp = dist && PICS && PICS.places && PICS.places[dist.id];
  const on = state.pics;
  return {
    pas: on ? `pasy/mesyac-${m}-${id}.svg` : null,
    zver: on && pm ? pm.zver : null,
    gerb: on && pp ? pp.gerb : null,
    dist,
  };
}

function focusStyle(x) {
  const f = x.focus || {};
  return `object-position:${f.x ?? 50}% ${f.y ?? 50}%;--fx:${f.x ?? 50}%;--fy:${f.y ?? 50}%;transform:scale(${f.scale ?? 1})`;
}

function creditsHtml(p) {
  const items = [];
  if (p.gerb && p.dist) items.push([`Герб: ${p.dist.district} район`, p.gerb]);
  if (!items.length) return '';
  const frag = (x) => (x.file.includes('/gerb-') ? '' : ', фрагмент');
  return `Викисклад: ${items.map(([what, x]) => `${esc(what)} — ${esc(x.author)}, ${esc(x.license)} («${esc(x.title)}»${frag(x)})`).join('; ')}.`;
}

/**
 * Строки других календарей для шапки: хиджра — своей строкой; еврейский и старый стиль — другой.
 * С какой и по какую дату; год у каждого конца, если годы разные.
 */
function otherCalLines(k0, k1, { musl, jew, jul }) {
  const span2 = (d0, y0, d1, y1) => (y0 === y1 ? `${d0} – ${d1} ${y0}` : `${d0} ${y0} – ${d1} ${y1}`);
  const lines = [];
  if (musl) {
    const a = hijriOf(k0); const b = hijriOf(k1);
    lines.push(`По хиджре: ${span2(`${a.day} ${HIJRI_MONTHS_RU[a.month - 1]}`, a.year, `${b.day} ${HIJRI_MONTHS_RU[b.month - 1]}`, b.year)}.`);
  }
  const line3 = [];
  if (jew) {
    const a = hebrewFromK(k0); const b = hebrewFromK(k1);
    line3.push(`По еврейскому календарю: ${span2(`${a.day} ${hebrewMonthName(a.year, a.month)}`, a.year, `${b.day} ${hebrewMonthName(b.year, b.month)}`, b.year)}.`);
  }
  if (jul) {
    const a = julianFromK(k0); const b = julianFromK(k1);
    line3.push(`По старому стилю: ${span2(`${a.day} ${RU_MON_GEN[a.month - 1]}`, a.year, `${b.day} ${RU_MON_GEN[b.month - 1]}`, b.year)}.`);
  }
  if (line3.length) lines.push(line3.join(' '));
  return lines;
}

/** Шапка листа месяца или недели «Солнечной восьмёрки». */
function v8Head(n, m, k0, k1, title, kpTitle, sub) {
  const p = v8Pictures(m);
  p.zverId = MONTH_IDS[m - 1];
  const x = v8Month(m);
  const dist = p.dist;
  const days = k1 - k0 + 1;
  // вторая строка — только другие календари; год у каждого конца, если годы разные
  const other = otherCalLines(k0, k1, { musl: state.musl, jew: state.jew, jul: state.orth });
  // в ромбе — пас месяца (решение автора: вместо фото зверя); справа — герб района
  const rhomb = p.pas
    ? `<div class="mh-rhomb" aria-hidden="true"><div class="mh-rhomb-in mh-rhomb-pas"><span class="mh-pas" role="img" aria-label="Пас месяца" style="--pas:url('${p.pas}')"></span></div></div>`
    : '';
  const signs = p.gerb ? `<img class="mh-gerb" src="${esc(p.gerb.file)}" alt="Герб: ${esc(dist.district)} район">` : '';
  return {
    html: `<header class="mh">
      ${state.pics ? rhomb : ''}
      <div class="mh-text">
        <h3 class="mh-name">${NAME(title, kpTitle)}</h3>
        ${SEC(kpTitle) ? `<p class="mh-kp">${SEC(kpTitle)}</p>` : ''}
        <p class="mh-dates">${anbOnly() ? `${RU(`${fmtSpan(k0, k1)},`)} ${days} ${W('лун')}${sub ? `. ${RU(sub)}` : ''}.` : RU(`${fmtSpan(k0, k1)}, ${days} ${plural(days, 'день', 'дня', 'дней')}${sub ? `. ${sub}` : ''}.`)} <span class="mh-year">${v8YearLine(n)}, ${anbOnly() ? W(K.seasons[x.season]) : RU(x.season)}.</span></p>
        ${other.map((o) => `<p class="mh-meta">${RU(o)}</p>`).join('')}
      </div>
      ${signs ? `<div class="mh-signs">${signs}</div>` : ''}
    </header>`,
    credits: creditsHtml(p),
  };
}

function v8MonthSheet(n, m, compact = false) {
  const { k0, k1 } = v8MonthRange(n, m);
  const ev = collectEvents(k0, k1);
  const opts = { today: todayK(), compact, segs: ev.segs, sub: { musl: state.musl, jew: state.jew, jul: state.orth } };
  const grid = gridHtml({ rows: v8Rows(k0, k1, compact), heads: v8Heads(compact), rtl: true, labelCol: true, evMap: ev.byDay, opts });
  const t = v8MonthTitle(m);
  if (compact) {
    const items = ev.list.filter((e) => !e.cont && !e.minor && e.kind !== 'moon').sort((a, b) => a.k - b.k);
    const pas = state.pics ? `<img class="ym-pas" src="pasy/mesyac-${m}-${MONTH_IDS[m - 1]}.svg" alt="">` : '';
    return `<div class="ym"><h4><span>${pas}${NAME(t.main, t.kp)}${SEC(t.kp) ? ` <em>${SEC(t.kp)}</em>` : ''}</span><small>${RU(`${gShort(k0)} – ${gShort(k1)}`)}</small></h4>${grid}`
      + `<ul class="ym-list">${items.map((e) => `<li class="ev ${e.kind}"><b>${gDay(e.k)}.${String(gMonth(e.k) + 1).padStart(2, '0')}</b> ${labelHtml(e)}</li>`).join('')}</ul></div>`;
  }
  const head = v8Head(n, m, k0, k1, t.main, t.kp);
  return `<article class="sheet">
    ${head.html}
    ${grid}
    ${legendHtml()}
    ${footHtml(head.credits)}
  </article>`;
}

function v8YearSheet(n) {
  const months = [];
  for (let m = 1; m <= 8; m++) months.push(v8MonthSheet(n, m, true));
  const k0 = yearStart(n);
  const k1 = yearStart(n + 1) - 1;
  return `<article class="sheet">
    <div class="sh-head"><div></div><div class="sh-title">
      <div class="t-main">${NAME('Солнечная восьмёрка', 'Шонді кыкьямыс')}${SEC('Шонді кыкьямыс') ? ` <span class="t-kp">${SEC('Шонді кыкьямыс')}</span>` : ''}</div>
      <div class="t-line">${v8YearLine(n)}</div>
      <div class="t-line2">${RU(`${fmtSpan(k0, k1)}, ${k1 - k0 + 1} дней; дни идут справа налево, недели — сверху вниз`)}</div>
    </div><div></div></div>
    <div class="year-grid">${months.join('')}</div>
    ${legendHtml()}
    ${footHtml()}
  </article>`;
}

function v8WeekRange(k) {
  const d = dateOfDay(k);
  const { k0, k1 } = v8MonthRange(d.yearNumber, d.month);
  const s = k0 + (d.week - 1) * 8;
  return { k0: s, k1: Math.min(s + 7, k1), d };
}

function dayColumn(k, evMap, today, opts) {
  const evs = evMap.get(k) || [];
  const x = cellExtras(evs, true);
  const set0 = sunsetOf(k - 1, place);
  const rows = [];
  rows.push(`<div class="line">${RU(RU_WD_LONG[weekday(k)])}</div>`);
  if (opts.v8) {
    const d = dateOfDay(k);
    rows.push(`<div class="line">${esc(v8Month(d.month).ru)} · ${esc(v8Week(d.week).ru)} · ${ORD_RU[d.day - 1]}${state.kp ? ` (${esc(v8Month(d.month).kp)} · ${esc(v8Week(d.week).kp)} · ${esc(v8Num(d.day).kp)})` : ''}</div>`);
  }
  if (opts.musl) { const h = hijriOf(k); rows.push(`<div class="line" style="color:var(--c-musl)">${h.day} ${RU(nb(HIJRI_MONTHS_RU[h.month - 1]))}</div>`); }
  if (opts.jew) { const h = hebrewFromK(k); rows.push(`<div class="line" style="color:var(--c-jew)">${h.day} ${RU(hebrewMonthName(h.year, h.month))}</div>`); }
  if (opts.jul) { const j = julianFromK(k); rows.push(`<div class="line" style="color:var(--c-orth)">${j.day} ${RU(`${RU_MON_SHORT[j.month - 1]}. ст. ст.`)}</div>`); }
  if (set0 !== null) rows.push(`<div class="line">${RU(`сутки с заката ${civilTime(set0)} накануне; закат ${civilTime(sunsetOf(k, place))}`)}</div>`);
  if (x.moonEv) rows.push(`<div class="line">${moonIcon(x.moonEv.id)} ${esc(x.moonEv.ru)} ${civilTime(x.moonEv.t)}</div>`);
  return `<div class="wday ${wdClass(k)}${k === today ? ' today' : ''}">
    <div class="wh">${opts.head}</div>
    <span class="g">${gDay(k)}</span><div class="line">${RU(RU_MON_GEN[gMonth(k)])}</div>
    ${rows.join('')}${x.html}${x.bands}</div>`;
}

function v8WeekSheet(k) {
  const { k0, k1, d } = v8WeekRange(k);
  const ev = collectEvents(k0, k1);
  const today = todayK();
  const cols = [];
  for (let kk = k0; kk <= k1; kk++) {
    const dd = dateOfDay(kk);
    const dw = anbOnly() ? A(v8Num(dd.day).kp) : `${ORD_RU[dd.day - 1]} день${state.kp ? `, ${KP(v8Num(dd.day).kp)}` : ''}`;
    const head = useSigns() ? `<span class="pas sg">${daySign(dd.day)}</span><small>${dw}</small>`
      : anbOnly() ? A(v8Num(dd.day).kp)
      : state.kp ? `${cap(ORD_RU[dd.day - 1])} день<small>${KP(v8Num(dd.day).kp)}</small>` : `${cap(ORD_RU[dd.day - 1])} день`;
    cols.push(dayColumn(kk, ev.byDay, today, { head, musl: state.musl, jew: state.jew, jul: state.orth }));
  }
  const wk = v8Week(d.week);
  const head = v8Head(d.yearNumber, d.month, k0, k1, `${v8Month(d.month).ru}: ${wk.ru}`, `${v8Month(d.month).kp}, ${wk.kp}`, `${cap(wk.ord)} неделя месяца`);
  return `<article class="sheet">
    ${head.html}
    <div class="week-grid rtl" style="grid-template-columns:repeat(${k1 - k0 + 1}, minmax(0,1fr))">${cols.join('')}</div>
    ${legendHtml()}${footHtml(head.credits)}
  </article>`;
}

/* ---------- православный (гражданские месяцы, старый стиль мелко) ---------- */

function gregMonthRange(y, m) {
  return { k0: kOf(y, m, 1), k1: kOf(y, m + 1, 1) - 1 };
}

function sevenRows(k0, k1, firstWd) {
  const rows = [];
  const off = (weekday(k0) - firstWd + 7) % 7;
  let row = [];
  for (let i = 0; i < off; i++) row.push({ out: k0 - off + i });
  for (let k = k0; k <= k1; k++) {
    row.push(k);
    if (row.length === 7) { rows.push({ days: row }); row = []; }
  }
  if (row.length) { let n = 1; while (row.length < 7) row.push({ out: k1 + n++ }); rows.push({ days: row }); }
  return rows;
}

const wdHeads = (first) => Array.from({ length: 7 }, (_, i) => RU_WD_LONG[(first + i) % 7]);
const wdHeadsShort = (first) => Array.from({ length: 7 }, (_, i) => RU_WD[(first + i) % 7]);

function pureMonth({ k0, k1, firstWd, rtl, title, line, compact, mainNum, sub, note = '', other = {} }) {
  const ev = collectEvents(k0, k1);
  const opts = { today: todayK(), compact, mainNum, sub, segs: ev.segs };
  const grid = gridHtml({ rows: sevenRows(k0, k1, firstWd), heads: compact ? wdHeadsShort(firstWd) : wdHeads(firstWd), rtl, labelCol: false, evMap: ev.byDay, opts });
  if (compact) {
    const items = ev.list.filter((e) => !e.cont && !e.minor && e.kind !== 'moon').sort((a, b) => a.k - b.k);
    return `<div class="ym"><h4><span>${RU(title)}</span><small>${RU(`${gShort(k0)} – ${gShort(k1)}`)}</small></h4>${grid}`
      + `<ul class="ym-list">${items.map((e) => `<li class="ev ${e.kind}"><b>${mainNum ? mainNum(e.k) : gDay(e.k)}</b> ${labelHtml(e)}</li>`).join('')}</ul></div>`;
  }
  const days = k1 - k0 + 1;
  const lines = otherCalLines(k0, k1, other);
  return `<article class="sheet">
    <header class="mh mh-pure"><div class="mh-text">
      <h3 class="mh-name">${RU(title)}</h3>
      <p class="mh-dates">${RU(`${fmtSpan(k0, k1)}, ${days} ${plural(days, 'день', 'дня', 'дней')}.`)}${note ? ` <span class="mh-year">${RU(note)}</span>` : ''}</p>
      ${lines.map((o) => `<p class="mh-meta">${RU(o)}</p>`).join('')}
    </div></header>
    ${grid}${legendHtml()}${footHtml()}
  </article>`;
}

function orthMonth(y, m, compact) {
  const { k0, k1 } = gregMonthRange(y, m);
  const j0 = julianFromK(k0); const j1 = julianFromK(k1);
  const title = compact ? RU_MON[m][0].toUpperCase() + RU_MON[m].slice(1) : `${RU_MON[m][0].toUpperCase() + RU_MON[m].slice(1)} ${y}`;
  const what = state.cal === 'komi' ? 'Коми-пермяцкие праздники.' : 'Православные праздники.';
  return pureMonth({ k0, k1, firstWd: 1, rtl: false, title, note: what, compact, sub: { jul: true, musl: state.musl, jew: state.jew }, other: { musl: state.musl, jew: state.jew, jul: true } });
}

/* ---------- мусульманский (месяцы хиджры) ---------- */

function hijriMonthRange(k) {
  const h = hijriOf(k);
  let k0 = k - (h.day - 1);
  while (hijriOf(k0).day !== 1) k0 += hijriOf(k0).day > 15 ? 1 : -1;
  let k1 = k0 + 28;
  while (hijriOf(k1 + 1).month === h.month) k1++;
  return { k0, k1, h };
}

function muslMonth(k, compact) {
  const { k0, k1, h } = hijriMonthRange(k);
  const name = HIJRI_MONTHS_RU[h.month - 1];
  const title = compact ? cap(name) : `${cap(name)} ${h.year} г. хиджры`;
  return pureMonth({
    k0, k1, firstWd: 6, rtl: true, title, compact,
    note: 'Неделя с субботы, пятница — последний день.',
    mainNum: (kk) => hijriOf(kk).day,
    sub: { jul: state.orth, musl: false, jew: state.jew },
    other: { jew: state.jew, jul: state.orth },
  });
}

/* ---------- иудейский (еврейские месяцы, по диаспоре) ---------- */

function jewMonth(k, compact) {
  const h = hebrewFromK(k);
  const k0 = kFromHebrew(h.year, h.month, 1);
  const k1 = k0 + hebrewMonthDays(h.year, h.month) - 1;
  const name = hebrewMonthName(h.year, h.month);
  const title = compact ? cap(name) : `${cap(name)} ${h.year}`;
  return pureMonth({
    k0, k1, firstWd: 0, rtl: true, title, compact,
    note: 'Неделя с воскресенья, суббота — последний день. Праздники по диаспоре.',
    mainNum: (kk) => hebrewFromK(kk).day,
    sub: { jul: state.orth, musl: state.musl, jew: false },
    other: { musl: state.musl, jul: state.orth },
  });
}

/* ---------- годовые листы чистых календарей ---------- */

function pureYearSheet(title, line, months, cols = 'm12') {
  return `<article class="sheet">
    <div class="sh-head"><div></div><div class="sh-title"><div class="t-main">${RU(title)}</div><div class="t-line">${RU(line)}</div></div><div></div></div>
    <div class="year-grid ${cols}">${months.join('')}</div>${legendHtml()}${footHtml()}
  </article>`;
}

function orthYear(k) {
  const y = gYear(k);
  const months = [];
  for (let m = 0; m < 12; m++) months.push(orthMonth(y, m, true));
  return pureYearSheet(`${y} год`, `Гражданский календарь, ${state.cal === 'komi' ? 'коми-пермяцкие праздники' : 'православные праздники'}; мелко — дата по старому стилю`, months);
}

function muslYear(k) {
  const y = hijriOf(k).year;
  let kk = k - 360;
  while (hijriOf(kk).year < y) kk += 20;
  while (hijriOf(kk - 1).year === y) kk--;
  const months = [];
  for (let m = 0; m < 12; m++) {
    months.push(muslMonth(kk, true));
    kk = hijriMonthRange(kk).k1 + 1;
  }
  return pureYearSheet(`${y} год хиджры`, `${fmtSpan(hijriYearStart(y), hijriYearStart(y + 1) - 1)} · Умм аль-Кура`, months);
}

function hijriYearStart(y) {
  let k = Math.floor((y - 1389) * 354.367 + 18262 - 330);
  while (hijriOf(k).year < y) k += 10;
  while (hijriOf(k - 1).year === y) k--;
  return k;
}

function jewYear(k) {
  const y = hebrewFromK(k).year;
  const months = hebrewMonthsOfYear(y).map((m) => jewMonth(kFromHebrew(y, m, 1), true));
  const k0 = kFromHebrew(y, 7, 1);
  const k1 = kFromHebrew(y + 1, 7, 1) - 1;
  return pureYearSheet(`${y} год`, `${fmtSpan(k0, k1)}, ${months.length} месяцев; праздники по диаспоре`, months, months.length > 12 ? 'm13' : 'm12');
}

/* ---------- неделя для чистых календарей ---------- */

function pureWeek(k, firstWd, rtl, headFn, title) {
  const k0 = k - ((weekday(k) - firstWd + 7) % 7);
  const k1 = k0 + 6;
  const ev = collectEvents(k0, k1);
  const today = todayK();
  const cols = [];
  for (let kk = k0; kk <= k1; kk++) {
    cols.push(dayColumn(kk, ev.byDay, today, { head: headFn(kk), musl: state.musl || state.cal === 'musl', jew: state.jew || state.cal === 'jew', jul: state.orth || state.cal === 'orth' || state.cal === 'komi' }));
  }
  return `<article class="sheet">
    <div class="sh-head"><div></div><div class="sh-title"><div class="t-main">${RU(title)}</div><div class="t-line">${RU(fmtSpan(k0, k1))}</div></div><div></div></div>
    <div class="week-grid${rtl ? ' rtl' : ''}" style="grid-template-columns:repeat(7, minmax(0,1fr))">${cols.join('')}</div>
    ${legendHtml()}${footHtml()}
  </article>`;
}

/* ---------- сутки ---------- */

function daySheet(k) {
  const start = sunsetOf(k - 1, place);
  const end = sunsetOf(k, place);
  const ev = collectEvents(k, k);
  const evs = (ev.byDay.get(k) || []).filter((e) => !e.cont || e.span);
  const d = dateOfDay(k);
  const dates = [
    `<b>${RU_WD_LONG[weekday(k)]}, ${gText(k)}</b>`,
    anbOnly() ? A(`${v8Month(d.month).kp} ${v8Week(d.week).kp} ${v8Num(d.day).kp}`)
      : `«Солнечная восьмёрка»: ${esc(v8Month(d.month).ru)}, ${esc(v8Week(d.week).ru)}, ${ORD_RU[d.day - 1]} день${state.kp ? ` (${KP(`${v8Month(d.month).kp} ${v8Week(d.week).kp} ${v8Num(d.day).kp}`)})` : ''}, ${d.yearNumber}-й год`,
    ...(useSigns() ? [`знаками: <span class="pas sg-line">${dateSigns(d, state.signs === 'print' ? 'print' : 'parade')}</span>`] : []),
    `по старому стилю: ${esc(julianLabel(julianFromK(k)))}`,
    `по хиджре: ${esc(hijriLabel(hijriOf(k)))}`,
    `по еврейскому календарю: ${esc(hebrewLabel(hebrewFromK(k)))}`,
  ];
  if (start === null || end === null) {
    return `<article class="sheet narrow"><p class="day-dates">${dates.join('<br>')}</p><p>В этом месте Солнце сегодня не заходит или не восходит — сутки по закату не определить.</p></article>`;
  }
  const span = end - start;
  const y = (t) => `${(((t - start) / span) * 100).toFixed(3)}%`;
  // часы и получасы местного времени
  const tz = place.tz || deviceTz;
  const ticks = [];
  const first = Math.ceil(start / 1800000) * 1800000;
  for (let t = first; t < end; t += 1800000) {
    const hm = civilTime(t);
    const hour = hm.endsWith(':00');
    ticks.push(`<div class="tick${hour ? ' hour' : ''}" style="top:${y(t)}">${hm}</div>`);
  }
  // рубежи и части суток
  const rub = rubezhiRange(k - 2, k + 1, place.lat, place.lon).filter((r) => r.t >= start - 60000 && r.t < end);
  const names = Object.fromEntries(NAMES.rubezhi.map((r) => [r.id, r]));
  const parts = Object.fromEntries(NAMES.parts.map((p) => [p.after, p]));
  const blocks = [];
  for (let i = 0; i < rub.length; i++) {
    const a = rub[i];
    const b = rub[i + 1] ? rub[i + 1].t : end;
    const q = QUARTER_OF_PART[a.id];
    blocks.push(`<div class="part ${q}" style="top:${y(Math.max(a.t, start))};height:${(((b - Math.max(a.t, start)) / span) * 100).toFixed(3)}%"></div>`);
  }
  // подписи рубежей не наезжают: шаг не меньше 4 % высоты колонки; линия — на своём времени
  let last = -10;
  const lines = rub.map((r) => {
    const n = names[r.id];
    const p = parts[r.id];
    const pos = ((Math.max(r.t, start) - start) / span) * 100;
    const at = Math.max(pos, last + 4);
    last = at;
    const kp = state.kp && !anbOnly() ? ` <span class="muted">${KP(n.kp)}${p ? ' → ' + KP(p.kp) : ''}</span>` : '';
    return `<div class="rub${r.merged ? ' merged' : ''}" style="top:${pos.toFixed(3)}%"></div>`
      + `<div class="rub-l" style="top:calc(${at.toFixed(3)}% + 2px)"><b>${r.id}</b> ${NAME(n.ru, n.kp)} ${civilTime(r.t)}${kp}<br><span class="muted rub-how">${RU(n.how)}</span></div>`;
  }).join('');
  const now = Date.now();
  const nowLine = now >= start && now < end ? `<div class="nowline" style="top:${y(now)}" title="сейчас"></div>` : '';
  let off = '';
  try { off = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(start).find((x) => x.type === 'timeZoneName').value.replace('GMT', 'UTC'); } catch { off = tz; }
  const tzNote = ` (${off})`;
  return `<article class="sheet narrow">
    <div class="sh-title" style="text-align:left"><div class="t-main">Сутки</div></div>
    <p class="day-dates">${dates.join('<br>')}</p>
    <p class="small muted">Сутки начинаются на закате ${civilTime(start)} накануне и кончаются на закате ${civilTime(end)}; ${esc(place.name || 'моё место')}, время ${esc(tzNote.trim().replace(/[()]/g, ''))}.</p>
    <ul class="day-events">${evs.map((e) => `<li>${evHtml(e, true)}</li>`).join('') || '<li class="muted">Праздников и событий нет</li>'}</ul>
    <div class="day-cols">
      <div class="day-col"><h4>Часы</h4>${ticks.join('')}${nowLine}</div>
      <div class="day-col"><h4>Солнечные рубежи и части суток</h4>${blocks.join('')}${lines}${nowLine}</div>
    </div>
    ${footHtml()}
  </article>`;
}

/* ---------- подписи ---------- */

function legendHtml() {
  // строка 1 — традиции, небо, затмения и фазы Луны; строка 2 — как читать полосы
  const line1 = [];
  const line2 = [];
  if (state.cal === 'v8' && state.view === 'year') {
    line1.push(`<span class="lg"><i class="sw" style="background:var(--wk-fri)"></i>${RU('пятница')}</span>`);
    line1.push(`<span class="lg"><i class="sw" style="background:var(--wk-sat)"></i>${RU('суббота')}</span>`);
    line1.push(`<span class="lg"><i class="sw" style="background:var(--wk-sun)"></i>${RU('воскресенье')}</span>`);
  }
  const faiths = [state.orth && `<b class="orthodox">${RU('православные праздники')}</b>`, state.musl && `<b class="muslim">${RU('мусульманские')}</b>`, state.jew && `<b class="jewish">${RU('иудейские')}</b>`].filter(Boolean);
  if (faiths.length > 1 || (faiths.length && state.astro)) line1.push(...faiths);
  if (state.astro) line1.push(`<b class="astro">${RU('небесные события')}</b>`, `<b class="eclipse">${RU('затмения')}</b>`);
  if (state.moon) line1.push(`<span class="lg">${moonIcon('novolunie')} ${RU('новолуние')}</span><span class="lg">${moonIcon('pervaya-chetvert')} ${RU('первая четверть')}</span><span class="lg">${moonIcon('polnolunie')} ${RU('полнолуние')}</span><span class="lg">${moonIcon('poslednyaya-chetvert')} ${RU('последняя четверть')}</span>`);
  if (faiths.length) line2.push(`<span class="lg"><i class="segmark"></i>${RU('праздник — от заката до заката: сутки начинаются вечером, накануне указанной даты')}</span>`);
  else if (state.cal === 'v8') line2.push(`<span>${RU('сутки начинаются вечером, накануне указанной даты')}</span>`);
  if (state.astro) line2.push(`<span class="lg"><i class="lbar"></i>${RU('небесное событие на несколько дней')}</span>`);
  return [line1, line2].filter((l) => l.length).map((l) => `<div class="legend">${l.join('')}</div>`).join('');
}

function footHtml(credits = '') {
  // подвал одной строкой: что это, место, сайт и подписи гербов и снимков
  const where = place ? `${place.name || 'Моё место'} (${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°)` : '';
  const name = anbOnly() ? `«${W('Шонді кыкьямыс')}» — ${RU('игровая реконструкция для книги и настольной игры')}` : '«Солнечная восьмёрка» — игровая реконструкция для книги и настольной игры';
  return `<p class="sh-foot">${name}. ${RU(where)}. `
    + `scatik146.github.io/komi-perm-game-calendar${credits ? `. ${credits}` : ''}</p>`;
}

/* ---------- сборка ---------- */

function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function plural(n, one, few, many) {
  const a = n % 10; const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

/** Границы текущего листа — для ◀ ▶ и .ics. */
function range() {
  const k = anchor;
  const { cal, view } = state;
  if (view === 'day') return { k0: k, k1: k };
  if (cal === 'v8') {
    const d = dateOfDay(k);
    if (view === 'year') return { k0: yearStart(d.yearNumber), k1: yearStart(d.yearNumber + 1) - 1 };
    if (view === 'month') return v8MonthRange(d.yearNumber, d.month);
    return v8WeekRange(k);
  }
  if (view === 'week') {
    const first = cal === 'orth' || cal === 'komi' ? 1 : cal === 'musl' ? 6 : 0;
    const k0 = k - ((weekday(k) - first + 7) % 7);
    return { k0, k1: k0 + 6 };
  }
  if (cal === 'orth' || cal === 'komi') {
    const y = gYear(k);
    return view === 'year' ? { k0: kOf(y, 0, 1), k1: kOf(y + 1, 0, 1) - 1 } : gregMonthRange(y, gMonth(k));
  }
  if (cal === 'musl') {
    if (view === 'month') return hijriMonthRange(k);
    const y = hijriOf(k).year;
    return { k0: hijriYearStart(y), k1: hijriYearStart(y + 1) - 1 };
  }
  const h = hebrewFromK(k);
  if (view === 'month') { const k0 = kFromHebrew(h.year, h.month, 1); return { k0, k1: k0 + hebrewMonthDays(h.year, h.month) - 1 }; }
  return { k0: kFromHebrew(h.year, 7, 1), k1: kFromHebrew(h.year + 1, 7, 1) - 1 };
}

function render() {
  const { cal, view } = state;
  const k = anchor;
  let html = '';
  // решение автора: лист «Солнечной восьмёрки» по-русски не делаем — только по-коми-пермяцки или анбуром
  document.body.classList.toggle('cal-v8', cal === 'v8');
  if (cal === 'v8' && !['kpo', 'anb'].includes(state.script)) {
    state.script = 'kpo';
    state.kp = true;
    const r = document.querySelector('input[name="script"][value="kpo"]');
    if (r) r.checked = true;
  }
  try { sheetRange = range(); } catch { sheetRange = null; }
  try {
    if (view === 'day') html = daySheet(k);
    else if (cal === 'v8') {
      const d = dateOfDay(k);
      html = view === 'year' ? v8YearSheet(d.yearNumber) : view === 'month' ? v8MonthSheet(d.yearNumber, d.month) : v8WeekSheet(k);
    } else if (cal === 'orth' || cal === 'komi') {
      html = view === 'year' ? orthYear(k) : view === 'month' ? orthMonth(gYear(k), gMonth(k)) : pureWeek(k, 1, false, (kk) => RU_WD_LONG[weekday(kk)], 'Неделя');
    } else if (cal === 'musl') {
      html = view === 'year' ? muslYear(k) : view === 'month' ? muslMonth(k) : pureWeek(k, 6, true, (kk) => RU_WD_LONG[weekday(kk)], 'Неделя');
    } else {
      html = view === 'year' ? jewYear(k) : view === 'month' ? jewMonth(k) : pureWeek(k, 0, true, (kk) => RU_WD_LONG[weekday(kk)], 'Неделя');
    }
  } catch (err) {
    html = `<p>Не удалось составить календарь: ${esc(err.message)}</p>`;
    console.error(err);
  }
  $('sheet-wrap').innerHTML = html;
  $('date').value = isoOf(anchor);
  $('notes').innerHTML = notesHtml();
  saveState();
}

function notesHtml() {
  const n = [];
  n.push('<p>Сутки «Солнечной восьмёрки», хиджры и еврейского календаря начинаются на закате, поэтому событие, случившееся вечером после заката, стоит на следующем дне — как «ночь на…».</p>');
  if (state.musl || state.cal === 'musl') n.push('<p>Хиджра — расчётный календарь Умм аль-Кура. В России начало месяца объявляют по наблюдению молодой Луны, и оно может отличаться на день.</p>');
  if (state.jew || state.cal === 'jew') n.push('<p>Иудейские праздники — по диаспоре: Песах 8 дней, Шавуот 2 дня, Симхат Тора отдельно.</p>');
  if (state.cal === 'komi') n.push('<p>Коми-пермяцкий календарь: только праздники, у которых есть коми-пермяцкое название в нашем списке (календарь автора 2025/26); даты — по юлианскому календарю РПЦ.</p>');
  else if (state.orth || state.cal === 'orth') n.push('<p>Православные праздники — по юлианскому календарю Русской православной церкви; Пасха — по юлианской пасхалии.</p>');
  if (state.astro) n.push('<p>Затмения показаны, только если их видно в выбранном месте. Суперлуние — полнолуние ближе 90 % пути от апогея к перигею своего месяца. Расчёты неба — библиотека Astronomy Engine (MIT).</p>');
  return n.join('');
}

/* ---------- .ics ---------- */

function icsDate(k) { return isoOf(k).replace(/-/g, ''); }

function downloadIcs() {
  const { k0, k1 } = range();
  const { list } = collectEvents(k0, k1);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Scatik146//Solnechnaya vosmyorka//RU', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  for (const e of list.filter((x) => !x.cont && !x.minor && x.kind !== 'moon')) {
    const endK = (e.span ? e.span[1] : e.k) + 1;
    lines.push('BEGIN:VEVENT', `UID:${e.id}-${e.k}@komi-perm-game-calendar`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.k)}`, `DTEND;VALUE=DATE:${icsDate(endK)}`,
      `SUMMARY:${label(e).replace(/[,;]/g, '\\$&')}`,
      `CATEGORIES:${KIND_RU[e.kind] || e.kind}`,
      ...(e.note || e.night ? [`DESCRIPTION:${[e.night ? 'с вечера накануне' : '', e.note || ''].filter(Boolean).join('; ').replace(/[,;]/g, '\\$&')}`] : []),
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kalendar-${isoOf(k0)}.ics`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- место ---------- */

function parseHere(s) {
  try { const h = JSON.parse(s); return h && Number.isFinite(h.lat) ? h : null; } catch { return null; }
}

function addHereOption(here) {
  const sel = $('place');
  let o = sel.querySelector('option[value="here"]');
  if (!o) { o = document.createElement('option'); o.value = 'here'; sel.prepend(o); }
  o.textContent = `Моё место (${here.lat.toFixed(2)}°, ${here.lon.toFixed(2)}°)`;
}

function choose(p) {
  if (!p) return;
  place = p;
  $('place').value = p.id;
  store.set('place', p.id);
}

function fillPlaces() {
  const sel = $('place');
  const groups = [['district', 'Районы Коми-Пермяцкого округа и соседи'], ['city', 'Города Пермского края'], ['gorodishche', 'Городища']];
  for (const [kind, lab] of groups) {
    const g = document.createElement('optgroup');
    g.label = lab;
    for (const p of places.filter((x) => x.kind === kind)) {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name; g.append(o);
    }
    sel.append(g);
  }
  const here = parseHere(store.get('here'));
  if (here) addHereOption(here);
  const saved = store.get('place');
  choose(saved === 'here' && here ? here : places.find((p) => p.id === saved) || places.find((p) => p.id === 'kudymkar'));
  sel.addEventListener('change', () => {
    choose(sel.value === 'here' ? parseHere(store.get('here')) : places.find((p) => p.id === sel.value));
    render();
  });
}

function locate() {
  const status = $('status');
  if (!('geolocation' in navigator)) { status.textContent = 'Браузер не умеет определять местоположение. Выберите место из списка.'; return; }
  status.textContent = 'Определяю местоположение…';
  navigator.geolocation.getCurrentPosition((pos) => {
    const here = { id: 'here', name: 'Моё место', kind: 'here', lat: pos.coords.latitude, lon: pos.coords.longitude, tz: deviceTz };
    store.set('here', JSON.stringify(here));
    addHereOption(here);
    choose(here);
    status.textContent = 'Местоположение определено. Оно используется только в вашем браузере и никуда не отправляется.';
    render();
  }, () => {
    status.textContent = 'Не удалось определить местоположение. Выберите место из списка.';
  }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
}

/* ---------- запуск ---------- */

async function start() {
  try {
    const [p, k, n] = await Promise.all([
      fetch('data/places.json').then((r) => r.json()),
      fetch('data/kalendar.json').then((r) => r.json()),
      fetch('data/names.json').then((r) => r.json()),
    ]);
    places = p.places; K = k; NAMES = n;
  } catch {
    $('sheet-wrap').textContent = 'Не удалось загрузить данные календаря. Обновите страницу.';
    return;
  }
  try { TR = makeTransliterator(await fetch('data/anbur.json').then((r) => r.json())); } catch { TR = null; }
  try { PICS = await fetch('data/kartinki.json').then((r) => (r.ok ? r.json() : null)); } catch { PICS = null; }
  fillPlaces();
  restoreState();
  const q = new URLSearchParams(location.search);
  anchor = q.get('date') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('date'))
    ? Math.floor(Date.parse(q.get('date') + 'T00:00:00Z') / DAY_MS) : todayK();

  document.querySelectorAll('input[name="cal"]').forEach((el) => el.addEventListener('change', () => {
    readControls();
    Object.assign(state, DEFAULT_LAYERS[state.cal]);
    for (const id of ['orth', 'musl', 'jew']) $(`l-${id}`).checked = state[id];
    render();
  }));
  document.querySelectorAll('input[name="view"], input[name="signs"], input[name="script"], .checks input').forEach((el) => el.addEventListener('change', () => { readControls(); render(); }));
  $('prev').addEventListener('click', () => { anchor = range().k0 - 1; if (state.view !== 'day') anchor = range().k0; render(); });
  $('next').addEventListener('click', () => { anchor = range().k1 + 1; render(); });
  $('today').addEventListener('click', () => { anchor = todayK(); render(); });
  $('date').addEventListener('change', () => {
    const v = $('date').value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { anchor = Math.floor(Date.parse(v + 'T00:00:00Z') / DAY_MS); render(); }
  });
  $('print').addEventListener('click', async () => { try { await document.fonts.ready; } catch { /* без шрифтов */ } window.print(); });
  $('ics').addEventListener('click', downloadIcs);
  $('locate').addEventListener('click', locate);
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
