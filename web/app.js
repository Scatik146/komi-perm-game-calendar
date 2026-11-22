import {
  stateAt, apparentSolarTime, subdivisionsOf, subdivisionAt, moonEvents, moonPhase, makeTransliterator,
  SUTKI_ORDER, numberSign, prochestNastrojku, zapisatNastrojku, vybratRezhim, vybratSloi,
  sutkiNamaza, sleduyushcheeSobytie, tekushcheeSobytie, sutkiZmanim,
} from './engine/index.js';

/** Знак-пас рубежа: рубежи считаются от заката — I = 1 … VIII = 8. */
const pasOf = (id) => numberSign(SUTKI_ORDER.indexOf(id) + 1);

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
let rezhimy = null;
let nastrojka = null;
let namazy = null;     // data/namaz.json: названия шести времён
let sutkiN = null;     // сутки намаза: { start, end, sobytiya, stupen }
let zmanimy = null;    // data/zmanim.json: названия зманим
let sutkiZ = null;     // сутки зманим: { start, end, sobytiya, zalivka, zameny, vid } или null

/* ---------- данные ---------- */

async function loadData() {
  const [p, n, a, rz, nz, zm] = await Promise.all([
    fetch('data/places.json').then((r) => r.json()),
    fetch('data/names.json').then((r) => r.json()),
    fetch('data/anbur.json').then((r) => r.json()),
    fetch('data/rezhimy.json').then((r) => r.json()),
    fetch('data/namaz.json').then((r) => r.json()),
    fetch('data/zmanim.json').then((r) => r.json()),
  ]);
  zmanimy = zm;
  rezhimy = rz;
  namazy = nz;
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
const R_LABEL = 198;  // подписи рубежей (знаки-пасы)

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

// drawDialIgrovoj: игровой циферблат — восемь частей суток, доли, рубежи, Луна
function drawDialIgrovoj(svg) {
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
    const label = g.ids.length > 1 ? `${pasOf(g.ids[0])}–${pasOf(g.ids[g.ids.length - 1])}` : pasOf(g.ids[0]);
    const roman = g.ids.length > 1 ? `${g.ids[0]}–${g.ids[g.ids.length - 1]}` : g.ids[0];
    const tx2 = el('text', { x: f(tx), y: f(ty), class: 'rnum pas', 'data-ids': g.ids.join(' ') }, marks);
    tx2.textContent = label;
    el('title', {}, tx2).textContent = `Рубеж ${roman}`;
  }

  drawMoon(svg, hOf);
  drawGnomon(svg);
}

// dugaLuny: дуга на полосе Луны от a до b (мс)
function dugaLuny(mg, hOf, a, b) {
  const h1 = hOf(a);
  const s = span(h1, hOf(b));
  const steps = Math.max(2, Math.ceil(s * 6));
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(point(h1 + (s * i) / steps, R_MOON));
  el('path', { d: `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}`, class: 'moon-arc' }, mg);
}

// drawMoon: полоса Луны над горизонтом в эти сутки и её фаза в кульминацию
function drawMoon(svg, hOf) {
  const mg = el('g', { class: 'moon-band' }, svg);
  for (const [a, b] of moon.up) dugaLuny(mg, hOf, a, b);
  const transit = moon.events.find((e) => e.type === 'transit');
  const glyphAt = transit ? transit.t : state.now;
  const [mx, my] = point(hOf(glyphAt), R_MOON);
  moonGlyph(mg, mx, my, 8, moonPhase(glyphAt));
}

// drawGnomon: стрелка-тень и гномон
function drawGnomon(svg) {
  el('polygon', { id: 'shadow', class: 'shadow' }, svg);
  el('circle', { r: 7, class: 'gnomon' }, svg);
}

// musulmanskij: включён ли режим «Мусульманские»
function musulmanskij() {
  return Boolean(nastrojka) && nastrojka.rezhim === 'musulmanskij';
}

// evrejskij: включён ли режим «Еврейские» и есть ли в этом месте закат и восход
function evrejskij() {
  return Boolean(nastrojka) && nastrojka.rezhim === 'evrejskij' && sutkiZ !== null;
}

let opisIgrovoj = null;   // описание игрового круга для читалок (из index.html)

// VIEWBOX_OBYCHNYJ, VIEWBOX_ZMANIM: поле круга; у зманим шире — для второго круга подписей снаружи
const VIEWBOX_OBYCHNYJ = '-222 -222 444 444';
const VIEWBOX_ZMANIM = '-262 -262 524 524';
const VIEWBOX_ZMANIM_UZKIJ = '-236 -236 472 472';

// UZKIJ_EKRAN: на телефоне на круге подписаны только главные времена — крупнее
const UZKIJ_EKRAN = window.matchMedia('(max-width: 520px)');

// drawDial: очистить круг и нарисовать циферблат выбранного режима
function drawDial() {
  const svg = $('dial');
  svg.querySelectorAll(':scope > :not(desc)').forEach((n) => n.remove());
  svg.setAttribute('viewBox', VIEWBOX_OBYCHNYJ);
  svg.classList.remove('uzkij');
  if (opisIgrovoj === null) opisIgrovoj = $('dial-desc').textContent;
  $('dial-desc').textContent = opisIgrovoj;
  if (musulmanskij()) drawDialNamaz(svg);
  else if (evrejskij()) drawDialZmanim(svg);
  else drawDialIgrovoj(svg);
}

/* ---------- циферблат «Мусульманские»: сутки от магриба (заката) наверху ---------- */

const R_NAMAZ = 190;   // подписи времён намаза

// namazPoId: название времени намаза по id (data/namaz.json)
function namazPoId(id) {
  return namazy.vremena.find((v) => v.id === id);
}

// konecSobytiya: момент, когда кончается время события i (начало следующего или конец суток)
function konecSobytiya(i) {
  const sleduyushchee = sutkiN.sobytiya[i + 1];
  return sleduyushchee ? sleduyushchee.t : sutkiN.end;
}

// sektoryNamaza: светлый день, тёмная ночь и зелёные секторы времён намаза
function sektoryNamaza(svg, hOf) {
  const shuruk = sutkiN.sobytiya.find((s) => s.id === 'shuruk').t;
  const g = el('g', {}, svg);
  el('path', { d: wedge(hOf(sutkiN.start), hOf(shuruk)), class: 'n-noch' }, g);
  el('path', { d: wedge(hOf(shuruk), hOf(sutkiN.end)), class: 'n-den' }, g);
  sutkiN.sobytiya.forEach((s, i) => {
    const vid = namazPoId(s.id).namaz ? (s.t < shuruk ? 'noch' : 'den') : 'pusto';
    el('path', { d: wedge(hOf(s.t), hOf(konecSobytiya(i))), class: `n-sektor ${vid}` }, g);
  });
  el('circle', { r: R, class: 'rim' }, svg);
}

// podpisNamaza: черта и подпись «русский — крупно, арабский — ниже» у начала времени
function podpisNamaza(g, s, h, r) {
  const [x2, y2] = point(h, R);
  const kraj = s.id === 'magrib' || s.id === 'shuruk';
  el('line', { x1: 0, y1: 0, x2: f(x2), y2: f(y2), class: kraj ? 'n-edge horizon' : 'n-edge' }, g);
  const [tx, ty] = point(h, r);
  const nazv = namazPoId(s.id);
  const podpis = el('g', { class: 'rnum n-podpis', 'data-ids': s.id }, g);
  el('text', { x: f(tx), y: f(ty - 2), class: 'n-ru' }, podpis).textContent = nazv.ru;
  el('text', { x: f(tx), y: f(ty + 12), class: 'n-ar', lang: 'ar' }, podpis).textContent = nazv.ar;
}

// podpisiNamaza: подписи всех времён; близкие подписи — через одну внутрь круга
function podpisiNamaza(svg, hOf) {
  const g = el('g', {}, svg);
  let proshloe = null;
  let vnutr = false;
  for (const s of sutkiN.sobytiya) {
    const h = hOf(s.t);
    vnutr = proshloe !== null && span(proshloe, h) < 0.8 && !vnutr;
    podpisNamaza(g, s, h, vnutr ? R_NAMAZ - 44 : R_NAMAZ);
    proshloe = h;
  }
}

// drawDialNamaz: циферблат суток намаза — магриб наверху, по часовой стрелке
function drawDialNamaz(svg) {
  const hOf = (t) => apparentSolarTime(t, place.lon);
  shift = 12 - hOf(sutkiN.start);
  sektoryNamaza(svg, hOf);
  podpisiNamaza(svg, hOf);
  drawMoon(svg, hOf);
  drawGnomon(svg);
}

/* ---------- циферблат «Еврейские»: сутки от заката (шкии) наверху ---------- */

// zmanPoId: название времени по id (data/zmanim.json)
function zmanPoId(id) {
  return zmanimy.vremena.find((v) => v.id === id);
}

// konecZmana: когда кончается промежуток от времени i (следующее время или конец суток)
function konecZmana(i) {
  const sleduyushchee = sutkiZ.sobytiya[i + 1];
  return sleduyushchee ? sleduyushchee.t : sutkiZ.end;
}

// sektoryZmanim: день и ночь, заливка субботы и праздника, синие промежутки молитв
function sektoryZmanim(svg, hOf) {
  const nec = sutkiZ.sobytiya.find((s) => s.id === 'nec');
  const voshod = nec ? nec.t : sutkiZ.end;
  const g = el('g', {}, svg);
  el('path', { d: wedge(hOf(sutkiZ.start), hOf(voshod)), class: 'n-noch' }, g);
  el('path', { d: wedge(hOf(voshod), hOf(sutkiZ.end)), class: 'n-den' }, g);
  for (const z of sutkiZ.zalivka) el('path', { d: wedge(hOf(z.ot), hOf(z.do)), class: 'z-shabbat' }, g);
  sutkiZ.sobytiya.forEach((s, i) => {
    const vid = zmanPoId(s.id).molitva ? (s.t < voshod ? 'noch' : 'den') : 'pusto';
    el('path', { d: wedge(hOf(s.t), hOf(konecZmana(i))), class: `z-sektor ${vid}` }, g);
  });
  el('circle', { r: R, class: 'rim' }, svg);
}

// chertaZmana: черта от центра к краю круга; закат и восход — цветом горизонта
function chertaZmana(g, s, h) {
  const [x2, y2] = point(h, R);
  const kraj = s.id === 'shkia' || s.id === 'nec';
  el('line', { x1: 0, y1: 0, x2: f(x2), y2: f(y2), class: kraj ? 'z-edge horizon' : 'z-edge' }, g);
}

// yakor: снаружи подпись растёт от круга — справа вправо, слева влево, сверху и снизу — по середине
function yakor(h, r) {
  const [x] = point(h, r);
  let storona = 'seredina';
  if (r > R && x > 20) storona = 'vpravo';
  if (r > R && x < -20) storona = 'vlevo';
  return storona;
}

// vynoska: продолжение черты за круг — почти до подписи снаружи
function vynoska(g, h, r) {
  const [x1, y1] = point(h, R + 2);
  const [x2, y2] = point(h, r - 3);
  el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: 'z-vynoska' }, g);
}

// fonPodpisi: на чём стоит подпись — снаружи круга, на светлом дне или на тёмной ночи
function fonPodpisi(s, r) {
  const nec = sutkiZ.sobytiya.find((x) => x.id === 'nec');
  let fon = 'snaruzhi';
  if (r < R) fon = nec && s.t >= nec.t ? 'na-dne' : 'na-nochi';
  return fon;
}

// podpisZmana: подпись «русский — крупно, иврит — ниже» на радиусе r
function podpisZmana(g, s, h, r) {
  const [tx, ty] = tochkaPodpisi(h, r);
  const nazv = zmanPoId(s.id);
  if (r > R) vynoska(g, h, r);
  const podpis = el('g', { class: `rnum z-podpis ${fonPodpisi(s, r)} ${yakor(h, r)}`, 'data-ids': s.id }, g);
  el('text', { x: f(tx), y: f(ty - 2), class: 'z-ru' }, podpis).textContent = nazv.kratko;
  el('text', { x: f(tx), y: f(ty + 12), class: 'z-he', lang: 'he' }, podpis).textContent = nazv.heKratko;
}

// UROVNI_ZMANIM: радиусы подписей по очереди — снаружи, дальше снаружи, внутри, ближе к центру
const UROVNI_ZMANIM = [R + 20, R + 52, R - 46, R - 86];

// GRANICA_ZMANIM: подпись не выходит за поле круга
const GRANICA_ZMANIM = 258;

// tochkaPodpisi: где стоит подпись времени на радиусе r (сверху и снизу снаружи — чуть дальше)
function tochkaPodpisi(h, r) {
  const tochka = point(h, r > R && yakor(h, r) === 'seredina' ? r + 12 : r);
  return tochka;
}

// ramkaPodpisi: прямоугольник подписи { x, y, w, h } — центр и размер, по длине русской строки
function ramkaPodpisi(s, h, r) {
  const [tx, ty] = tochkaPodpisi(h, r);
  const k = UZKIJ_EKRAN.matches ? 1.3 : 1;
  const w = (zmanPoId(s.id).kratko.length * 8 + 6) * k;
  const sdvig = { vpravo: w / 2, vlevo: -w / 2, seredina: 0 }[yakor(h, r)];
  return { x: tx + sdvig, y: ty + 5, w, h: 30 * k };
}

// mestoSvobodno: рамка в поле круга и не задевает уже поставленные подписи
function mestoSvobodno(ramka, postavleny) {
  const vPole = Math.abs(ramka.x) + ramka.w / 2 <= GRANICA_ZMANIM && Math.abs(ramka.y) + ramka.h / 2 <= GRANICA_ZMANIM;
  const peresekaet = (d) => Math.abs(d.x - ramka.x) < (d.w + ramka.w) / 2 && Math.abs(d.y - ramka.y) < (d.h + ramka.h) / 2;
  return vPole && !postavleny.some(peresekaet);
}

// svobodnyjRadius: первый радиус по очереди, где подписи есть место; null — места нет
function svobodnyjRadius(s, h, postavleny) {
  const r = UROVNI_ZMANIM.find((x) => mestoSvobodno(ramkaPodpisi(s, h, x), postavleny));
  return r === undefined ? null : r;
}

// naKruge: подписывать ли время на циферблате (на узком экране — только главные)
function naKruge(nazv) {
  return nazv.naKruge && (!UZKIJ_EKRAN.matches || Boolean(nazv.glavnoe));
}

// podpisiZmanim: подписи времён; где тесно — дальше наружу или ближе к центру, где совсем тесно — только черта
function podpisiZmanim(svg, hOf) {
  const g = el('g', {}, svg);
  const postavleny = [];
  for (const s of sutkiZ.sobytiya.filter((x) => naKruge(zmanPoId(x.id)))) {
    const h = hOf(s.t);
    const r = svobodnyjRadius(s, h, postavleny);
    chertaZmana(g, s, h);
    if (r !== null) postavleny.push(ramkaPodpisi(s, h, r));
    if (r !== null) podpisZmana(g, s, h, r);
  }
}

// drawDialZmanim: циферблат суток зманим — закат наверху, по часовой стрелке
function drawDialZmanim(svg) {
  const hOf = (t) => apparentSolarTime(t, place.lon);
  shift = 12 - hOf(sutkiZ.start);
  svg.setAttribute('viewBox', UZKIJ_EKRAN.matches ? VIEWBOX_ZMANIM_UZKIJ : VIEWBOX_ZMANIM);
  svg.classList.toggle('uzkij', UZKIJ_EKRAN.matches);
  sektoryZmanim(svg, hOf);
  podpisiZmanim(svg, hOf);
  drawMoon(svg, hOf);
  drawGnomon(svg);
}

// tekushcheeId: id текущего времени выбранного режима — для подсветки на круге
function tekushcheeId(now) {
  let id = state.current.id;
  if (musulmanskij()) id = tekushcheeSobytie(sutkiN, now).id;
  if (evrejskij()) id = tekushcheeSobytie(sutkiZ, now).id;
  return id;
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
  const tekushchij = tekushcheeId(now);
  $('dial').querySelectorAll('.rnum').forEach((t) => {
    t.classList.toggle('current', t.dataset.ids.split(' ').includes(tekushchij));
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
  document.title = `${word(part)} — Солнечные часы`;

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
    li.innerHTML = '<span class="id"><span class="pas" aria-hidden="true"></span> <span class="rom"></span></span><span class="kp"><span class="w"></span> <span class="a anbur" aria-hidden="true"></span><span class="ru"></span></span><span class="t"></span>';
    li.querySelector('.id .pas').textContent = pasOf(r.id);
    li.querySelector('.id .rom').textContent = r.id;
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

/* ---------- текст: режим «Мусульманские» ---------- */

const STUPENI = {
  1: '',
  2: 'Солнце не опускается на 18° или 17°: фаджр и иша — долей ночи, как на широте 45° (правило ЦДУМ).',
  3: 'Полярный день или полярная ночь: все времена — как на широте 45° той же долготы (правило ЦДУМ).',
};

// strokaNamaza: строка списка — русское название, арабское, пояснение, время
function strokaNamaza(s, fmt, tekushchij) {
  const nazv = namazPoId(s.id);
  const li = document.createElement('li');
  li.classList.toggle('current', s.id === tekushchij);
  li.classList.toggle('past', s.t <= state.now);
  li.innerHTML = '<span><span class="nazv"></span><span lang="ar" dir="rtl"></span><span class="ru"></span></span><span class="t"></span>';
  li.querySelector('.nazv').textContent = nazv.ru;
  li.querySelector('[lang="ar"]').textContent = nazv.ar;
  li.querySelector('.ru').textContent = nazv.poyasnenie;
  li.querySelector('.t').textContent = fmt.format(s.t);
  return li;
}

// renderNamaz: текущее время намаза, список этих суток, ступень правила и источник
function renderNamaz() {
  const fmt = civilFormat(place.tz, false);
  const tekushchij = tekushcheeSobytie(sutkiN, state.now).id;
  const nazv = namazPoId(tekushchij);
  $('namaz-sejchas').innerHTML = '<span></span><span lang="ar" dir="rtl"></span>';
  $('namaz-sejchas').firstChild.textContent = `Сейчас: ${nazv.ru}`;
  $('namaz-sejchas').lastChild.textContent = nazv.ar;
  $('namazy').replaceChildren(...sutkiN.sobytiya.map((s) => strokaNamaza(s, fmt, tekushchij)));
  $('namaz-stupen').textContent = STUPENI[sutkiN.stupen];
  $('namaz-istochnik').textContent = `Время — ${namazy.istochnik}, для любого места.`;
  $('dial-desc').textContent = 'Круг суток намаза: начало суток — магриб (закат) — сверху, дальше по часовой стрелке. Светлое поле — день, тёмное — ночь, зелёные секторы — время намазов. Стрелка-тень указывает на текущее время.';
  renderMoon(fmt);
  document.title = `${nazv.ru} — Солнечные часы`;
}

/* ---------- текст: режим «Еврейские» ---------- */

// nadpisIshoda: исход субботы, исход праздника или «свечи второго дня — не раньше»
function nadpisIshoda() {
  const vid = sutkiZ.vid.segodnya;
  let nadpis = zmanimy.ishodNadpisi.prazdnik;
  if (vid.shabbat) nadpis = zmanimy.ishodNadpisi.shabbat;
  if (vid.svechiPosleIshoda) nadpis = zmanimy.ishodNadpisi.svechiPosle;
  return nadpis;
}

// nazvanieZmana: русское название времени (у исхода — по виду дня)
function nazvanieZmana(id) {
  let ru = zmanPoId(id).ru;
  if (id === 'ishod') ru = nadpisIshoda();
  return ru;
}

// vSvyatoe: момент t — внутри субботы или праздника
function vSvyatoe(t) {
  return sutkiZ.zalivka.some((z) => t >= z.ot && t < z.do);
}

// strokaZmana: строка списка — русское название, иврит, пояснение, время
function strokaZmana(s, fmt, tekushchij) {
  const nazv = zmanPoId(s.id);
  const li = document.createElement('li');
  li.classList.toggle('current', s.id === tekushchij);
  li.classList.toggle('past', s.t <= state.now);
  li.classList.toggle('svyatoj', vSvyatoe(s.t));
  li.innerHTML = '<span><span class="nazv"></span><span lang="he" dir="rtl"></span><span class="ru"></span></span><span class="t"></span>';
  li.querySelector('.nazv').textContent = nazvanieZmana(s.id);
  li.querySelector('[lang="he"]').textContent = nazv.he;
  li.querySelector('.ru').textContent = nazv.poyasnenie;
  li.querySelector('.t').textContent = fmt.format(s.t);
  return li;
}

// tekstShabbata: «Идёт суббота» / «Идёт праздник» или пусто
function tekstShabbata() {
  let tekst = '';
  if (vSvyatoe(state.now)) tekst = 'Идёт суббота или праздник.';
  return tekst;
}

// renderZmanim: текущее время, список этих суток, замены летом и источник
function renderZmanim() {
  const fmt = civilFormat(place.tz, false);
  const tekushchij = tekushcheeSobytie(sutkiZ, state.now).id;
  $('zmanim-sejchas').innerHTML = '<span></span><span lang="he" dir="rtl"></span>';
  $('zmanim-sejchas').firstChild.textContent = `Сейчас: ${nazvanieZmana(tekushchij)}`;
  $('zmanim-sejchas').lastChild.textContent = zmanPoId(tekushchij).he;
  $('zmanim-shabbat').textContent = tekstShabbata();
  $('zmanim').replaceChildren(...sutkiZ.sobytiya.map((s) => strokaZmana(s, fmt, tekushchij)));
  $('zmanim-zameny').textContent = sutkiZ.zameny.map((id) => zmanimy.zameny[id]).join(' ');
  $('zmanim-istochnik').textContent = `Время — ${zmanimy.istochnik}, для любого места.`;
  $('dial-desc').textContent = 'Круг еврейских суток: начало суток — закат — сверху, дальше по часовой стрелке. Светлое поле — день, тёмное — ночь, синие секторы — время молитв, голубая заливка — суббота или праздник. Стрелка-тень указывает на текущее время.';
  renderMoon(fmt);
  document.title = `${nazvanieZmana(tekushchij)} — Солнечные часы`;
}

// renderBezZmanim: в полярный день или ночь зманим по «часам времени» не считаются
function renderBezZmanim() {
  $('zmanim-sejchas').textContent = 'Здесь сейчас нет восхода или заката';
  $('zmanim-shabbat').textContent = '';
  $('zmanim').replaceChildren();
  $('zmanim-next-label').textContent = 'Зманим по методике chabad.org здесь не считаются; показан игровой круг.';
  $('zmanim-next-in').textContent = '';
  $('zmanim-zameny').textContent = '';
}

// sledZ: ближайшее время суток зманим или конец суток
function sledZ(now) {
  const s = sleduyushcheeSobytie(sutkiZ, now);
  const sled = s || { id: 'shkia', t: sutkiZ.end };
  return sled;
}

// tickZmanim: каждую секунду — сколько осталось до следующего времени
function tickZmanim(now) {
  const sled = sledZ(now);
  $('zmanim-next-label').textContent = `Следующее — ${nazvanieZmana(sled.id)}, через`;
  $('zmanim-next-in').textContent = duration(sled.t - now);
}

// sledN: ближайшее событие суток намаза или конец суток
function sledN(now) {
  const s = sleduyushcheeSobytie(sutkiN, now);
  const sled = s || { id: 'magrib', t: sutkiN.end };
  return sled;
}

// tickNamaz: каждую секунду — сколько осталось до следующего времени
function tickNamaz(now) {
  const sled = sledN(now);
  $('namaz-next-label').textContent = `Следующее — ${namazPoId(sled.id).ru}, через`;
  $('namaz-next-in').textContent = duration(sled.t - now);
}

// pora: пора ли пересчитать сутки (прошёл рубеж или время намаза)
function pora(now) {
  let nado = !state || now >= state.next.t;
  if (!nado && musulmanskij()) nado = !sutkiN || now >= sledN(state.now).t;
  if (!nado && evrejskij()) nado = now >= sledZ(state.now).t;
  return nado;
}

// tickRezhima: обратный отсчёт выбранного режима веры
function tickRezhima(now) {
  if (musulmanskij()) tickNamaz(now);
  if (evrejskij()) tickZmanim(now);
}

function tick() {
  const now = Date.now();
  if (pora(now)) {
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
  tickRezhima(now);
}

function recompute() {
  if (!place || !names) return;
  state = stateAt(Date.now(), place);
  moon = moonEvents(state.sutki.start, state.sutki.end, place.lat, place.lon);
  sutkiN = sutkiNamaza(state.now, place.lat, place.lon);
  sutkiZ = sutkiZmanim(state.now, place.lat, place.lon);
  drawDial();
  renderText();
  if (musulmanskij()) renderNamaz();
  if (evrejskij()) renderZmanim();
  if (nastrojka.rezhim === 'evrejskij' && sutkiZ === null) renderBezZmanim();
  tick();
}

/* ---------- настройка: режимы часов (данные — data/rezhimy.json) ---------- */

// punktVybora: строка выбора (переключатель или флажок) с пометкой «скоро» у неготового
function punktVybora(tip, imya, zapis, otmechen) {
  const label = document.createElement('label');
  const input = Object.assign(document.createElement('input'), { type: tip, name: imya, value: zapis.id });
  input.checked = otmechen;
  input.disabled = !zapis.gotov;
  const tekst = document.createElement('span');
  tekst.textContent = zapis.gotov ? zapis.ru : `${zapis.ru} — скоро`;
  label.append(input, tekst);
  return label;
}

// spisokRezhimov: переключатели режимов с пояснениями
function spisokRezhimov() {
  const mesto = $('rezhimy');
  mesto.replaceChildren();
  for (const r of rezhimy.rezhimy) {
    const punkt = punktVybora('radio', 'rezhim', r, r.id === nastrojka.rezhim);
    const poyasnenie = Object.assign(document.createElement('small'), { textContent: r.poyasnenie });
    punkt.append(poyasnenie);
    mesto.append(punkt);
  }
}

// spisokSloev: флажки слоёв комбо; работают только в режиме «Комбо»
function spisokSloev() {
  const mesto = $('sloi');
  mesto.replaceChildren();
  for (const s of rezhimy.sloiKombo) mesto.append(punktVybora('checkbox', 'sloy', s, nastrojka.sloi[s.id]));
  $('sloi-pole').disabled = nastrojka.rezhim !== 'kombo';
}

// sobratNastrojku: настройка из того, что отмечено в окне
function sobratNastrojku() {
  const otmechennyj = document.querySelector('input[name="rezhim"]:checked');
  const prosili = {};
  document.querySelectorAll('input[name="sloy"]').forEach((f) => { prosili[f.value] = f.checked; });
  const novaya = { rezhim: vybratRezhim(rezhimy, otmechennyj && otmechennyj.value), sloi: vybratSloi(rezhimy, prosili) };
  return novaya;
}

// primenitNastrojku: запомнить настройку и отметить режим на странице
function primenitNastrojku(novaya) {
  nastrojka = novaya;
  store.set('nastrojka', zapisatNastrojku(nastrojka));
  document.body.dataset.rezhim = nastrojka.rezhim;
  spisokSloev();
  recompute();
}

// podklyuchitNastrojku: прочесть сохранённое, заполнить окно, повесить события
function podklyuchitNastrojku() {
  nastrojka = prochestNastrojku(rezhimy, store.get('nastrojka'));
  document.body.dataset.rezhim = nastrojka.rezhim;
  spisokRezhimov();
  spisokSloev();
  $('nastrojka').addEventListener('change', () => primenitNastrojku(sobratNastrojku()));
  $('nastrojka-open').addEventListener('click', () => $('nastrojka').showModal());
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
  UZKIJ_EKRAN.addEventListener('change', recompute);
  podklyuchitNastrojku();
  fillPlaces();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recompute(); });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
