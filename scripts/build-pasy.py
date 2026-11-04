#!/usr/bin/env python3
"""Знаки-пасы «Солнечной восьмёрки»: числа 1–8, восьмёрки (недели) и месяцы.

Собирает из одного описания три вещи:
  data/pasy.json        — геометрия знаков и их коды (для ядра и сайта);
  web/pasy/*.svg        — каждый знак отдельным SVG;
  web/fonts/Pasy.ttf    — шрифт: знаки в области частного использования Юникода.

Запуск: python3 scripts/build-pasy.py   (нужен fontTools: pip install fonttools)
Описание знаков — docs/pasy.md. Все знаки — прямые резы: их можно вырезать ножом на дереве.
Поле знака 100×100 (y вниз), толщина реза 6.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SW = 6

# ---------- числа 1–8 ----------
# Левая рука, счёт снизу вверх: четыре ряда — пальцы (нижний ряд — первый палец).
# Пройденный палец (две борозды) — черта поперёк ряда; одна борозда — короткая вертикальная черта
# справа в следующем ряду. 1 — короткая черта внизу справа, 2 — черта в нижнем ряду,
# 3 — черта и над ней короткая, … 8 — четыре черты. Каждая черта — один рез ножом.
ROWS = [91, 64, 36, 9]
TICK = 9


def unit(n):
    full, half = divmod(n, 2)
    lines = [{'p': [[29, ROWS[i]], [71, ROWS[i]]], 'cap': 'butt'} for i in range(full)]
    if half:
        y = ROWS[full]
        lines.append({'p': [[62, y - TICK], [62, y + TICK]], 'cap': 'butt'})
    return lines, []


# ---------- восьмёрки (недели месяца) ----------
# Правая ладонь к себе: кулак — ромбик, большой палец — длинная горизонталь вправо от кулака,
# пальцы — вертикали над ней: первая над ромбиком, четвёртая над концом горизонтали.
# Кабыр (кулак) = 8, Пев = 16, Водз = 24, Шӧр = 32, Нимтӧм = 40, Чаль = 48.
FIST = [12, 88, 8]
FINGERS = [12, 38, 64, 90]


def week(k):
    lines = []
    if k >= 1:
        lines.append({'p': [[24, 88], [90, 88]], 'cap': 'butt'})
    for i, x in enumerate(FINGERS, 2):
        if k >= i:
            lines.append({'p': [[x, 70], [x, 6]], 'cap': 'butt'})
    return lines, [FIST]


# ---------- месяцы ----------
# Рисунки автора: восемь прямых по диагоналям ромба, вписанного в круг; ромб поделён на 4×4.
# Точка (u, v): (0,0) — верх ромба, (4,0) — право, (0,4) — лево, (4,4) — низ.
R, C = 44, 50
MONTH_LATTICE = [
    ('ur', 'Ур', [[(0, 1), (0, 0), (4, 0), (4, 3), (3, 3), (3, 4)], [(1, 1), (1, 3), (2, 3)], [(0, 2), (4, 2)]]),
    ('osh', 'Ош', [[(3, 4), (1, 4), (1, 2), (3, 2)], [(2, 3), (2, 1), (4, 1), (4, 3)], [(0, 3), (1, 3)], [(3, 0), (3, 1)]]),
    ('dozmor', 'Дозмӧр', [[(0, 4), (0, 2)], [(0, 3), (4, 3)], [(1, 3), (1, 4)], [(2, 3), (2, 4)],
                          [(1, 0), (1, 1), (3, 1), (3, 4)], [(2, 2), (4, 2)]]),
    ('vormos', 'Вӧрмӧс', [[(0, 1), (3, 1), (3, 0)], [(0, 2), (2, 2), (2, 0)], [(2, 3), (1, 3), (1, 4), (4, 4), (4, 0)]]),
    ('chuzhmor', 'Чужмӧр', [[(1, 2), (0, 2), (0, 3), (2, 3)], [(2, 4), (2, 0), (4, 0), (4, 2), (3, 2)], [(3, 0), (3, 1)]]),
    ('yus', 'Юсь', [[(1, 2), (0, 2), (0, 1), (2, 1), (2, 4), (3, 4), (3, 0)], [(3, 1), (4, 1)], [(3, 3), (4, 3)]]),
    ('sir', 'Сир', [[(0, 1), (1, 1)], [(1, 0), (1, 3)], [(0, 2), (3, 2), (3, 1)], [(2, 1), (2, 4), (4, 4), (4, 3), (3, 3)]]),
    ('koch', 'Кӧч', [[(0, 1), (2, 1), (2, 2), (1, 2), (1, 0)], [(2, 3), (3, 3), (3, 2)], [(1, 4), (3, 4)], [(4, 1), (4, 3)]]),
]


def lattice(u, v):
    return [round(C + R * (u - v) / 4, 2), round(C - R + R * (u + v) / 4, 2)]


def count_cuts(polys):
    """Сколько прямых резов: соседние отрезки одного направления — один рез."""
    n = 0
    for p in polys:
        dirs = [(int(math.copysign(1, b[0] - a[0])) if b[0] != a[0] else 0,
                 int(math.copysign(1, b[1] - a[1])) if b[1] != a[1] else 0) for a, b in zip(p, p[1:])]
        n += 1 + sum(1 for a, b in zip(dirs, dirs[1:]) if a != b)
    return n


def month(polys):
    return [{'p': [lattice(*q) for q in p], 'cap': 'square'} for p in polys], []


# ---------- сборка описания ----------
NUM_KP = ['ӧтік', 'кык', 'куим', 'нёль', 'вит', 'квать', 'сизим', 'кыкьямыс']
WEEKS = [('kabyr', 'Кабыр', 'кулак'), ('pev', 'Пев', 'большой палец'), ('vodz', 'Водз', 'указательный'),
         ('shor', 'Шӧр', 'средний'), ('nimtom', 'Нимтӧм', 'безымянный'), ('chal', 'Чаль', 'мизинец')]

signs = []
for n in range(1, 9):
    lines, pits = unit(n)
    signs.append({'id': f'n{n}', 'kind': 'number', 'value': n, 'kp': NUM_KP[n - 1],
                  'cp': 0xE000 + n, 'lines': lines, 'pits': pits})
for k, (sid, kp, ru) in enumerate(WEEKS):
    lines, pits = week(k)
    signs.append({'id': f'w{k + 1}', 'kind': 'eight', 'value': 8 * (k + 1), 'index': k + 1, 'kp': kp, 'ru': ru,
                  'cp': 0xE011 + k, 'lines': lines, 'pits': pits})
for m, (sid, kp, polys) in enumerate(MONTH_LATTICE, 1):
    assert count_cuts(polys) == 8, (kp, count_cuts(polys))
    lines, pits = month(polys)
    signs.append({'id': f'm{m}', 'kind': 'month', 'value': m, 'kp': kp, 'slug': sid,
                  'cp': 0xE020 + m, 'lines': lines, 'pits': pits, 'lattice': [[list(q) for q in p] for p in polys]})


# ---------- SVG ----------
def svg(s):
    paths = []
    for ln in s['lines']:
        d = 'M' + 'L'.join(f'{x:g} {y:g}' for x, y in ln['p'])
        paths.append(f'<path d="{d}" stroke-linecap="{ln["cap"]}"/>')
    pits = ''.join(f'<path d="M{x:g} {y - r:g}L{x + r:g} {y:g}L{x:g} {y + r:g}L{x - r:g} {y:g}Z" fill="currentColor"/>'
                   for x, y, r in s['pits'])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{pits}'
            f'<g fill="none" stroke="currentColor" stroke-width="{SW}" stroke-linejoin="miter">{"".join(paths)}</g></svg>\n')


# ---------- шрифт ----------
UPM, SCALE, LSB, DESC = 1000, 8, 50, 100


def to_font(x, y):
    return (round(LSB + x * SCALE), round((100 - y) * SCALE - DESC))


def seg_poly(a, b, cap):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy * SW / 2, ux * SW / 2
    ext = SW / 2 if cap == 'square' else 0
    ax, ay, bx, by = ax - ux * ext, ay - uy * ext, bx + ux * ext, by + uy * ext
    return [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]


def contours(s):
    out = []
    for ln in s['lines']:
        pts = ln['p']
        for a, b in zip(pts, pts[1:]):
            out.append(seg_poly(a, b, 'square' if ln['cap'] == 'square' else 'butt'))
    for x, y, r in s['pits']:
        out.append([(x, y - r), (x + r, y), (x, y + r), (x - r, y)])
    res = []
    for poly in out:
        fp = [to_font(x, y) for x, y in poly]
        area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(fp, fp[1:] + fp[:1]))
        if area > 0:          # TrueType: внешние контуры — по часовой стрелке
            fp.reverse()
        res.append(fp)
    return res


def build_font(path):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    names = ['.notdef', 'space'] + [s['id'] for s in signs]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    cmap = {0x20: 'space'}
    cmap.update({s['cp']: s['id'] for s in signs})
    fb.setupCharacterMap(cmap)
    glyphs, metrics = {}, {}
    pen = TTGlyphPen(None)
    pen.moveTo((100, 0)); pen.lineTo((100, 700)); pen.lineTo((500, 700)); pen.lineTo((500, 0)); pen.closePath()
    glyphs['.notdef'] = pen.glyph()
    metrics['.notdef'] = (600, 100)
    glyphs['space'] = TTGlyphPen(None).glyph()
    metrics['space'] = (400, 0)
    for s in signs:
        pen = TTGlyphPen(None)
        for c in contours(s):
            pen.moveTo(c[0])
            for p in c[1:]:
                pen.lineTo(p)
            pen.closePath()
        g = pen.glyph()
        glyphs[s['id']] = g
        metrics[s['id']] = (900, LSB)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({
        'familyName': 'Pasy', 'styleName': 'Regular',
        'copyright': '© 2026 Scatik146. Знаки-пасы «Солнечной восьмёрки».',
        'licenseDescription': 'Apache License 2.0', 'version': 'Version 1.0',
    })
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=850, usWinDescent=200,
                sxHeight=500, sCapHeight=700, achVendID='SCAT')
    fb.setupPost()
    fb.save(str(path))


if __name__ == '__main__':
    data = {
        '_comment': 'Знаки-пасы «Солнечной восьмёрки». Описание — docs/pasy.md; файл собирает scripts/build-pasy.py. '
                    'Поле 100×100, y вниз, толщина реза — stroke. lines — резы (p — точки ломаной, cap — конец реза), '
                    'pits — ромбики-ямки [x, y, полудиагональ]. cp — код в шрифте Pasy (область частного использования).',
        'stroke': SW,
        'font': 'fonts/Pasy.ttf',
        'signs': signs,
    }
    (ROOT / 'data' / 'pasy.json').write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    out = ROOT / 'web' / 'pasy'
    out.mkdir(exist_ok=True)
    for s in signs:
        name = {'number': f'chislo-{s["value"]}', 'eight': f'vosmyorka-{s["value"]}',
                'month': f'mesyac-{s["value"]}-{s.get("slug", "")}'}[s['kind']]
        (out / f'{name}.svg').write_text(svg(s), encoding='utf-8')
    build_font(ROOT / 'web' / 'fonts' / 'Pasy.ttf')
    print(f'Знаков: {len(signs)}; data/pasy.json, web/pasy/*.svg, web/fonts/Pasy.ttf')
