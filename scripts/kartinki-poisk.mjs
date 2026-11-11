// Поиск картинок для листов календаря на Викискладе (Wikimedia Commons).
// Запускается на GitHub (временная ветка kartinki-poisk): скачивает уменьшенные копии
// кандидатов и записывает автора, лицензию и ссылку на источник в kartinki-poisk/kandidaty.json.
// Выбор делается вручную; в сайт попадают только выбранные файлы.

import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'komi-perm-game-calendar/1.0 (https://github.com/Scatik146/komi-perm-game-calendar)';
const OUT = 'kartinki-poisk';
const OK_LICENSE = /^(CC0|CC BY(-SA)? [1-4]\.0|CC BY(-SA)? 2\.5|Public domain|PD|cc-by|cc-by-sa)/i;

const TASKS = [
  // гербы районов
  { id: 'gerb-gainy', q: ['Coat of arms Gainsky', 'Coat of Arms of Gaynsky', 'Герб Гайнского'] },
  { id: 'gerb-kosa', q: ['Coat of arms Kosinsky rayon', 'Coat of Arms of Kosinsky', 'Герб Косинского'] },
  { id: 'gerb-kochevo', q: ['Coat of arms Kochyovsky', 'Coat of Arms of Kochevsky', 'Герб Кочёвского', 'Герб Кочевского'] },
  { id: 'gerb-yusva', q: ['Coat of arms Yusvinsky', 'Coat of Arms of Yusvinsky', 'Герб Юсьвинского'] },
  { id: 'gerb-kudymkar', q: ['Coat of arms Kudymkarsky', 'Coat of Arms of Kudymkarsky', 'Герб Кудымкарского'] },
  { id: 'gerb-yurla', q: ['Coat of arms Yurlinsky', 'Coat of Arms of Yurlinsky', 'Герб Юрлинского'] },
  { id: 'gerb-cherdyn', q: ['Coat of arms Cherdynsky', 'Coat of Arms of Cherdynsky rayon', 'Герб Чердынского'] },
  { id: 'gerb-koygorodok', q: ['Coat of arms Koygorodsky', 'Coat of Arms of Koigorodsky', 'Герб Койгородского'] },
  // звери-защитники
  { id: 'zver-ur', q: ['Sciurus vulgaris winter snow', 'Sciurus vulgaris'], n: 8 },
  { id: 'zver-osh', q: ['Ursus arctos forest Russia', 'Ursus arctos'], n: 8 },
  { id: 'zver-dozmor', q: ['Tetrao urogallus male', 'Tetrao urogallus lek'], n: 8 },
  { id: 'zver-vormos', q: ['Alces alces forest', 'Alces alces Russia'], n: 8 },
  { id: 'zver-chuzhmor', q: ['Mustela erminea summer', 'Mustela erminea'], n: 8 },
  { id: 'zver-yus', q: ['Cygnus cygnus', 'Cygnus cygnus flying'], n: 8 },
  { id: 'zver-sir', q: ['Esox lucius', 'Esox lucius underwater'], n: 8 },
  { id: 'zver-koch', q: ['Lepus timidus winter', 'Lepus timidus'], n: 8 },
  // виды районов
  { id: 'vid-gainy', cat: ['Gaynsky District', 'Gayny'], q: ['Гайны Кама', 'Gayny Perm Krai'], n: 10 },
  { id: 'vid-kosa', cat: ['Kosinsky District', 'Kosa, Perm Krai'], q: ['Коса Пермский край', 'Kosa river Perm'], n: 10 },
  { id: 'vid-kochevo', cat: ['Kochyovsky District', 'Kochyovo'], q: ['Кочёво', 'Kochevo Perm'], n: 10 },
  { id: 'vid-yusva', cat: ['Yusvinsky District', 'Yusva'], q: ['Юсьва село', 'Yusva Perm Krai'], n: 10 },
  { id: 'vid-kudymkar', cat: ['Kudymkarsky District', 'Kudymkar'], q: ['Кудымкар Иньва', 'Kudymkar Inva river'], n: 10 },
  { id: 'vid-yurla', cat: ['Yurlinsky District', 'Yurla'], q: ['Юрла Пермский край', 'Yurla Perm'], n: 10 },
  { id: 'vid-cherdyn', cat: ['Cherdynsky District', 'Cherdyn'], q: ['Чердынь Колва', 'Cherdyn Kolva'], n: 10 },
  { id: 'vid-koygorodok', cat: ['Koygorodsky District', 'Koygorodok', 'Koygorodsky National Park'], q: ['Койгородок', 'Койгородский национальный парк'], n: 10 },
];

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
  }
  throw new Error(`API: ${url}`);
}

const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function info(titles) {
  if (!titles.length) return [];
  const d = await api({
    action: 'query', titles: titles.join('|'), prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: '800',
  });
  return (d.query?.pages || []).filter((p) => p.imageinfo).map((p) => {
    const ii = p.imageinfo[0];
    const m = ii.extmetadata || {};
    return {
      title: p.title,
      page: ii.descriptionurl,
      thumb: ii.thumburl,
      original: ii.url,
      mime: ii.mime,
      width: ii.width,
      height: ii.height,
      author: strip(m.Artist?.value),
      license: strip(m.LicenseShortName?.value),
      licenseUrl: m.LicenseUrl?.value || '',
      credit: strip(m.Credit?.value).slice(0, 200),
      description: strip(m.ImageDescription?.value).slice(0, 300),
      categories: strip(m.Categories?.value).slice(0, 300),
    };
  });
}

async function search(q, limit) {
  const d = await api({ action: 'query', list: 'search', srsearch: q, srnamespace: '6', srlimit: String(limit) });
  return (d.query?.search || []).map((x) => x.title);
}

async function category(cat, limit) {
  const d = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmtype: 'file', cmlimit: String(limit) });
  return (d.query?.categorymembers || []).map((x) => x.title);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const result = {};
  for (const t of TASKS) {
    const n = t.n || 4;
    const titles = new Set();
    for (const c of t.cat || []) {
      try { for (const x of await category(c, 30)) titles.add(x); } catch { /* нет категории */ }
    }
    for (const q of t.q) {
      try { for (const x of await search(q, 12)) titles.add(x); } catch { /* пусто */ }
    }
    const all = [];
    const list = [...titles].filter((x) => /\.(jpe?g|png|svg|webp|tiff?)$/i.test(x));
    for (let i = 0; i < list.length; i += 40) all.push(...await info(list.slice(i, i + 40)));
    const good = all.filter((x) => OK_LICENSE.test(x.license) || /^(Public domain|PD)/i.test(x.license) || t.id.startsWith('gerb'));
    const picked = good.slice(0, t.id.startsWith('vid') ? n * 2 : n * 2);
    result[t.id] = [];
    let i = 0;
    for (const x of picked) {
      i++;
      const ext = x.mime === 'image/png' || x.mime === 'image/svg+xml' ? 'png' : 'jpg';
      const file = `${t.id}-${String(i).padStart(2, '0')}.${ext}`;
      try {
        const r = await fetch(x.thumb, { headers: { 'User-Agent': UA } });
        if (!r.ok) continue;
        await writeFile(`${OUT}/${file}`, Buffer.from(await r.arrayBuffer()));
        result[t.id].push({ file, ...x });
      } catch { /* пропуск */ }
      await new Promise((s) => setTimeout(s, 300));
    }
    console.log(t.id, result[t.id].length, 'из', all.length);
  }
  await writeFile(`${OUT}/kandidaty.json`, JSON.stringify(result, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
