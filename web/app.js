import {
  stateAt, apparentSolarTime, subdivisionsOf, subdivisionAt, moonEvents, moonPhase, makeTransliterator,
} from './engine/index.js';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* хранилище недоступно — не страшно */ } },
};

let places = [];
let names = null;
let anbur = (s) => s;
let place = null;
let dialect = store.get('dialect') === 'inv' ? 'inv' : 'kp';
let state = null;
let moon = null;

/* ---------- данные ---------- */

async function loadData() {
  const [p, n, a] = await Promise.all([
    fetch('data/places.json').then((r) => r.json()),
    fetch('data/names.json').then((r) => r.json()),
    fetch('data/anbur.json').then((r) => r.json()),
  ]);
  anbur = makeTransliterator(a);
  places = p.places;
  names = n;
}

const rubezh = (id) => names.rubezhi.find((r) => r.id === id);
const partAfter = (id) => names.parts.find((p) => p.after === id);
const quarterById = (id) => names.quarters.find((q) => q.id === id);
const word = (entry) => (dialect === 'inv' && entry.inv ? entry.inv : entry.kp);

/* ---------- выбор места ---------- */

function fillPlaces() {
  const sel = $('place');
  const groups = [
    ['district', 'Районы Коми-Пермяцкого округа и соседи'],
    ['city', 'Города Пермского края'],
    ['gorodishche', 'Городища'],
  ];
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
  const here = parseHere(store.get('here'));
  if (here) addHereOption(here);
  if (saved === 'here' && here) choose(here);
  else choose(places.find((p) => p.id === saved) || places.find((p) => p.id === 'kudymkar'));
  sel.addEventListener('change', () => {
    const v = sel.value;
    choose(v === 'here' ? parseHere(store.get('here')) : places.find((p) => p.id === v));
  });
}

function parseHere(s) {
  try { const h = JSON.parse(s); return h && Number.isFinite(h.lat) ? h : null; } catch { return null; }
}

function addHereOption(here) {
  const sel = $('place');
  let o = sel.querySelector('option[value="here"]');
  if (!o) {
    o = document.createElement('option');
    o.value = 'here';
    sel.prepend(o);
  }
  o.textContent = `Моё место (${here.lat.toFixed(2)}°, ${here.lon.toFixed(2)}°)`;
}

function choose(p) {
  if (!p) return;
  place = p;
  $('place').value = p.id;
  store.set('place', p.id);
  $('status').textContent = '';
  recompute();
}

function locate() {
  const status = $('status');
  if (!('geolocation' in navigator)) {
    status.textContent = 'Браузер не умеет определять местоположение. Выберите место из списка.';
    return;
  }
  status.textContent = 'Определяю местоположение…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const here = {
        id: 'here', name: 'Моё место', kind: 'here',
        lat: pos.coords.latitude, lon: pos.coords.longitude, tz: deviceTz,
      };
      store.set('here', JSON.stringify(here));
      addHereOption(here);
      choose(here);
      status.textContent = 'Местоположение определено. Оно используется только в вашем браузере и никуда не отправляется.';
    },
    (err) => {
      status.textContent = err.code === err.PERMISSION_DENIED
        ? 'Доступ к местоположению запрещён. Разрешите его в настройках браузера или выберите место из списка.'
        : 'Не удалось определить местоположение. Попробуйте ещё раз или выберите место из списка.';
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
}

/* ---------- время и формат ---------- */

function civilFormat(tz, withSeconds) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

function utcOffsetLabel(tz, ms) {
  try {
    const part = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(ms).find((x) => x.type === 'timeZoneName');
    return part ? part.value.replace('GMT', 'UTC') : tz;
  } catch { return tz; }
}

function hms(hours) {
  const s = Math.floor(hours * 3600) % 86400;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function duration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'меньше минуты';
  const h = Math.floor(m / 60);
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`;
}

/* ---------- циферблат ---------- */

const R = 168;        // радиус круга
const R_TICK = 158;   // начало мелких делений
const R_MOON = 176;   // полоса Луны над горизонтом
const R_LABEL = 192;  // подписи рубежей

// Начало суток (закат, рубеж I) — ровно сверху, на месте «12 часов»; сутки идут по часовой стрелке.
// shift поворачивает круг так, чтобы закат текущих суток оказался наверху.
let shift = 0;
function point(hours, r) {
  const a = ((hours + shift) / 24) * 2 * Math.PI;
  return [-r * Math.sin(a), r * Math.cos(a)];
}

function el(name, attrs, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}

const f = (n) => n.toFixed(2);

function span(h1, h2) {
  let s = (h2 - h1 + 24) % 24;
  if (s === 0 && h1 !== h2) s = 24;
  return s;
}

function wedge(h1, h2) {
  const s = span(h1, h2);
  if (s === 0) return '';
  const steps = Math.max(2, Math.ceil(s * 6));
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(point(h1 + (s * i) / steps, R));
  return `M0,0L${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`;
}

function drawDial() {
  const svg = $('dial');
  svg.querySelectorAll(':scope > :not(desc)').forEach((n) => n.remove());
  const lon = place.lon;
  const list = state.sutki.rubezhi;
  const ends = [...list.slice(1).map((r) => r.t), state.sutki.end];
  const hOf = (t) => apparentSolarTime(t, lon);
  shift = 12 - hOf(state.sutki.start);

  // части суток: светлые — день, тёмные — ночь
  const parts = el('g', {}, svg);
  list.forEach((r, i) => {
    const d = wedge(hOf(r.t), hOf(ends[i]));
    if (d) el('path', { d, class: `wedge p-${r.id}` }, parts);
  });
  el('circle', { r: R, class: 'rim' }, svg);

  // мелкие доли внутри частей (неравные: каждая часть делится на свои доли)
  const subs = el('g', {}, svg);
  list.forEach((r, i) => {
    const n = subdivisionsOf(r.id, names.subdivisions);
    const s = span(hOf(r.t), hOf(ends[i]));
    for (let j = 1; j < n; j++) {
      const h = hOf(r.t) + (s * j) / n;
      const [x1, y1] = point(h, R_TICK);
      const [x2, y2] = point(h, R);
      el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: 'sub' }, subs);
    }
  });

  // рубежи; слившиеся в одну точку подписываются вместе
  const marks = el('g', {}, svg);
  const groups = [];
  for (const r of list) {
    const h = hOf(r.t);
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.h - h) < 0.05) last.ids.push(r.id);
    else groups.push({ h, ids: [r.id] });
  }
  for (const g of groups) {
    const [x2, y2] = point(g.h, R);
    const horizon = g.ids.includes('I') || g.ids.includes('V');
    el('line', { x1: 0, y1: 0, x2: f(x2), y2: f(y2), class: horizon ? 'edge horizon' : 'edge' }, marks);
    const [tx, ty] = point(g.h, R_LABEL);
    const label = g.ids.length > 1 ? `${g.ids[0]}–${g.ids[g.ids.length - 1]}` : g.ids[0];
    el('text', { x: f(tx), y: f(ty), class: 'rnum', 'data-ids': g.ids.join(' ') }, marks).textContent = label;
  }

  // Луна: когда она над горизонтом в эти сутки, и её фаза в момент кульминации
  const mg = el('g', { class: 'moon-band' }, svg);
  for (const [a, b] of moon.up) {
    const h1 = hOf(a);
    const s = span(h1, hOf(b));
    const steps = Math.max(2, Math.ceil(s * 6));
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push(point(h1 + (s * i) / steps, R_MOON));
    el('path', { d: `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}`, class: 'moon-arc' }, mg);
  }
  const transit = moon.events.find((e) => e.type === 'transit');
  const glyphAt = transit ? transit.t : state.now;
  const ph = moonPhase(glyphAt);
  const [mx, my] = point(hOf(glyphAt), R_MOON);
  moonGlyph(mg, mx, my, 8, ph);

  // стрелка-тень и гномон
  el('polygon', { id: 'shadow', class: 'shadow' }, svg);
  el('circle', { r: 7, class: 'gnomon' }, svg);
}

function moonGlyph(parent, cx, cy, r, { illumination, waxing }) {
  el('circle', { cx: f(cx), cy: f(cy), r, class: 'moon-dark' }, parent);
  if (illumination < 0.01) return;
  const k = Math.abs(1 - 2 * illumination) * r;      // полуось терминатора
  const crescent = illumination < 0.5;
  const side = waxing ? 1 : 0;                        // в северном полушарии растущая освещена справа
  const term = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  const d = `M${f(cx)},${f(cy - r)}A${r},${r} 0 0 ${side} ${f(cx)},${f(cy + r)}`
    + `A${f(k)},${r} 0 0 ${term} ${f(cx)},${f(cy - r)}Z`;
  el('path', { d, class: 'moon-lit' }, parent);
}

function moveShadow(now) {
  const shadow = $('shadow');
  if (!shadow) return;
  const h = apparentSolarTime(now, place.lon);
  const [tx, ty] = point(h, R - 4);
  const a = ((h + shift) / 24) * 2 * Math.PI;
  const w = 6;
  const [px, py] = [Math.cos(a) * w, Math.sin(a) * w]; // перпендикуляр к стрелке
  const [bx, by] = point(h, -14);
  shadow.setAttribute('points', [
    [bx + px, by + py], [f(tx), f(ty)], [bx - px, by - py],
  ].map((p) => p.map((v) => f(+v)).join(',')).join(' '));
  $('dial').querySelectorAll('.rnum').forEach((t) => {
    t.classList.toggle('current', t.dataset.ids.split(' ').includes(state.current.id));
  });
}

/* ---------- текст ---------- */

function renderText() {
  const part = partAfter(state.part);
  const q = quarterById(state.quarter);
  const nextR = rubezh(state.next.id);
  $('part-kp').textContent = word(part);
  $('part-anbur').textContent = anbur(word(part));
  $('part-ru').textContent = part.gloss;
  document.body.dataset.quarter = state.quarter;
  $('quarter').textContent = `Четверть ${word(q)} — ${q.ru}, сторона света — ${q.direction}.`;
  $('next-label').textContent = `Следующий рубеж — ${word(nextR)} (${nextR.ru.toLowerCase()}), через`;
  document.title = `${word(part)} — Шонді`;

  const fmt = civilFormat(place.tz, false);
  renderMoon(fmt);
  const ol = $('rubezhi');
  ol.replaceChildren();
  for (const r of state.sutki.rubezhi) {
    const info = rubezh(r.id);
    const li = document.createElement('li');
    if (r.t <= state.now) li.classList.add('past');
    if (r === state.current || (r.id === state.current.id && r.t === state.current.t)) li.classList.add('current');
    if (r.merged) li.classList.add('merged');
    li.innerHTML = '<span class="id"></span><span class="kp"><span class="w"></span> <span class="a anbur" aria-hidden="true"></span><span class="ru"></span></span><span class="t"></span>';
    li.querySelector('.id').textContent = r.id;
    li.querySelector('.w').textContent = word(info);
    li.querySelector('.a').textContent = anbur(word(info));
    li.querySelector('.ru').textContent = `${info.ru}: ${info.oldBelievers.toLowerCase()}, ${info.muslims.toLowerCase()}`;
    li.querySelector('.t').textContent = fmt.format(r.t);
    ol.append(li);
  }
}

function renderMoon(fmt) {
  const ph = moonPhase(state.now);
  const pct = Math.round(ph.illumination * 100);
  let kp = '';
  if (ph.phase === 'первая четверть' || ph.phase === 'последняя четверть') kp = ' Джынтӧлісь — полумесяц.';
  else if (!ph.waxing && ph.phase !== 'новолуние') kp = ' Тӧлісьыс рытйӧ — луна на ущербе.';
  const names = { rise: 'восход', transit: 'кульминация', set: 'заход' };
  const ev = moon.events.map((e) => `${names[e.type]} ${fmt.format(e.t)}`).join(', ');
  $('moon').textContent = `Тӧлісь: ${ph.phase}, освещено ${pct} %.${kp}`;
  $('moon-times').textContent = ev
    ? `В эти сутки: ${ev}.`
    : (moon.up.length ? 'В эти сутки Луна не заходит.' : 'В эти сутки Луна не восходит.');
}

function tick() {
  const now = Date.now();
  if (!state || now >= state.next.t) {
    recompute();
    return;
  }
  $('civil').textContent = civilFormat(place.tz, true).format(now);
  $('civil-tz').textContent = `${place.name}, ${utcOffsetLabel(place.tz, now)}`;
  $('solar').textContent = hms(apparentSolarTime(now, place.lon));
  $('next-in').textContent = duration(state.next.t - now);
  moveShadow(now);
  const sub = subdivisionAt(now, state.current, state.next, names.subdivisions);
  $('sub').textContent = `доля ${sub.index} из ${sub.of}`;
}

function recompute() {
  if (!place || !names) return;
  state = stateAt(Date.now(), place);
  moon = moonEvents(state.sutki.start, state.sutki.end, place.lat, place.lon);
  drawDial();
  renderText();
  tick();
}

/* ---------- запуск ---------- */

async function start() {
  try {
    await loadData();
  } catch {
    $('status').textContent = 'Не удалось загрузить данные календаря. Обновите страницу.';
    return;
  }
  document.querySelectorAll('input[name="dialect"]').forEach((r) => {
    r.checked = r.value === dialect;
    r.addEventListener('change', () => {
      dialect = r.value;
      store.set('dialect', dialect);
      renderText();
    });
  });
  $('locate').addEventListener('click', locate);
  fillPlaces();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recompute(); });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
