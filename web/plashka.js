// Дата резами на плашке: парадные знаки (резы в ромбе) из data/pasy.json.
// Используют «Пишем анбуром» и «Календарь».

/** Словарь парадных знаков по id (n1…n8, w1…w6, m1…m8) из data/pasy.json. */
export function paradeSigns(pasy) {
  return Object.fromEntries(pasy.signs.filter((s) => s.set === 'parade').map((s) => [s.id, s]));
}

/** Резы одного знака в клетке 100×100 со сдвигом (x, y); разметка — круг и ромб 4×4. */
function cellSvg(signs, id, x, y, guides) {
  const s = signs[id];
  let g = '';
  if (guides) {
    const R = 44, C = 50;
    const pt = (u, v) => [C + R * (u - v) / 4, C - R + R * (u + v) / 4];
    g += '<circle cx="50" cy="50" r="47" class="pl-mark"/>';
    for (let i = 0; i <= 4; i++) {
      g += `<path class="pl-mark" d="M${pt(i, 0)}L${pt(i, 4)}M${pt(0, i)}L${pt(4, i)}"/>`;
    }
  }
  const cuts = s.lines.map((l) => `M${l.p.map((q) => q.join(' ')).join('L')}`).join('');
  return `<g transform="translate(${x} ${y})">${g}<path class="pl-cut" d="${cuts}"/><path class="pl-groove" d="${cuts}"/></g>`;
}

/** Ряды знаков для плашки: дата тремя знаками (или числами по местам), ниже — год по местам. */
export function plankRows(d, { digits = false, year = null } = {}) {
  const rows = [digits ? [d.month, d.week, d.day].map((n) => `n${n}`) : [`m${d.month}`, `w${d.week}`, `n${d.day}`]];
  if (year && year.era >= 1) rows.push([year.era, year.circle, year.octave, year.year].map((n) => `n${n}`));
  return rows;
}

/** SVG плашки: строки знаков по центру на деревянной доске. */
export function plankSvg(signs, rows, { guides = false, label = 'Дата резами на плашке' } = {}) {
  const cell = 100, gap = 18, pad = 28;
  const w = Math.max(...rows.map((r) => r.length)) * (cell + gap) - gap + pad * 2;
  const h = rows.length * (cell + gap) - gap + pad * 2;
  let body = '';
  rows.forEach((r, j) => {
    const x0 = (w - (r.length * (cell + gap) - gap)) / 2;
    r.forEach((id, i) => { body += cellSvg(signs, id, x0 + i * (cell + gap), pad + j * (cell + gap), guides); });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" role="img" aria-label="${label}">`
    + '<style>.pl-cut{fill:none;stroke:#4b2e1a;stroke-width:6;stroke-linecap:square;stroke-linejoin:miter}'
    + '.pl-groove{fill:none;stroke:#86552f;stroke-width:1.6;stroke-linecap:square}'
    + '.pl-mark{fill:none;stroke:#b08a5e;stroke-width:0.6}</style>'
    + `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="10" fill="#dcbf8f" stroke="#8b5e34" stroke-width="4"/>`
    + `${body}</svg>`;
}

/** Скачать SVG-строку файлом SVG или PNG (вдвое крупнее). */
export function saveSvg(svg, name, kind, download) {
  if (kind === 'svg') { download(`${name}.svg`, new Blob([svg], { type: 'image/svg+xml' })); return; }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width * 2; c.height = img.height * 2;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => b && download(`${name}.png`, b), 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
