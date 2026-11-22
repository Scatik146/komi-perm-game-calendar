// Зманим по методике chabad.org («About Our Zmanim Calculations», статья 3209349) — для любой точки.
// Правила и сверка со страницей chabad.org для Перми — docs/rezhimy.md.
// Все времена — в мс UTC; k — номер суток UTC от 1970-01-01 (как в sun.js и namaz.js).
//
// Времена дня k: { alot, misheyakir, nec, shma, tfila, hacot, minhaGdola, minhaGdola30,
// minhaKtana, plag, svechi, shkia, cet, ishod, hacotLajla } — мс UTC или null (нет в этот день).
import { DAY_MS, altitudeCrossing } from './sun.js';
import { hebrewFromK } from './evrei.js';

const MIN_MS = 60000;

// Данные методики chabad.org: углы Солнца (центр диска), минуты, доли «часа времени».
export const METODIKA_HABAD = {
  ugolAlot: -16.9,
  ugolMisheyakir: -10.2,
  ugolVoshoda: -0.833,
  ugolAmitis: -1.583,
  ugolCet: -6,
  ugolIshoda: -8.5,
  svechiDoShkii: 18,
  minhaPosleHacota: 30,
  shaa: { shma: 3, tfila: 4, minhaGdola: 6.5, minhaKtana: 2.5, plag: 1.25 },
};

// Святые дни диаспоры (работа запрещена): [месяц, число] по evrei.js (1 — нисан, 7 — тишрей).
export const JOM_TOV = [
  [7, 1], [7, 2], [7, 10], [7, 15], [7, 16], [7, 22], [7, 23],
  [1, 15], [1, 16], [1, 21], [1, 22],
  [3, 6], [3, 7],
];

// Округление как на странице chabad.org: vniz — вниз, vverh — вверх, blizh — до ближайшей минуты.
// Подобрано по скринам Перми (20.06, 20, 22, 28.11.2026), Петербурга (20.06.2026)
// и исходу праздника 19, 21, 27.09.2026 — разбор в docs/rezhimy.md.
export const OKRUGLENIE = {
  alot: 'vniz', misheyakir: 'blizh', nec: 'vniz', shma: 'vniz', tfila: 'vniz',
  hacot: 'vniz', minhaGdola: 'blizh', minhaGdola30: 'blizh', minhaKtana: 'blizh', plag: 'vverh',
  svechi: 'vniz', shkia: 'vniz', cet: 'blizh', ishod: 'vniz', hacotLajla: 'vniz',
};

// Порядок времён в дне.
export const ZMANIM = Object.keys(OKRUGLENIE);

// moment: когда Солнце на высоте alt утром (znak −1) или вечером (+1); null — не бывает
function moment(k, lat, lon, alt, znak) {
  const { t } = altitudeCrossing(k, lat, lon, alt, znak);
  return t;
}

// seredina: середина между двумя моментами; null, если одного нет
function seredina(a, b) {
  let t = null;
  if (a !== null && b !== null) t = (a + b) / 2;
  return t;
}

// dnevnoeVremya: от нец амитис через доли «часа времени»; null без восхода или заката
function dnevnoeVremya(nachalo, konec, doli) {
  let t = null;
  if (nachalo !== null && konec !== null) t = nachalo + (doli * (konec - nachalo)) / 12;
  return t;
}

// amitis: нец и шкия амитис (−1,583°) дня k
function amitis(k, lat, lon) {
  const m = METODIKA_HABAD;
  const para = {
    nec: moment(k, lat, lon, m.ugolAmitis, -1),
    shkia: moment(k, lat, lon, m.ugolAmitis, 1),
  };
  return para;
}

// hacotLajlaDnya: полночь после дня k — середина между шкией амитис k и нец амитис k + 1
function hacotLajlaDnya(k, lat, lon) {
  const t = seredina(amitis(k, lat, lon).shkia, amitis(k + 1, lat, lon).nec);
  return t;
}

// utroIliPolnoch: утро на высоте alt; летом, когда Солнце так низко не опускается, — полночь перед днём
function utroIliPolnoch(k, lat, lon, alt) {
  let t = moment(k, lat, lon, alt, -1);
  if (t === null) t = hacotLajlaDnya(k - 1, lat, lon);
  return t;
}

// vecherIliPolnoch: вечер на высоте alt; летом, когда Солнце так низко не опускается, — полночь после дня
function vecherIliPolnoch(k, lat, lon, alt) {
  let t = moment(k, lat, lon, alt, 1);
  if (t === null) t = hacotLajlaDnya(k, lat, lon);
  return t;
}

// zameny: какие времена летом взяты полночью (Солнце не опускается на нужный угол)
function zameny(k, lat, lon) {
  const m = METODIKA_HABAD;
  const spisok = [];
  if (moment(k, lat, lon, m.ugolAlot, -1) === null) spisok.push('alot');
  if (moment(k, lat, lon, m.ugolMisheyakir, -1) === null) spisok.push('misheyakir');
  if (moment(k, lat, lon, m.ugolIshoda, 1) === null) spisok.push('ishod');
  return spisok;
}

// dnevnye: времена от восхода до заката по «часам времени»
function dnevnye(a) {
  const d = METODIKA_HABAD.shaa;
  const vremena = {
    shma: dnevnoeVremya(a.nec, a.shkia, d.shma),
    tfila: dnevnoeVremya(a.nec, a.shkia, d.tfila),
    hacot: seredina(a.nec, a.shkia),
    minhaGdola: dnevnoeVremya(a.nec, a.shkia, d.minhaGdola),
    minhaKtana: dnevnoeVremya(a.nec, a.shkia, 12 - d.minhaKtana),
    plag: dnevnoeVremya(a.nec, a.shkia, 12 - d.plag),
  };
  return vremena;
}

// posleHacota: «некоторые ждут 30 мин после хацота» — только если это позже минхи гдолы
function posleHacota(d) {
  let t = null;
  if (d.hacot !== null) t = d.hacot + METODIKA_HABAD.minhaPosleHacota * MIN_MS;
  if (t !== null && t <= d.minhaGdola) t = null;
  return t;
}

// utrennie: рассвет, мишеякир, восход
function utrennie(k, lat, lon) {
  const m = METODIKA_HABAD;
  const vremena = {
    alot: utroIliPolnoch(k, lat, lon, m.ugolAlot),
    misheyakir: utroIliPolnoch(k, lat, lon, m.ugolMisheyakir),
    nec: moment(k, lat, lon, m.ugolVoshoda, -1),
  };
  return vremena;
}

// vechernie: свечи, закат, выход звёзд, исход, полночь
function vechernie(k, lat, lon) {
  const m = METODIKA_HABAD;
  const shkia = moment(k, lat, lon, m.ugolVoshoda, 1);
  const vremena = {
    svechi: shkia === null ? null : shkia - m.svechiDoShkii * MIN_MS,
    shkia,
    cet: moment(k, lat, lon, m.ugolCet, 1),
    ishod: vecherIliPolnoch(k, lat, lon, m.ugolIshoda),
    hacotLajla: hacotLajlaDnya(k, lat, lon),
  };
  return vremena;
}

// poSolncu: все времена дня k без округления, свечи и исход — для каждого дня
function poSolncu(k, lat, lon) {
  const d = dnevnye(amitis(k, lat, lon));
  const vremena = { ...utrennie(k, lat, lon), ...d, minhaGdola30: posleHacota(d), ...vechernie(k, lat, lon) };
  return vremena;
}

// jomTov: день k (дневная часть еврейской даты) — святой день праздника в диаспоре
export function jomTov(k) {
  const { month, day } = hebrewFromK(k);
  const est = JOM_TOV.some(([m, d]) => m === month && d === day);
  return est;
}

// shabbat: день k — суббота (1970-01-01 был четвергом)
export function shabbat(k) {
  return ((k % 7) + 7) % 7 === 2;
}

// svyatoj: день k — суббота или святой день праздника
export function svyatoj(k) {
  return shabbat(k) || jomTov(k);
}

// vidDnya: что бывает в день k — свечи до заката, свечи после исхода, исход
export function vidDnya(k) {
  const zavtra = svyatoj(k + 1);
  const segodnya = svyatoj(k);
  const vid = {
    svechi: zavtra && (!segodnya || shabbat(k + 1)),
    svechiPosleIshoda: zavtra && segodnya && !shabbat(k + 1),
    ishod: segodnya && !zavtra,
    svyatoj: segodnya,
    shabbat: shabbat(k),
  };
  return vid;
}

// okruglit: момент до минуты — вниз или вверх по правилу вида времени
function okruglit(t, kak) {
  let itog = null;
  if (t !== null && kak === 'vniz') itog = Math.floor(t / MIN_MS) * MIN_MS;
  if (t !== null && kak === 'vverh') itog = Math.ceil(t / MIN_MS) * MIN_MS;
  if (t !== null && kak === 'blizh') itog = Math.round(t / MIN_MS) * MIN_MS;
  return itog;
}

// pravilo: как округлять время; взятое полночью — как полночь
function pravilo(imya, zameny) {
  let kak = OKRUGLENIE[imya];
  if (zameny.includes(imya)) kak = OKRUGLENIE.hacotLajla;
  return kak;
}

// sOkrugleniem: каждое время округлено, как на странице chabad.org
function sOkrugleniem(vremena, zameny) {
  const itog = {};
  for (const imya of ZMANIM) itog[imya] = okruglit(vremena[imya], pravilo(imya, zameny));
  return itog;
}

// otobrat: свечи и исход — только в те дни, когда они бывают
function otobrat(vremena, vid) {
  const itog = { ...vremena };
  if (!vid.svechi) itog.svechi = null;
  if (!vid.svyatoj) itog.ishod = null;
  return itog;
}

// bezOkrugleniya: зманим дня k по правилам chabad.org, до секунды
export function bezOkrugleniya(k, lat, lon) {
  const vid = vidDnya(k);
  const vremena = otobrat(poSolncu(k, lat, lon), vid);
  return { vremena, vid, zameny: zameny(k, lat, lon) };
}

// zmanimDnya: зманим дня k, округлённые как на странице chabad.org
export function zmanimDnya(k, lat, lon) {
  const { vremena, vid, zameny: z } = bezOkrugleniya(k, lat, lon);
  const shaa = vremena.shma === null ? null : (vremena.tfila - vremena.shma);
  return { vremena: sOkrugleniem(vremena, z), vid, shaa, zameny: z };
}

// Сутки зманим: { start, end, sobytiya: [{ id, t }], zalivka: [{ ot, do }], zameny, vid } —
// от заката дня k до заката дня k + 1; zalivka — куски суток, когда идёт суббота или праздник.

// VECHER и DEN: какие времена в сутках идут вечером дня k и днём k + 1 (по порядку)
const VECHER = ['shkia', 'cet', 'ishod', 'hacotLajla'];
const DEN = ['alot', 'misheyakir', 'nec', 'shma', 'tfila', 'hacot', 'minhaGdola', 'minhaGdola30',
  'minhaKtana', 'plag', 'svechi'];

// sobytiyaIz: события из времён дня по списку имён, без пустых
function sobytiyaIz(vremena, imena) {
  const sobytiya = imena.filter((id) => vremena[id] !== null).map((id) => ({ id, t: vremena[id] }));
  return sobytiya;
}

// vecherSutok: события вечера; в святой день вместо выхода звёзд — исход
function vecherSutok(segodnya) {
  let imena = VECHER.filter((id) => id !== 'ishod');
  if (segodnya.vremena.ishod !== null) imena = VECHER.filter((id) => id !== 'cet');
  return sobytiyaIz(segodnya.vremena, imena);
}

// zalivkaSutok: когда в этих сутках идёт суббота или праздник
function zalivkaSutok(segodnya, zavtra, start, end) {
  const kuski = [];
  if (zavtra.vid.svyatoj) kuski.push({ ot: start, do: end });
  else if (segodnya.vid.svyatoj) kuski.push({ ot: start, do: segodnya.vremena.ishod });
  if (!zavtra.vid.svyatoj && zavtra.vremena.svechi !== null) kuski.push({ ot: zavtra.vremena.svechi, do: end });
  return kuski;
}

// sutkiDnya: сутки, начатые закатом дня k
export function sutkiDnya(k, lat, lon) {
  const segodnya = zmanimDnya(k, lat, lon);
  const zavtra = zmanimDnya(k + 1, lat, lon);
  const start = segodnya.vremena.shkia;
  const end = zavtra.vremena.shkia;
  const sobytiya = [...vecherSutok(segodnya), ...sobytiyaIz(zavtra.vremena, DEN)];
  const sutki = {
    start, end, sobytiya,
    zalivka: zalivkaSutok(segodnya, zavtra, start, end),
    zameny: [...new Set([...segodnya.zameny, ...zavtra.zameny])],
    vid: { segodnya: segodnya.vid, zavtra: zavtra.vid },
    shaa: zavtra.shaa,
  };
  return sutki;
}

// sutkiZmanim: сутки (от заката), в которые попадает момент t; null — в полярный день или ночь
export function sutkiZmanim(t, lat, lon) {
  const k = Math.floor((t + lon * 4 * MIN_MS) / DAY_MS);
  let sutki = sutkiDnya(k, lat, lon);
  if (sutki.start !== null && t < sutki.start) sutki = sutkiDnya(k - 1, lat, lon);
  if (sutki.end !== null && t >= sutki.end) sutki = sutkiDnya(k + 1, lat, lon);
  if (sutki.start === null || sutki.end === null) sutki = null;
  return sutki;
}
