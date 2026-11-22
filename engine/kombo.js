// Режим «Комбо»: поверх игровых суток — точки начала молитв двух вер.
// Иудеи — те зманим, что внутри еврейского циферблата (поле vnutri в data/zmanim.json).
// Мусульмане — пять намазов (поле namaz в data/namaz.json); шурук — не намаз, его нет.
// Расчёты не новые: берём готовые ядра engine/zmanim.js и engine/namaz.js.
// Точка: { vera, id, t }. Слой: { tochki, net } — net: у веры в этом окне нет времён.

import { sutkiZmanim } from './zmanim.js';
import { sutkiNamaza } from './namaz.js';

// vnutriOkna: момент t лежит в окне [ot, do)
function vnutriOkna(t, ot, doMomenta) {
  const da = t !== null && t >= ot && t < doMomenta;
  return da;
}

// kraiOkna: два момента, по которым ищутся сутки веры: начало окна и миг перед концом
function kraiOkna(ot, doMomenta) {
  const krai = [ot, doMomenta - 1];
  return krai;
}

// sobytiyaVOkne: события суток веры, которые попали в окно и есть в списке нужных
function sobytiyaVOkne(sutki, ot, doMomenta, nuzhnye) {
  const najdeny = sutki.sobytiya.filter((s) => nuzhnye.includes(s.id) && vnutriOkna(s.t, ot, doMomenta));
  return najdeny;
}

// bezPovtorov: события по времени, одно и то же событие — один раз
function bezPovtorov(sobytiya) {
  const vstrecheny = new Map(sobytiya.map((s) => [`${s.id}@${s.t}`, s]));
  const spisok = [...vstrecheny.values()].sort((a, b) => a.t - b.t);
  return spisok;
}

// sloyVery: точки веры в окне; sutkiPo(t) — сутки веры в момент t или null
function sloyVery(vera, sutkiPo, ot, doMomenta, nuzhnye) {
  const sutki = kraiOkna(ot, doMomenta).map(sutkiPo);
  const est = sutki.filter((s) => s !== null);
  const sobytiya = est.flatMap((s) => sobytiyaVOkne(s, ot, doMomenta, nuzhnye));
  const tochki = bezPovtorov(sobytiya).map((s) => ({ vera, id: s.id, t: s.t }));
  const stupen = Math.max(0, ...est.map((s) => s.stupen || 0));
  const sloy = { tochki, net: tochki.length === 0 && est.length < sutki.length, stupen };
  return sloy;
}

// imenaIudeev: зманим, с которых можно начинать молитву (внутри еврейского круга)
function imenaIudeev(zmanimy) {
  const imena = zmanimy.vremena.filter((v) => v.vnutri === true).map((v) => v.id);
  return imena;
}

// imenaMusulman: начала пяти намазов (без шурука)
function imenaMusulman(namazy) {
  const imena = namazy.vremena.filter((v) => v.namaz === true).map((v) => v.id);
  return imena;
}

// sloiKombo: включённые слои над игровыми сутками { start, end }; выключенный слой — null
function sloiKombo(sutki, lat, lon, vklyucheno, imena) {
  const sloi = { iudaizm: null, islam: null };
  if (vklyucheno.iudaizm) {
    sloi.iudaizm = sloyVery('iudaizm', (t) => sutkiZmanim(t, lat, lon), sutki.start, sutki.end, imena.iudaizm);
  }
  if (vklyucheno.islam) {
    sloi.islam = sloyVery('islam', (t) => sutkiNamaza(t, lat, lon), sutki.start, sutki.end, imena.islam);
  }
  return sloi;
}

// vseTochki: точки всех включённых слоёв по времени
function vseTochki(sloi) {
  const est = [sloi.iudaizm, sloi.islam].filter((s) => s !== null);
  const tochki = est.flatMap((s) => s.tochki).sort((a, b) => a.t - b.t);
  return tochki;
}

// sleduyushchayaTochka: первая точка после момента t или null
function sleduyushchayaTochka(sloi, t) {
  const sled = vseTochki(sloi).find((p) => p.t > t);
  return sled || null;
}

export {
  vnutriOkna, kraiOkna, sobytiyaVOkne, bezPovtorov, sloyVery,
  imenaIudeev, imenaMusulman, sloiKombo, vseTochki, sleduyushchayaTochka,
};
