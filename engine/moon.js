// Луна: положение, восход/заход, кульминация и фаза.
// Алгоритм П. Шлютера (упрощённая теория с основными возмущениями), точность ~2′ —
// для часов и календаря с запасом.

import { julianDay } from './sun.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const rev = (x) => ((x % 360) + 360) % 360;

function kepler(M, e) {
  let E = M + e * DEG * Math.sin(M * RAD) * (1 + e * Math.cos(M * RAD));
  for (let i = 0; i < 5; i++) {
    E = E - (E - e * DEG * Math.sin(E * RAD) - M) / (1 - e * Math.cos(E * RAD));
  }
  return E;
}

/** Эклиптическая долгота Солнца (градусы) по Шлютеру. */
function sunLongitude(d) {
  const w = 282.9404 + 4.70935e-5 * d;
  const M = rev(356.0470 + 0.9856002585 * d);
  const e = 0.016709 - 1.151e-9 * d;
  const E = kepler(M, e);
  const xv = Math.cos(E * RAD) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E * RAD);
  return { lon: rev(Math.atan2(yv, xv) * DEG + w), M, w };
}

/**
 * Геоцентрическое положение Луны в момент ms.
 * @returns {{ra:number, dec:number, lon:number, lat:number, dist:number, sunLon:number}}
 *   ra, dec — радианы; lon, lat, sunLon — градусы; dist — в радиусах Земли
 */
export function moonPosition(ms) {
  const d = julianDay(ms) - 2451543.5;
  const N = rev(125.1228 - 0.0529538083 * d);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * d);
  const a = 60.2666;
  const e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * d);

  const E = kepler(M, e);
  const xv = a * (Math.cos(E * RAD) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E * RAD);
  const v = Math.atan2(yv, xv) * DEG;
  let r = Math.hypot(xv, yv);

  const vw = (v + w) * RAD;
  const xh = r * (Math.cos(N * RAD) * Math.cos(vw) - Math.sin(N * RAD) * Math.sin(vw) * Math.cos(i * RAD));
  const yh = r * (Math.sin(N * RAD) * Math.cos(vw) + Math.cos(N * RAD) * Math.sin(vw) * Math.cos(i * RAD));
  const zh = r * Math.sin(vw) * Math.sin(i * RAD);
  let lon = Math.atan2(yh, xh) * DEG;
  let lat = Math.atan2(zh, Math.hypot(xh, yh)) * DEG;

  const sun = sunLongitude(d);
  const Ms = sun.M;
  const Ls = rev(Ms + sun.w);
  const Lm = rev(M + w + N);
  const D = Lm - Ls;
  const F = Lm - N;
  const s = (x) => Math.sin(x * RAD);
  lon += -1.274 * s(M - 2 * D) + 0.658 * s(2 * D) - 0.186 * s(Ms)
    - 0.059 * s(2 * M - 2 * D) - 0.057 * s(M - 2 * D + Ms) + 0.053 * s(M + 2 * D)
    + 0.046 * s(2 * D - Ms) + 0.041 * s(M - Ms) - 0.035 * s(D) - 0.031 * s(M + Ms)
    - 0.015 * s(2 * F - 2 * D) + 0.011 * s(M - 4 * D);
  lat += -0.173 * s(F - 2 * D) - 0.055 * s(M - F - 2 * D) - 0.046 * s(M + F - 2 * D)
    + 0.033 * s(F + 2 * D) + 0.017 * s(2 * M + F);
  r += -0.58 * Math.cos((M - 2 * D) * RAD) - 0.46 * Math.cos(2 * D * RAD);
  lon = rev(lon);

  const ecl = (23.4393 - 3.563e-7 * d) * RAD;
  const x = Math.cos(lon * RAD) * Math.cos(lat * RAD);
  const y = Math.sin(lon * RAD) * Math.cos(lat * RAD);
  const z = Math.sin(lat * RAD);
  const ye = y * Math.cos(ecl) - z * Math.sin(ecl);
  const ze = y * Math.sin(ecl) + z * Math.cos(ecl);
  return {
    ra: Math.atan2(ye, x),
    dec: Math.atan2(ze, Math.hypot(x, ye)),
    lon, lat, dist: r, sunLon: sun.lon,
  };
}

/** Звёздное время в Гринвиче (градусы). */
function gmst(ms) {
  return rev(280.46061837 + 360.98564736629 * (julianDay(ms) - 2451545));
}

/** Топоцентрическая высота Луны (градусы) и часовой угол (часы, −12…12). */
export function moonAltitude(ms, latDeg, lonDeg) {
  const p = moonPosition(ms);
  let ha = rev(gmst(ms) + lonDeg - p.ra * DEG);
  if (ha > 180) ha -= 360;
  const lat = latDeg * RAD;
  const alt = Math.asin(Math.sin(lat) * Math.sin(p.dec) + Math.cos(lat) * Math.cos(p.dec) * Math.cos(ha * RAD));
  const topo = alt - Math.asin(Math.cos(alt) / p.dist); // параллакс
  return { alt: topo * DEG, hourAngle: ha / 15 };
}

/**
 * Фаза Луны в момент ms.
 * @returns {{illumination:number, waxing:boolean, age:number, phase:string}}
 *   illumination — освещённая доля диска 0…1; age — доля лунного месяца 0…1 от новолуния
 */
export function moonPhase(ms) {
  const p = moonPosition(ms);
  const delta = rev(p.lon - p.sunLon);
  const elong = Math.acos(Math.cos((p.lon - p.sunLon) * RAD) * Math.cos(p.lat * RAD));
  const illumination = (1 - Math.cos(elong)) / 2;
  const age = delta / 360;
  const names = [
    'новолуние', 'растущий серп', 'первая четверть', 'растущая луна',
    'полнолуние', 'убывающая луна', 'последняя четверть', 'убывающий серп',
  ];
  const phase = names[Math.floor(((age * 8) + 0.5) % 8)];
  return { illumination, waxing: delta < 180, age, phase };
}

const MOON_HORIZON = -0.833; // верхний край диска с рефракцией (для топоцентрической высоты)

/**
 * Восходы, заходы и кульминации Луны в интервале [from, to].
 * @returns {{events: Array<{type:'rise'|'set'|'transit', t:number}>, up: Array<[number, number]>}}
 *   up — отрезки времени, когда Луна над горизонтом
 */
export function moonEvents(from, to, latDeg, lonDeg, stepMin = 10) {
  const step = stepMin * 60000;
  const events = [];
  let t0 = from;
  let a0 = moonAltitude(t0, latDeg, lonDeg);
  const up = [];
  let upStart = a0.alt > MOON_HORIZON ? from : null;
  for (let t1 = from + step; t1 <= to + step; t1 += step) {
    const a1 = moonAltitude(t1, latDeg, lonDeg);
    const h0 = a0.alt - MOON_HORIZON;
    const h1 = a1.alt - MOON_HORIZON;
    if (h0 <= 0 && h1 > 0 || h0 > 0 && h1 <= 0) {
      const t = refine(t0, t1, (tt) => moonAltitude(tt, latDeg, lonDeg).alt - MOON_HORIZON);
      if (t >= from && t <= to) {
        if (h1 > 0) { events.push({ type: 'rise', t }); upStart = t; }
        else { events.push({ type: 'set', t }); up.push([upStart ?? from, t]); upStart = null; }
      }
    }
    if (a0.hourAngle < 0 && a1.hourAngle >= 0 && a1.hourAngle - a0.hourAngle < 6) {
      const t = refine(t0, t1, (tt) => moonAltitude(tt, latDeg, lonDeg).hourAngle);
      if (t >= from && t <= to) events.push({ type: 'transit', t, alt: moonAltitude(t, latDeg, lonDeg).alt });
    }
    t0 = t1;
    a0 = a1;
  }
  if (upStart !== null) up.push([upStart, to]);
  events.sort((a, b) => a.t - b.t);
  return { events, up };
}

function refine(a, b, f) {
  let fa = f(a);
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

