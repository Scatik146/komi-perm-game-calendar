// Время намаза по общему правилу ЦДУМ России — для любой точки.
// Правило и сверка с таблицами ЦДУМ (Пермь, Салехард) — docs/rezhimy.md.
// Все времена — в мс UTC; k — номер суток UTC от 1970-01-01 (как в sun.js).
//
// Времена: { fadzhr, shuruk, zuhr, asr, magrib, isha } — мс UTC, у каждого
// поля есть значение; stupen — какая ступень правила сработала (1, 2 или 3).
import { DAY_MS, solarNoon, altitudeCrossing, asrAltitude } from './sun.js';

const MIN_MS = 60000;

// Данные методики ЦДУМ: углы Солнца, запасная широта, ихтият в минутах.
export const METODIKA_CDUM = {
  ugolFadzhr: -18,
  ugolIsha: -17,
  ugolVoshoda: -0.833,
  tenAsra: 2,
  shirotaZapasnaya: 45,
  ihtiyat: { fadzhr: -2, shuruk: -2, zuhr: 3, asr: 2, magrib: 2, isha: 2 },
};

// Порядок намазов на циферблате.
export const NAMAZY = ['fadzhr', 'shuruk', 'zuhr', 'asr', 'magrib', 'isha'];

// moment: когда Солнце на высоте alt утром (znak −1) или вечером (+1); null — не бывает
function moment(k, lat, lon, alt, znak) {
  const { t } = altitudeCrossing(k, lat, lon, alt, znak);
  return t;
}

// vysotaAsra: высота Солнца в начале асра по-ханафитски (для склонения decl)
function vysotaAsra(lat) {
  const poSklonenyu = (decl) => asrAltitude(lat, decl, METODIKA_CDUM.tenAsra);
  return poSklonenyu;
}

// poUglam: все времена по углам Солнца; null там, где угол не достигается
function poUglam(k, lat, lon) {
  const m = METODIKA_CDUM;
  const vremena = {
    fadzhr: moment(k, lat, lon, m.ugolFadzhr, -1),
    shuruk: moment(k, lat, lon, m.ugolVoshoda, -1),
    zuhr: solarNoon(k, lon),
    asr: moment(k, lat, lon, vysotaAsra(lat), 1),
    magrib: moment(k, lat, lon, m.ugolVoshoda, 1),
    isha: moment(k, lat, lon, m.ugolIsha, 1),
  };
  return vremena;
}

// estDenINoch: Солнце в этот день и восходит, и заходит
function estDenINoch(vremena) {
  return vremena.shuruk !== null && vremena.magrib !== null;
}

// dlinaNochi: сколько длится ночь (мс) — сутки без светлого дня
function dlinaNochi(vremena) {
  return DAY_MS - (vremena.magrib - vremena.shuruk);
}

// doliNochi: какую долю ночи занимают «до восхода» (фаджр) и «после заката» (иша)
function doliNochi(vremena) {
  const noch = dlinaNochi(vremena);
  const doli = {
    fadzhr: (vremena.shuruk - vremena.fadzhr) / noch,
    isha: (vremena.isha - vremena.magrib) / noch,
  };
  return doli;
}

// poDolyamNochi: фаджр и иша, которых нет по углу, — долей ночи с запасной широты
function poDolyamNochi(vremena, zapas) {
  const doli = doliNochi(zapas);
  const noch = dlinaNochi(vremena);
  const itog = { ...vremena };
  if (itog.fadzhr === null) itog.fadzhr = vremena.shuruk - doli.fadzhr * noch;
  if (itog.isha === null) itog.isha = vremena.magrib + doli.isha * noch;
  return itog;
}

// sIhtiyatom: каждое время сдвинуто на ихтият — в безопасную сторону
function sIhtiyatom(vremena) {
  const itog = {};
  for (const imya of NAMAZY) {
    itog[imya] = vremena[imya] + METODIKA_CDUM.ihtiyat[imya] * MIN_MS;
  }
  return itog;
}

// stupenPravila: 1 — всё по углам, 2 — нужна доля ночи, 3 — нет дня или ночи
function stupenPravila(vremena) {
  let stupen = 1;
  if (vremena.fadzhr === null || vremena.isha === null) stupen = 2;
  if (!estDenINoch(vremena)) stupen = 3;
  return stupen;
}

// bezIhtiyata: времена ЦДУМ без ихтията — по ступеням общего правила
export function bezIhtiyata(k, lat, lon) {
  const zdes = poUglam(k, lat, lon);
  const zapas = poUglam(k, METODIKA_CDUM.shirotaZapasnaya, lon);
  const stupen = stupenPravila(zdes);
  let vremena = zdes;
  if (stupen === 2) vremena = poDolyamNochi(zdes, zapas);
  if (stupen === 3) vremena = zapas;
  return { vremena, stupen };
}

// vremenaNamaza: время начала шести намазов ЦДУМ в сутки k для точки (lat, lon)
export function vremenaNamaza(k, lat, lon) {
  const { vremena, stupen } = bezIhtiyata(k, lat, lon);
  return { ...sIhtiyatom(vremena), stupen };
}

// sutkiPoDate: номер суток k по календарной дате (год, месяц 1–12, число)
export function sutkiPoDate(god, mesyac, chislo) {
  return Date.UTC(god, mesyac - 1, chislo) / DAY_MS;
}

// Сутки намаза: { start, end, sobytiya: [{ id, t }], stupen } — от магриба до следующего магриба.
// Порядок событий в сутках: магриб, иша, фаджр, шурук, зухр, аср.

// sutkiPoSolncu: номер суток k по местному солнечному времени в момент t
function sutkiPoSolncu(t, lon) {
  return Math.floor((t + lon * 4 * MIN_MS) / DAY_MS);
}

// sobytiyaSutok: события суток, начатых магрибом дня k
function sobytiyaSutok(k, lat, lon) {
  const segodnya = vremenaNamaza(k, lat, lon);
  const zavtra = vremenaNamaza(k + 1, lat, lon);
  const sobytiya = [
    { id: 'magrib', t: segodnya.magrib },
    { id: 'isha', t: segodnya.isha },
    { id: 'fadzhr', t: zavtra.fadzhr },
    { id: 'shuruk', t: zavtra.shuruk },
    { id: 'zuhr', t: zavtra.zuhr },
    { id: 'asr', t: zavtra.asr },
  ];
  const stupen = Math.max(segodnya.stupen, zavtra.stupen);
  return { start: segodnya.magrib, end: zavtra.magrib, sobytiya, stupen };
}

// sutkiNamaza: сутки намаза (от заката), в которые попадает момент t
export function sutkiNamaza(t, lat, lon) {
  const k = sutkiPoSolncu(t, lon);
  let sutki = sobytiyaSutok(k, lat, lon);
  if (t < sutki.start) sutki = sobytiyaSutok(k - 1, lat, lon);
  if (t >= sutki.end) sutki = sobytiyaSutok(k + 1, lat, lon);
  return sutki;
}

// sleduyushcheeSobytie: ближайшее событие суток после момента t или null
export function sleduyushcheeSobytie(sutki, t) {
  const sleduyushchee = sutki.sobytiya.find((s) => s.t > t);
  return sleduyushchee || null;
}

// tekushcheeSobytie: последнее событие суток, наступившее к моменту t
export function tekushcheeSobytie(sutki, t) {
  const nastupivshie = sutki.sobytiya.filter((s) => s.t <= t);
  return nastupivshie[nastupivshie.length - 1];
}
