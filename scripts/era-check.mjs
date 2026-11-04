// Проверка календарной системы на эре Слова (годы 1025–1536, дек. 1860 – дек. 2372).
// Вариант Б: дата месяца — дневная часть суток (сутки начинаются накануне на закате),
// длины 44-45-45-45-48-46-46(+1)-46, счёт по руке (4/128), лишний день в Сире.
import { readFileSync } from 'node:fs';
import { DAY_MS, altitudeCrossing, rubezhiForDay, ORDER } from '../engine/index.js';

const { places } = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url)));
const RAD = Math.PI / 180;
const LEN = [44, 45, 45, 45, 48, 46, 46, 46];
const NAMES = ['Ур', 'Ош', 'Дозмӧр', 'Вӧрмӧс', 'Чужмӧр', 'Юсь', 'Сир', 'Кӧч'];
const isLeap = (n) => n % 4 === 0 && n % 128 !== 0;
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
const fmt = (k) => new Date(k * DAY_MS).toISOString().slice(0, 10);

// Начало года n (дневная дата Ур ӧти, номер дня от 1970-01-01); 1190 → 21.12.2025.
const startCache = { 1190: dayNum(2025, 12, 21) };
function yearStart(n) {
  if (startCache[n] !== undefined) return startCache[n];
  let k = startCache[1190];
  if (n < 1190) for (let i = n; i < 1190; i++) k -= isLeap(i) ? 366 : 365;
  else for (let i = 1190; i < n; i++) k += isLeap(i) ? 366 : 365;
  return (startCache[n] = k);
}
function monthStarts(n) {
  const s = [yearStart(n)];
  for (let i = 0; i < 8; i++) s.push(s[i] + LEN[i] + (i === 6 && isLeap(n) ? 1 : 0));
  return s; // 9 значений: начала 8 месяцев и начало следующего года
}
const monthOf = (k, s) => { for (let i = 0; i < 8; i++) if (k >= s[i] && k < s[i + 1]) return i; return -1; };

// Видимая долгота Солнца (как в engine/sun.js)
function lambda(ms) {
  const T = (ms / DAY_MS + 2440587.5 - 2451545.0) / 36525;
  const L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
  const C = Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M) * (0.019993 - 0.000101 * T) + Math.sin(3 * M) * 0.000289;
  const om = (125.04 - 1934.136 * T) * RAD;
  return (((L0 + C - 0.00569 - 0.00478 * Math.sin(om)) % 360) + 360) % 360;
}
function crossing(deg, aroundMs) { // ближайший к aroundMs момент, когда λ = deg
  const d = (ms) => ((lambda(ms) - deg + 540) % 360) - 180;
  let a = aroundMs - 20 * DAY_MS, b = aroundMs + 20 * DAY_MS;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (d(m) < 0) a = m; else b = m; }
  return (a + b) / 2;
}
// Дневная дата суток (сутки с заката), в которые попадает момент ms в точке p
function sutkiDate(ms, p) {
  const k = Math.floor((ms + p.lon / 15 * 3600000) / DAY_MS);
  const set = altitudeCrossing(k, p.lat, p.lon, -0.833, +1).t;
  return ms >= set ? k + 1 : k;
}

// ---------- 1. Точки Солнца по всем местам ----------
const approx = [[12, 21], [2, 4], [3, 20], [5, 5], [6, 21], [8, 7], [9, 23], [11, 7]];
const fails = {}; const dayOfMonth = NAMES.map(() => ({}));
let checks = 0; let solsticeNight1 = 0, solsticeTotal = 0;
for (let n = 1025; n <= 1536; n++) {
  const s = monthStarts(n);
  const y0 = new Date(s[0] * DAY_MS).getUTCFullYear();
  const moments = approx.map(([m, d], i) => crossing((270 + 45 * i) % 360, Date.UTC(i === 0 ? y0 : y0 + 1, m - 1, d, 12)));
  for (const p of places) {
    moments.forEach((ms, i) => {
      const k = sutkiDate(ms, p); checks++;
      const mo = monthOf(k, s);
      if (mo !== i) { const key = `${NAMES[i]} @ ${p.name}`; (fails[key] ??= []).push(n); }
      if (p.id === 'kudymkar') dayOfMonth[i][k - s[i] + 1] = (dayOfMonth[i][k - s[i] + 1] || 0) + 1;
      if (i === 0) { solsticeTotal++; if (k === s[0]) solsticeNight1++; }
    });
  }
}
console.log('Проверок точек Солнца:', checks, 'мест:', places.length);
console.log('Выпадения:', Object.keys(fails).length ? fails : 'нет');
console.log('День месяца, на который приходится точка (Кудымкар):');
NAMES.forEach((nm, i) => console.log(' ', nm, JSON.stringify(dayOfMonth[i])));
console.log('Солнцестояние в Ур ӧти:', solsticeNight1, 'из', solsticeTotal);

// ---------- 2. Православные праздники (юлианский календарь) ----------
function julianToDayNum(y, m, d) { // юлианская дата → номер дня
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
  return jdn - 2440588;
}
function julianEaster(y) { // Мейс, юлианская Пасха
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return julianToDayNum(y, month, day);
}
const fixed = [
  ['Куття-вун / Сочельник', 12, 24, -1], ['Рождество', 12, 25, -1], ['Крещение', 1, 6, 0], ['Сретение', 2, 2, 0],
  ['Благовещение', 3, 25, 0], ['Егорий вешний', 4, 23, 0], ['Никола вешний', 5, 9, 0], ['Иван Купала', 6, 24, 0],
  ['Петров день', 6, 29, 0], ['Ильин день', 7, 20, 0], ['Медовый Спас', 8, 1, 0], ['Яблочный Спас', 8, 6, 0],
  ['Хлебный Спас', 8, 16, 0], ['Покров', 10, 1, 0], ['Казанская', 10, 22, 0], ['Михайлов день', 11, 8, 0],
  ['Никола зимний', 12, 6, 0],
];
const feastMonths = {};
for (let n = 1025; n <= 1536; n++) {
  const s = monthStarts(n);
  const y1 = new Date(s[0] * DAY_MS).getUTCFullYear() + 1; // гражданский год, на который приходится основная часть
  for (const [nm, m, d, off] of fixed) {
    const k = julianToDayNum(y1 + off, m, d);
    let mo = monthOf(k, s);
    if (mo < 0) { // праздник может лечь в соседний год календаря — проверяем по году, в котором он есть
      continue;
    }
    (feastMonths[nm] ??= {})[NAMES[mo]] = ((feastMonths[nm] ??= {})[NAMES[mo]] || 0) + 1;
  }
  const easter = julianEaster(y1);
  const moveable = [['Масленица (начало)', -56], ['Пасха', 0], ['Семик (чт до Троицы)', 46], ['Троица', 49]];
  for (const [nm, off] of moveable) {
    const mo = monthOf(easter + off, s);
    (feastMonths[nm] ??= {})[NAMES[mo]] = ((feastMonths[nm] ??= {})[NAMES[mo]] || 0) + 1;
  }
}
console.log('\nПраздники по месяцам (число лет из 512):');
for (const [nm, v] of Object.entries(feastMonths)) console.log(' ', nm.padEnd(22), JSON.stringify(v));
// Даты на 2026 год (1190)
{
  const s = monthStarts(1190);
  console.log('\nНачала месяцев 1190 (2025/26):', s.slice(0, 8).map((k, i) => `${NAMES[i]} ${fmt(k)}`).join(', '));
  const e = julianEaster(2026); console.log('Пасха 2026:', fmt(e), 'Троица:', fmt(e + 49));
}

// ---------- 3. Деление суток во всей эре ----------
let bad = 0, days = 0, asrMin = Infinity;
for (const y of [1861, 1900, 1950, 2000, 2026, 2050, 2100, 2150, 2200, 2250, 2300, 2372]) {
  const k0 = dayNum(y, 1, 1);
  for (const p of places) for (let k = k0; k < k0 + 365; k++) {
    const list = rubezhiForDay(k, p.lat, p.lon); days++;
    const ok = list.map((x) => x.id).join() === ORDER.join() && list.every((x, i) => i === 0 || x.t >= list[i - 1].t);
    if (!ok) bad++;
    const r = Object.fromEntries(list.map((x) => [x.id, x.t]));
    asrMin = Math.min(asrMin, (r.I - r.VIII) / 60000);
  }
}
console.log(`\nСутки: проверено ${days} суток (12 лет эры × ${places.length} мест), нарушений порядка рубежей: ${bad}; мин. от асра до заката: ${asrMin.toFixed(0)} мин`);
