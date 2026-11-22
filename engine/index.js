// Ядро коми-пермяцкого игрового календаря.
export * from './sun.js';
export * from './sutki.js';
export * from './moon.js';
export * from './anbur.js';
export * from './kalendar.js';
export * from './pasy.js';
export * from './hijri.js';
export * from './evrei.js';
export * from './prazdniki.js';
export * from './rezhimy.js';
export * from './namaz.js';
export { sutkiZmanim, zmanimDnya, METODIKA_HABAD } from './zmanim.js';
export { sloiKombo, imenaIudeev, imenaMusulman, vseTochki, sleduyushchayaTochka } from './kombo.js';
// Небо (engine/nebo.js) подключается отдельно: оно тянет большую библиотеку astronomy.js.
