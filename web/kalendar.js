import {
  calendarAt, dateOfDay, yearStart, monthLengths, DAY_MS,
  makeTransliterator, numberSign, eightSign, monthSign, dateSigns, yearSigns, hijriText,
} from './engine/index.js';
import { paradeSigns, plankRows, plankSvg, saveSvg } from './plashka.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* хранилище недоступно */ } },
};

let places = [];
let place = null;
let K = null;          // названия: data/kalendar.json
let anbur = (s) => s;
let PASY = null;       // парадные знаки для плашки: data/pasy.json
let todayDate = null;

const num = (n) => K.numbers[n - 1];
const week = (w) => K.weeks[w - 1];
const month = (m) => K.months[m - 1];
const era = (e) => K.eras.find((x) => x.n === e);

/* ---------- место ---------- */

function parseHere(s) {
  try { const h = JSON.parse(s); return h && Number.isFinite(h.lat) ? h : null; } catch { return null; }
}

function fillPlaces() {
  const sel = $('place');
  const groups = [
    ['district', 'Районы Коми-Пермяцкого округа и соседи'],
    ['city', 'Города Пермского края'],
    ['gorodishche', 'Городища'],
  ];
  const here = parseHere(store.get('here'));
  if (here) {
    const o = document.createElement('option');
    o.value = 'here';
    o.textContent = `Моё место (${here.lat.toFixed(2)}°, ${here.lon.toFixed(2)}°)`;
    sel.append(o);
  }
  for (const [kind, label] of groups) {
    const g = document.createElement('optgroup');
    g.label = label;
    for (const p of places.filter((x) => x.kind === kind)) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      g.append(o);
    }
    sel.append(g);
  }
  const saved = store.get('place');
  place = (saved === 'here' && here) || places.find((p) => p.id === saved) || places.find((p) => p.id === 'kudymkar');
  sel.value = place.id;
  sel.addEventListener('change', () => {
    place = sel.value === 'here' ? here : places.find((p) => p.id === sel.value);
    store.set('place', place.id);
    renderToday();
    convertFromGregorian();
    convertFromOurs();
  });
}

/* ---------- форматы ---------- */

const civil = (opts) => new Intl.DateTimeFormat('ru-RU', { timeZone: place.tz, ...opts });
const dayOfUTC = (k) => k * DAY_MS + 12 * 3600000;    // полдень дня k — для подписей дат
const gregorian = (k) => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(dayOfUTC(k));

/** Дата по хиджре для дневной даты k: мусульманские сутки, как и наши, начинаются на закате.
 *  Месяцы — своими названиями (engine/hijri.js): на Android Intl подставлял григорианские. */
const hijri = (k) => hijriText(k);

/** Русская запись даты: «Месяц Щуки, шестая неделя, шестой день». */
function ruDate(d) {
  return `${month(d.month).ru}, ${week(d.week).ord} неделя, ${num(d.day).ru} день`;
}

function ruYear(d) {
  if (d.era < 1) return `Эра Чуди — год до кометы, позиции ${d.circle}-${d.octave}-${d.year}`;
  const e = era(d.era);
  const eraName = e ? `эра ${e.ru}` : `эра ${d.era}`;
  const c = K.circles[d.circle - 1];
  const o = K.octaves[d.octave - 1];
  return `Год ${d.yearNumber}: ${eraName}, круг ${c.ru} (${c.kp}), ${o.ru} октава (${o.kp}), ${num(d.year).ru} год (${num(d.year).kp})`;
}

const kpDate = (d) => `${month(d.month).kp} · ${week(d.week).kp} · ${num(d.day).kp}`;
const digits = (d) => `${d.month}·${d.week}·${d.day} · ${d.era < 1 ? '—' : d.era}·${d.circle}·${d.octave}·${d.year}`;

/** Обычная запись: печатные знаки в строку с буквами — дата, затем год по местам. */
function printText(d) {
  return dateSigns(d, 'print') + (d.era >= 1 ? ` ${yearSigns(d, 'print')}` : '');
}

function plank(d) {
  return plankSvg(PASY, plankRows(d, { year: d }));
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function signsHtml(d) {
  const year = (d.era >= 1 ? [d.era] : []).concat([d.circle, d.octave, d.year]).map(numberSign).join('');
  return `<span class="pas-month">${monthSign(d.month)}</span>`
    + `<span class="pas-date">${eightSign(d.week)}${numberSign(d.day)}</span>`
    + `<span class="pas-gap"></span><span class="pas-year">${year}</span>`;
}

/* ---------- сегодня ---------- */

function renderToday() {
  const now = Date.now();
  const d = calendarAt(now, place);
  $('c-ru').textContent = ruDate(d);
  $('c-year').textContent = ruYear(d);
  $('c-kp').textContent = kpDate(d);
  $('c-anb').textContent = anbur(kpDate(d).toLowerCase());
  $('c-print').textContent = printText(d);
  $('c-print').setAttribute('aria-label', `Печатными знаками: ${digits(d)}`);
  $('c-pas').innerHTML = signsHtml(d);
  if (!todayDate || todayDate.dayNumber !== d.dayNumber) $('c-plank').innerHTML = plank(d);
  todayDate = d;
  $('c-pas').setAttribute('aria-label', `Знаками: ${digits(d)}`);
  $('c-num').textContent = `Числом: ${digits(d)}`;

  const m = month(d.month);
  const next = month(d.month % 8 + 1);
  const left = d.monthLength - d.dayOfMonth;
  $('c-month').textContent = `${m.ru} (${m.kp}) — защитник ${m.animal}; ${m.season} (${K.seasons[m.season]}). `
    + `В месяце ${d.monthLength} ${plural(d.monthLength, 'день', 'дня', 'дней')}, сегодня ${d.dayOfMonth}-й`
    + (left ? `, до ${next.ru.replace('Месяц', 'месяца')} — ${left} ${plural(left, 'день', 'дня', 'дней')}.` : `, завтра начинается ${next.ru}.`)
    + ` Событие месяца — ${m.event}.`;
  const t = civil({ hour: '2-digit', minute: '2-digit' });
  const startDay = civil({ day: 'numeric', month: 'long' });
  $('c-sutki').textContent = (d.sutkiStart && d.sutkiEnd)
    ? `Эти сутки начались на закате ${startDay.format(d.sutkiStart)} в ${t.format(d.sutkiStart)} и кончатся на закате в ${t.format(d.sutkiEnd)} (${place.name}).`
    : 'В эти дни Солнце не заходит или не встаёт: сутки считаются по счёту, без заката.';

  const nowCivil = civil({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  $('g-today').textContent = `${nowCivil}, ${t.format(now)}`;
  $('h-today').textContent = hijri(d.dayNumber);
  const civilDay = Math.floor((now + offsetMs(now)) / DAY_MS);
  $('c-note').textContent = civilDay < d.dayNumber
    ? 'Солнце уже село: по «Солнечной восьмёрке» и по хиджре наступил следующий день, по григорианскому календарю день сменится в полночь.'
    : 'По «Солнечной восьмёрке» и по хиджре день сменится на закате, по григорианскому календарю — в полночь.';
  document.title = `${kpDate(d)} — Календарь`;
}

function offsetMs(ms) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: place.tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(ms).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ms / 60000) * 60000;
}

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

/* ---------- переводы ---------- */

function describe(k) {
  const d = dateOfDay(k);
  return `<p class="conv-ru">${ruDate(d)}</p>`
    + `<p class="conv-year">${ruYear(d)}</p>`
    + `<p class="conv-kp">${kpDate(d)} <span class="anbur">${anbur(kpDate(d).toLowerCase())}</span></p>`
    + `<p class="anbur conv-print" aria-label="Печатными знаками: ${digits(d)}">${printText(d)}</p>`
    + `<p class="pas conv-pas" aria-label="Резами: ${digits(d)}">${signsHtml(d)}</p>`
    + `<p class="small">Числом: ${digits(d)}. По григорианскому: ${gregorian(k)}; по хиджре: ${hijri(k)}.</p>`
    + '<p class="small">Дата — дневная часть суток; сами сутки начались накануне на закате.</p>';
}

function convertFromGregorian() {
  const v = $('g-in').value;
  if (!v) { $('g-out').innerHTML = ''; return; }
  const [y, m, dd] = v.split('-').map(Number);
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, dd);                       // годы до 100 — без поправки на 1900
  const k = Math.floor(t.getTime() / DAY_MS);
  $('g-out').innerHTML = describe(k);
}

function convertFromOurs() {
  const n = Number($('o-year').value);
  const m = Number($('o-month').value);
  const w = Number($('o-week').value);
  const dd = Number($('o-day').value);
  const out = $('o-out');
  if (!Number.isInteger(n) || n < -511 || n > 4096) { out.innerHTML = '<p class="small">Номер года — целое число от −511 до 4096 (1190 — 2025/26).</p>'; return; }
  const lengths = monthLengths(n);
  const dayInMonth = (w - 1) * 8 + dd;
  if (dayInMonth > lengths[m - 1]) {
    out.innerHTML = `<p class="small">В месяце ${month(m).kp} года ${n} только ${lengths[m - 1]} ${plural(lengths[m - 1], 'день', 'дня', 'дней')}: неделя ${week(w).kp} кончается раньше.</p>`;
    return;
  }
  const k = yearStart(n) + lengths.slice(0, m - 1).reduce((a, b) => a + b, 0) + dayInMonth - 1;
  out.innerHTML = describe(k);
}

function fillOurForm() {
  const opt = (sel, items) => { for (const [v, t] of items) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); } };
  opt($('o-month'), K.months.map((x) => [x.n, `${x.n} — ${x.kp}`]));
  opt($('o-week'), K.weeks.map((x) => [x.n, `${x.n} — ${x.kp}`]));
  opt($('o-day'), K.numbers.map((x) => [x.n, `${x.n} — ${x.kp}`]));
  const d = calendarAt(Date.now(), place);
  $('o-year').value = d.yearNumber;
  $('o-month').value = d.month;
  $('o-week').value = d.week;
  $('o-day').value = d.day;
  const today = new Date();
  $('g-in').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  for (const id of ['o-year', 'o-month', 'o-week', 'o-day']) $(id).addEventListener('input', convertFromOurs);
  $('g-in').addEventListener('input', convertFromGregorian);
}

/* ---------- запуск ---------- */

async function start() {
  try {
    const [p, k, a, ps] = await Promise.all([
      fetch('data/places.json').then((r) => r.json()),
      fetch('data/kalendar.json').then((r) => r.json()),
      fetch('data/anbur.json').then((r) => r.json()),
      fetch('data/pasy.json').then((r) => r.json()),
    ]);
    places = p.places;
    K = k;
    PASY = paradeSigns(ps);
    anbur = makeTransliterator(a);
  } catch {
    $('c-ru').textContent = 'Не удалось загрузить данные календаря. Обновите страницу.';
    return;
  }
  fillPlaces();
  renderToday();
  for (const kind of ['png', 'svg']) {
    $(`c-plank-${kind}`).addEventListener('click', () => {
      const d = todayDate;
      saveSvg(plank(d), `plashka-${d.month}-${d.week}-${d.day}`, kind, download);
    });
  }
  fillOurForm();
  convertFromGregorian();
  convertFromOurs();
  setInterval(renderToday, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderToday(); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
