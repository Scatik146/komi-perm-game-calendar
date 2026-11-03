// Положение Солнца: упрощённый алгоритм NOAA (по Ж. Мейсу).
// Точность моментов восхода/заката — порядка минуты для широт 0–65°.
// Все времена — в миллисекундах UTC (как Date.getTime()).

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
export const DAY_MS = 86400000;
const MIN_MS = 60000;

/** Юлианская дата по времени в мс UTC. */
export function julianDay(ms) {
  return ms / DAY_MS + 2440587.5;
}

/**
 * Склонение Солнца (радианы) и уравнение времени (минуты) в момент ms.
 * @param {number} ms
 * @returns {{decl:number, eqTime:number}}
 */
export function solarParams(ms) {
  const T = (julianDay(ms) - 2451545.0) / 36525;
  const L0 = mod360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega * RAD)) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda * RAD));
  const y = Math.tan(eps / 2) ** 2;
  const L0r = L0 * RAD;
  const eqTime =
    4 * DEG *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));
  return { decl, eqTime };
}

/**
 * Часовой угол (градусы), при котором Солнце на высоте altDeg.
 * null — Солнце весь день ниже этой высоты; 180 — весь день выше.
 */
export function hourAngle(latDeg, decl, altDeg) {
  const lat = latDeg * RAD;
  const c = (Math.sin(altDeg * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
  if (c > 1) return null;
  if (c < -1) return 180;
  return Math.acos(c) * DEG;
}

/** Истинный полдень (мс UTC) для солнечных суток k (k — номер дня UTC от 1970-01-01, со сдвигом по долготе). */
export function solarNoon(k, lonDeg) {
  let t = k * DAY_MS + (720 - 4 * lonDeg) * MIN_MS;
  for (let i = 0; i < 3; i++) {
    const { eqTime } = solarParams(t);
    t = k * DAY_MS + (720 - 4 * lonDeg - eqTime) * MIN_MS;
  }
  return t;
}

/**
 * Момент, когда Солнце проходит высоту altDeg утром (sign=-1) или вечером (sign=+1)
 * в солнечные сутки k. altDeg может быть функцией (decl) => высота, для асра.
 * @returns {{t:number|null, always:'above'|'below'|null}}
 */
export function altitudeCrossing(k, latDeg, lonDeg, altDeg, sign) {
  const noon = solarNoon(k, lonDeg);
  let t = noon;
  let H = null;
  for (let i = 0; i < 4; i++) {
    const { decl } = solarParams(t);
    const alt = typeof altDeg === 'function' ? altDeg(decl) : altDeg;
    H = hourAngle(latDeg, decl, alt);
    if (H === null) return { t: null, always: 'below' };
    if (H === 180) return { t: null, always: 'above' };
    t = noon + sign * H * 4 * MIN_MS;
  }
  return { t, always: null };
}

/** Высота Солнца, при которой тень предмета = k·высота + полуденная тень (аср). */
export function asrAltitude(latDeg, decl, shadowFactor) {
  const z = Math.abs(latDeg * RAD - decl);
  return Math.atan(1 / (shadowFactor + Math.tan(z))) * DEG;
}

/** Местное истинное солнечное время (часы 0–24) в момент ms для долготы lonDeg. */
export function apparentSolarTime(ms, lonDeg) {
  const { eqTime } = solarParams(ms);
  const minutes = ((ms % DAY_MS) + DAY_MS) % DAY_MS / MIN_MS + 4 * lonDeg + eqTime;
  return (((minutes / 60) % 24) + 24) % 24;
}

/** Высота Солнца (градусы) в момент ms. */
export function sunAltitude(ms, latDeg, lonDeg) {
  const { decl } = solarParams(ms);
  const H = (apparentSolarTime(ms, lonDeg) - 12) * 15 * RAD;
  const lat = latDeg * RAD;
  return Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H)) * DEG;
}

function mod360(x) {
  return ((x % 360) + 360) % 360;
}
