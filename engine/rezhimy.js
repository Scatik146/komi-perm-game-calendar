// Режимы солнечных часов и слои комбо-режима: выбор и проверка настройки.
// Описание режимов — data/rezhimy.json; здесь только действия над ним.
// Настройка: { rezhim: 'igrovoj', sloi: { iudaizm: false, islam: false, pravoslavie: false } }.

// rezhimPoId: запись режима по id или null
function rezhimPoId(dannye, id) {
  const najden = dannye.rezhimy.find((r) => r.id === id);
  return najden || null;
}

// rezhimDostupen: режим есть и уже готов
function rezhimDostupen(dannye, id) {
  const rezhim = rezhimPoId(dannye, id);
  return rezhim !== null && rezhim.gotov === true;
}

// sloyDostupen: слой комбо есть и уже готов
function sloyDostupen(dannye, id) {
  const sloy = dannye.sloiKombo.find((s) => s.id === id);
  return sloy !== undefined && sloy.gotov === true;
}

// vybratRezhim: id режима, если он доступен, иначе режим по умолчанию
function vybratRezhim(dannye, id) {
  let rezhim = dannye.poUmolchaniyu;
  if (rezhimDostupen(dannye, id)) rezhim = id;
  return rezhim;
}

// vybratSloi: каждый слой комбо включён, только если о нём просили и он готов
function vybratSloi(dannye, prosili) {
  const sloi = {};
  for (const sloy of dannye.sloiKombo) {
    const vklyuchit = Boolean(prosili && prosili[sloy.id]);
    sloi[sloy.id] = vklyuchit && sloyDostupen(dannye, sloy.id);
  }
  return sloi;
}

// nastrojkaPoUmolchaniyu: игровой режим, все слои выключены
function nastrojkaPoUmolchaniyu(dannye) {
  const nastrojka = { rezhim: dannye.poUmolchaniyu, sloi: vybratSloi(dannye, {}) };
  return nastrojka;
}

// razobratTekst: объект из JSON-строки или пустой объект
function razobratTekst(tekst) {
  let obekt = {};
  try { obekt = JSON.parse(tekst) || {}; } catch { obekt = {}; }
  return obekt;
}

// prochestNastrojku: настройка из сохранённого текста, каждое поле проверено
function prochestNastrojku(dannye, tekst) {
  const syraya = razobratTekst(tekst);
  const nastrojka = { rezhim: vybratRezhim(dannye, syraya.rezhim), sloi: vybratSloi(dannye, syraya.sloi) };
  return nastrojka;
}

// zapisatNastrojku: текст настройки для хранилища браузера
function zapisatNastrojku(nastrojka) {
  const tekst = JSON.stringify(nastrojka);
  return tekst;
}

export {
  rezhimPoId, rezhimDostupen, sloyDostupen, vybratRezhim, vybratSloi,
  nastrojkaPoUmolchaniyu, prochestNastrojku, zapisatNastrojku,
};
