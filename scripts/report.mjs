// Таблицы для docs/raschety.md: длина дня и ночи, рубежи по сезонам.
import { readFileSync } from 'node:fs';
import { rubezhiForDay, DAY_MS, solarDayIndex } from '../engine/index.js';
const { places } = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url)));
const MIN = 60000;
const k0 = Math.floor(Date.UTC(2026, 0, 1) / DAY_MS);
const hm = (x) => { const m = Math.round(x); return `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, "0")} мин`; };
const rows = [];
for (const p of places) {
  let shortestNight = Infinity, merged = 0, minDay = Infinity, maxDay = 0, minAsrGap = Infinity;
  for (let i = 0; i < 365; i++) {
    const k = k0 + i;
    const r = Object.fromEntries(rubezhiForDay(k, p.lat, p.lon).map((x) => [x.id, x]));
    const nextIV = rubezhiForDay(k + 1, p.lat, p.lon).find((x) => x.id === 'IV');
    if (r.II.merged) merged++; else shortestNight = Math.min(shortestNight, (nextIV.t - r.II.t) / MIN);
    const day = (r.I.t - r.V.t) / MIN;
    minDay = Math.min(minDay, day); maxDay = Math.max(maxDay, day);
    minAsrGap = Math.min(minAsrGap, (r.I.t - r.VIII.t) / MIN);
  }
  rows.push(`| ${p.name} | ${p.lat.toFixed(2)} | ${p.lon.toFixed(2)} | ${hm(minDay)} | ${hm(maxDay)} | ${merged ? `нет ${merged} сут.` : hm(shortestNight)} | ${Math.round(minAsrGap)} мин |`);
}
console.log('| Место | Широта | Долгота | Самый короткий день | Самый длинный день | Самая короткая ночь (−6°) | Мин. от асра до заката |');
console.log('|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));

const p = places.find((x) => x.id === 'kudymkar');
const fmt = (t) => new Date(t + 5 * 3600000).toISOString().slice(11, 16);
console.log('\n| Дата | II пемдӧм | III ойшӧр | IV югдӧм | V шонді петӧм | VI асывшӧр | VII луншӧр | VIII рытмӧм | I шонді лэдзчӧм |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [m, d] of [[0, 20], [2, 20], [5, 21], [8, 23], [11, 21]]) {
  const ms = Date.UTC(2026, m, d, 8);
  const r = Object.fromEntries(rubezhiForDay(solarDayIndex(ms, p.lon), p.lat, p.lon).map((x) => [x.id, x.t]));
  const prevII = rubezhiForDay(solarDayIndex(ms, p.lon) - 1, p.lat, p.lon).find((x) => x.id === 'II').t;
  console.log(`| ${String(d).padStart(2, '0')}.${String(m + 1).padStart(2, '0')} | ${fmt(prevII)} | ${fmt(r.III)} | ${fmt(r.IV)} | ${fmt(r.V)} | ${fmt(r.VI)} | ${fmt(r.VII)} | ${fmt(r.VIII)} | ${fmt(r.I)} |`);
}
