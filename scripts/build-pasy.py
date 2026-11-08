#!/usr/bin/env python3
"""Знаки-пасы «Солнечной восьмёрки»: парадные резы и печатные знаки для строки анбура.

Собирает из одного описания три вещи:
  data/pasy.json        — геометрия знаков и их коды (для ядра и сайта);
  web/pasy/*.svg        — каждый знак отдельным SVG;
  web/fonts/Pasy.ttf    — шрифт: знаки в области частного использования Юникода.

Запуск: python3 scripts/build-pasy.py   (нужен fontTools: pip install fonttools)
Описание знаков — docs/pasy.md.

Два набора:
  * парадный (резной) — прямые резы в ромбе 4 × 4, вписанном в круг; их можно вырезать ножом.
    Дни 1–8 U+E001–E008, недели 8…48 U+E011–E016, месяцы Ур…Кӧч U+E021–E028.
  * печатный — для строки анбура: высота и толщина линии как у букв (шрифт Noto Sans Old Permic:
    высота 638, толщина 89 из 1000). Ноль U+E030, цифры 1–8 U+E031–E038, недели U+E041–E046,
    месяцы U+E051–E058. Цифры пропорциональные; табличные (одной ширины) — по OpenType tnum.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# =====================================================================================
# Парадный набор: резы в ромбе
# =====================================================================================
# Поле знака 100×100 (y вниз), толщина реза 6. Ромб 4 × 4, вписанный в круг; точка (u, v):
# (0,0) — верх ромба, (4,0) — право, (0,4) — лево, (4,4) — низ.
SW = 6
R, C = 44, 50


def lattice(u, v):
    return [round(C + R * (u - v) / 4, 2), round(C - R + R * (u + v) / 4, 2)]


# ---------- дни 1–8 ----------
# Левая рука, пальцы — четыре борозды-диагонали снизу вверх (ряд u = 4 ближе всего к правому
# нижнему краю ромба). Пройденный палец — длинный рез через весь ромб; одна борозда — короткий
# рез в полромба у правого верхнего края, над последним длинным.
def unit(n):
    k, odd = divmod(n, 2)
    rows = [4, 3, 2, 1][:k]
    v0 = 1 if odd else 0
    polys = [[(u, v0), (u, 4)] for u in rows]
    if odd:
        top = rows[-1] if rows else 4
        polys.append([(top - 2, 0), (top, 0)])
    return polys


# ---------- недели 8…48 ----------
# Правая ладонь к себе: кулак — ромбик внизу, большой палец — рез вправо-вверх от кулака,
# пальцы — резы влево-вверх над кулаком.
def week(k):
    polys = [[(3, 3), (4, 3), (4, 4), (3, 4), (3, 3)]]
    if k >= 2:
        polys.append([(3, 2), (3, 0)])
    for i, v in enumerate([3, 2, 1, 0], 3):
        if k >= i:
            polys.append([(0, v), (2, v)])
    return polys


# ---------- месяцы ----------
# Рисунки автора: восемь прямых резов по диагоналям ромба.
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


def count_cuts(polys):
    """Сколько прямых резов: соседние отрезки одного направления — один рез."""
    n = 0
    for p in polys:
        dirs = [(int(math.copysign(1, b[0] - a[0])) if b[0] != a[0] else 0,
                 int(math.copysign(1, b[1] - a[1])) if b[1] != a[1] else 0) for a, b in zip(p, p[1:])]
        n += 1 + sum(1 for a, b in zip(dirs, dirs[1:]) if a != b)
    return n


def carved_lines(polys):
    return [{'p': [lattice(*q) for q in p], 'cap': 'square'} for p in polys]


# =====================================================================================
# Печатный набор: знаки для строки анбура
# =====================================================================================
# Единицы шрифта, y вниз: верх строки 0, строка (низ) 638. Высокие знаки поднимаются до −76
# (как высокие буквы анбура), под строку знаки не опускаются. Круглое выходит за линию на 12,
# концы линий срезаны по линии горизонтально.
CAP, STEM, TOP, O = 638, 89, -76, 12
H = STEM / 2

# ---------- цифры 0–8 и недели: прямые, «ромб на ноге» ----------
SLOT = [H + i * (CAP - STEM) / 3 for i in range(4)]   # четыре ряда черт; зазор 94 ≥ толщины линии
BAR, GAP = 260, 89


def rect_poly(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def print_digit(n):
    """Чётные — горизонтали снизу вверх; нечётная единица — вертикаль справа в полтора ряда."""
    k, odd = divmod(n, 2)
    rects = [(0, SLOT[3 - i] - H, BAR, STEM) for i in range(k)]
    if odd:
        bot = CAP if k == 0 else SLOT[4 - k] + H
        top = max(bot - 272, 0)
        x = BAR + GAP if k else 0
        rects.append((x, top, STEM, bot - top))
    width = BAR + GAP + STEM if (odd and k) else (STEM if odd else BAR)
    return [rect_poly(*r) for r in rects], width


def print_zero(w=330):
    """Ноль — пустой ромб: пас без резов."""
    a = math.atan2(CAP / 2, w / 2)
    dx, dy = STEM / math.sin(a), STEM / math.cos(a)
    outer = [(w / 2, 0), (w, CAP / 2), (w / 2, CAP), (0, CAP / 2)]
    inner = [(w / 2, dy), (dx, CAP / 2), (w / 2, CAP - dy), (w - dx, CAP / 2)]
    return [outer, inner], w


FIST, FINGER_STEP = 178, 178


def print_week(k):
    """Кулак — сплошной квадрат внизу слева; большой палец — горизонталь от кулака вправо на уровне
    его верха; пальцы — вертикали над ней: первый над кулаком, четвёртый над концом горизонтали."""
    xs = [FIST / 2 + i * FINGER_STEP for i in range(4)]
    ft = CAP - FIST
    rects = [(0, ft, FIST, FIST)]
    if k >= 2:
        rects.append((FIST, ft, xs[3] + H - FIST, STEM))
    for i in range(4):
        if k >= i + 3:
            rects.append((xs[i] - H, 0, STEM, ft - STEM))
    width = FIST if k == 1 else xs[3] + H
    return [rect_poly(*r) for r in rects], width


# ---------- месяцы: линия «нитью вокруг колышков» ----------
# Элемент штриха: (x, y) — точка; (cx, cy, r, s) — окружность, s = +1 — обход по часовой, −1 — против.
# Прямые — касательные между окружностями, дуги — по окружностям. Концы за верхом или строкой
# срезаются по линии. Утверждено автором 8 ноября 2026 (Сир — вариант «г»).
# Порядок штрихов и направление от первой точки к последней — это и есть порядок росчерков пером.
PRINT_MONTHS = {
    'Ур': [[(151.0, -70), (307.3, 319, 95, 1), (151.0, 708)], [(-79.0, -70), (325.5, 507.9)]],
    'Ош': [[(50, 708), (265, 171.5, 215, 1), (372, 498.5, 107, 1), (265, 420)]],
    'Дозмӧр': [[(540, 270), (450, 122.5, 90, -1), (250, 495.5, 110, -1), (0, 270)]],
    'Вӧрмӧс': [[(300, 260), (175, 152.5, 120, -1), (260, 495.5, 110, -1), (526.8, -146)]],
    'Чужмӧр': [[(40, 340), (165, 157.5, 125, 1), (415, 480.5, 125, -1), (540, 330)]],
    'Юсь': [[(495.2, -70), (275, 490.5, 115, -1), (390, 470)], [(287.6, 303.6), (135, 210, 110, -1), (25, 400)]],
    'Сир': [[(60, 230), (170, 142.5, 110, 1), (300, 475.5, 130, 1), (560, 380)]],
    'Кӧч': [[(238.8, -70), (60, 480), (219.6, 708)], [(105.9, 306.5), (243.5, 235.6, 110, -1), (173.9, 97.3)]],
}


def _unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    return dx / L, dy / L


def _tangent(A, B):
    (ax, ay, ar, sa), (bx, by, br, sb) = A, B
    d = (bx - ax, by - ay)
    dd = d[0] ** 2 + d[1] ** 2
    k = sb * br - sa * ar
    L = math.sqrt(max(dd - k * k, 1e-9))
    rd = (-d[1], d[0])
    t = ((L * d[0] - k * rd[0]) / dd, (L * d[1] - k * rd[1]) / dd)
    rt = (-t[1], t[0])
    return (ax - sa * ar * rt[0], ay - sa * ar * rt[1]), (bx - sb * br * rt[0], by - sb * br * rt[1])


def stroke_pieces(els):
    """Штрих → куски: ('L', a, b, первый, последний), ('A', центр, r, s, угол входа, угол выхода),
    ('J', точка, направление входа, направление выхода) — острый угол."""
    E = [(e[0], e[1], 0, 1) if len(e) == 2 else e for e in els]
    segs = [_tangent(E[i], E[i + 1]) for i in range(len(E) - 1)]
    out = []
    for i, (pa, pb) in enumerate(segs):
        if i > 0:
            c = E[i]
            pin = segs[i - 1][1]
            if c[2] > 0:
                a_in = math.atan2(pin[1] - c[1], pin[0] - c[0])
                a_out = math.atan2(pa[1] - c[1], pa[0] - c[0])
                out.append(('A', (c[0], c[1]), c[2], c[3], a_in, a_out))
            else:
                out.append(('J', (c[0], c[1]), _unit(segs[i - 1][0], pin), _unit(pa, pb)))
        out.append(('L', pa, pb, i == 0, i == len(segs) - 1))
    return out


def _clip(poly, y, keep_below):
    """Отсечение многоугольника горизонталью: оставить часть с y′ ≥ y (keep_below) или y′ ≤ y."""
    inside = (lambda p: p[1] >= y) if keep_below else (lambda p: p[1] <= y)
    res = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        if inside(p):
            res.append(p)
        if inside(p) != inside(q):
            t = (y - p[1]) / (q[1] - p[1])
            res.append((p[0] + (q[0] - p[0]) * t, y))
    return res


def month_outline(strokes):
    """Контуры печатного месяца: каждый кусок штриха — отдельный контур (перекрытия заливаются)."""
    tall = any((len(e) == 2 and e[1] < TOP) or (len(e) == 4 and e[1] - e[2] < -20) for s in strokes for e in s)
    topline = TOP if tall else 0
    polys = []
    for s in strokes:
        for pc in stroke_pieces(s):
            if pc[0] == 'L':
                _, a, b, first, last = pc
                ux, uy = _unit(a, b)
                nx, ny = -uy * H, ux * H
                poly = [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]
                for end, flag in ((a, first), (b, last)):
                    if flag and end[1] > CAP:
                        poly = _clip(poly, CAP, False)
                    if flag and end[1] < topline:
                        poly = _clip(poly, topline, True)
            elif pc[0] == 'A':
                _, c, r, sgn, a_in, a_out = pc
                delta = (a_out - a_in) % (2 * math.pi) if sgn > 0 else -((a_in - a_out) % (2 * math.pi))
                n = max(8, int(abs(delta) * r / 8))
                angs = [a_in + delta * i / n for i in range(n + 1)]
                outer = [(c[0] + (r + H) * math.cos(t), c[1] + (r + H) * math.sin(t)) for t in angs]
                inner = [(c[0] + (r - H) * math.cos(t), c[1] + (r - H) * math.sin(t)) for t in angs]
                poly = outer + inner[::-1]
            else:   # острый угол: клин-«митра» с внешней стороны
                _, p, d1, d2 = pc
                n1 = (-d1[1], d1[0])
                if n1[0] * d2[0] + n1[1] * d2[1] > 0:
                    n1 = (d1[1], -d1[0])
                n2 = (-d2[1], d2[0])
                if n2[0] * d1[0] + n2[1] * d1[1] < 0:
                    n2 = (d2[1], -d2[0])
                k = H / (1 + n1[0] * n2[0] + n1[1] * n2[1])
                m = (p[0] + k * (n1[0] + n2[0]), p[1] + k * (n1[1] + n2[1]))
                poly = [p, (p[0] + H * n1[0], p[1] + H * n1[1]), m, (p[0] + H * n2[0], p[1] + H * n2[1])]
            # круглое выходит за линию не дальше чем на O
            poly = _clip(_clip(poly, CAP + O, False), topline - O, True)
            if len(poly) >= 3:
                polys.append(poly)
    x0 = min(x for p in polys for x, _ in p)
    polys = [[(x - x0, y) for x, y in p] for p in polys]
    return polys, max(x for p in polys for x, _ in p), x0


# =====================================================================================
# Сборка описания
# =====================================================================================
NUM_KP = ['ӧтік', 'кык', 'куим', 'нёль', 'вит', 'квать', 'сизим', 'кыкьямыс']
WEEKS = [('kabyr', 'Кабыр', 'кулак'), ('pev', 'Пев', 'большой палец'), ('vodz', 'Водз', 'указательный'),
         ('shor', 'Шӧр', 'средний'), ('nimtom', 'Нимтӧм', 'безымянный'), ('chal', 'Чаль', 'мизинец')]
SIDE = 80          # боковые отступы печатных знаков (у прямых букв анбура — около 90)

signs = []
for n in range(1, 9):
    signs.append({'id': f'n{n}', 'set': 'parade', 'kind': 'number', 'value': n, 'kp': NUM_KP[n - 1],
                  'cp': 0xE000 + n, 'lines': carved_lines(unit(n)), 'lattice': unit(n)})
for k, (sid, kp, ru) in enumerate(WEEKS, 1):
    signs.append({'id': f'w{k}', 'set': 'parade', 'kind': 'eight', 'value': 8 * k, 'index': k, 'kp': kp, 'ru': ru,
                  'cp': 0xE010 + k, 'lines': carved_lines(week(k)), 'lattice': week(k)})
for m, (sid, kp, polys) in enumerate(MONTH_LATTICE, 1):
    assert count_cuts(polys) == 8, (kp, count_cuts(polys))
    signs.append({'id': f'm{m}', 'set': 'parade', 'kind': 'month', 'value': m, 'number': 57 * m, 'kp': kp,
                  'slug': sid, 'cp': 0xE020 + m, 'lines': carved_lines(polys), 'lattice': polys})

for n in range(0, 9):
    polys, w = print_zero() if n == 0 else print_digit(n)
    signs.append({'id': f'p{n}', 'set': 'print', 'kind': 'digit', 'value': n,
                  'kp': NUM_KP[n - 1] if n else None, 'cp': 0xE030 + n, 'outline': polys, 'width': w})
for k, (sid, kp, ru) in enumerate(WEEKS, 1):
    polys, w = print_week(k)
    signs.append({'id': f'pw{k}', 'set': 'print', 'kind': 'eight', 'value': 8 * k, 'index': k, 'kp': kp,
                  'cp': 0xE040 + k, 'outline': polys, 'width': w})
for m, (sid, kp, _) in enumerate(MONTH_LATTICE, 1):
    polys, w, x0 = month_outline(PRINT_MONTHS[kp])
    signs.append({'id': f'pm{m}', 'set': 'print', 'kind': 'month', 'value': m, 'number': 57 * m, 'kp': kp,
                  'slug': sid, 'cp': 0xE050 + m, 'outline': polys, 'width': w, 'strokes': PRINT_MONTHS[kp],
                  'shift': round(-x0, 1)})


# =====================================================================================
# SVG
# =====================================================================================
def svg_parade(s):
    paths = ''.join('<path d="M' + 'L'.join(f'{x:g} {y:g}' for x, y in ln['p']) + f'" stroke-linecap="{ln["cap"]}"/>'
                    for ln in s['lines'])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<g fill="none" stroke="currentColor" stroke-width="{SW}" stroke-linejoin="miter">{paths}</g></svg>\n')


def svg_print(s):
    d = ''.join('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in p) + 'Z' for p in s['outline'])
    w = s['width'] + 2 * SIDE
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-SIDE} {TOP - O} {w:.0f} {CAP - TOP + 2 * O}">'
            f'<path fill="currentColor" fill-rule="evenodd" d="{d}"/></svg>\n'
            if s['kind'] == 'digit' and s['value'] == 0 else
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-SIDE} {TOP - O} {w:.0f} {CAP - TOP + 2 * O}">'
            + ''.join('<path fill="currentColor" d="M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in p) + 'Z"/>'
                      for p in s['outline']) + '</svg>\n')


# =====================================================================================
# Шрифт
# =====================================================================================
UPM, SCALE, LSB, DESC = 1000, 8, 50, 100


def parade_font_point(x, y):
    return (round(LSB + x * SCALE), round((100 - y) * SCALE - DESC))


def seg_poly(a, b, cap):
    ax, ay = a
    bx, by = b
    ux, uy = _unit(a, b)
    nx, ny = -uy * SW / 2, ux * SW / 2
    ext = SW / 2 if cap == 'square' else 0
    ax, ay, bx, by = ax - ux * ext, ay - uy * ext, bx + ux * ext, by + uy * ext
    return [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]


def _area(fp):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(fp, fp[1:] + fp[:1]))


def contours(s):
    """Контуры в единицах шрифта (y вверх). TrueType: внешние — по часовой стрелке, дыры — против."""
    res = []
    if s['set'] == 'parade':
        for ln in s['lines']:
            for a, b in zip(ln['p'], ln['p'][1:]):
                fp = [parade_font_point(x, y) for x, y in seg_poly(a, b, ln['cap'])]
                res.append(fp[::-1] if _area(fp) > 0 else fp)
        return res
    zero = s['kind'] == 'digit' and s['value'] == 0
    for i, p in enumerate(s['outline']):
        fp = [(round(SIDE + x), round(CAP - y)) for x, y in p]
        fp = [q for j, q in enumerate(fp) if q != fp[j - 1]]
        if len(fp) < 3:
            continue
        hole = zero and i == 1
        if (_area(fp) > 0) != hole:
            fp.reverse()
        res.append(fp)
    return res


def build_font(path):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    digits = [s for s in signs if s['set'] == 'print' and s['kind'] == 'digit']
    tab_w = max(s['width'] for s in digits)          # табличные цифры: одна ширина, знак по центру
    names = ['.notdef', 'space'] + [s['id'] for s in signs] + [f"{s['id']}.tnum" for s in digits]
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
        cs = contours(s)
        for c in cs:
            pen.moveTo(c[0])
            for p in c[1:]:
                pen.lineTo(p)
            pen.closePath()
        glyphs[s['id']] = pen.glyph()
        # левый отступ в hmtx должен совпадать с левым краем контура, иначе браузер
        # сдвигает знак влево (так «1» оказывалась в левой колонке)
        xmin = min(x for c in cs for x, _ in c)
        adv = 900 if s['set'] == 'parade' else round(s['width'] + 2 * SIDE)
        metrics[s['id']] = (adv, xmin)
    for s in digits:
        dx = round((tab_w - s['width']) / 2)
        pen = TTGlyphPen(None)
        cs = contours(s)
        for c in cs:
            pen.moveTo((c[0][0] + dx, c[0][1]))
            for x, y in c[1:]:
                pen.lineTo((x + dx, y))
            pen.closePath()
        glyphs[f"{s['id']}.tnum"] = pen.glyph()
        metrics[f"{s['id']}.tnum"] = (round(tab_w + 2 * SIDE), min(x for c in cs for x, _ in c) + dx)
    fb.setupGlyf(glyphs)
    for name in names:   # перекрывающиеся контуры — флаг для растеризаторов
        g = fb.font['glyf'][name]
        if g.numberOfContours > 0:
            g.flags[0] |= 0x40
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    # tnum — табличные цифры для столбцов (CSS: font-variant-numeric: tabular-nums)
    fb.addOpenTypeFeatures('languagesystem DFLT dflt;\nfeature tnum {\n'
                           + ''.join(f"  sub {s['id']} by {s['id']}.tnum;\n" for s in digits) + '} tnum;\n')
    fb.setupNameTable({
        'familyName': 'Pasy', 'styleName': 'Regular',
        'copyright': '© 2026 Scatik146. Знаки-пасы «Солнечной восьмёрки».',
        'licenseDescription': 'Apache License 2.0', 'version': 'Version 2.0',
    })
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=850, usWinDescent=200,
                sxHeight=500, sCapHeight=CAP, achVendID='SCAT')
    fb.setupPost()
    fb.save(str(path))


def file_name(s):
    if s['set'] == 'parade':
        return {'number': f'chislo-{s["value"]}', 'eight': f'vosmyorka-{s["value"]}',
                'month': f'mesyac-{s["value"]}-{s.get("slug", "")}'}[s['kind']]
    return {'digit': f'pechat-cifra-{s["value"]}', 'eight': f'pechat-vosmyorka-{s["value"]}',
            'month': f'pechat-mesyac-{s["value"]}-{s.get("slug", "")}'}[s['kind']]


if __name__ == '__main__':
    def rnd(p):
        return [[round(x, 1), round(y, 1)] for x, y in p]
    out_signs = []
    for s in signs:
        o = dict(s)
        if 'outline' in o:
            o['outline'] = [rnd(p) for p in o['outline']]
            o['width'] = round(o['width'], 1)
        out_signs.append(o)
    data = {
        '_comment': 'Знаки-пасы «Солнечной восьмёрки». Описание — docs/pasy.md; файл собирает scripts/build-pasy.py. '
                    'set: parade — резы в ромбе (поле 100×100, y вниз; lines — резы, p — точки ломаной, cap — конец '
                    'реза; lattice — узлы ромба 4×4); print — печатные знаки для строки анбура (единицы шрифта из 1000, '
                    'y вниз: верх строки 0, строка 638; outline — залитые многоугольники, width — ширина без отступов; у месяцев strokes — линии пера, shift — сдвиг x линий к контуру). '
                    'cp — код в шрифте Pasy (область частного использования).',
        'stroke': SW,
        'print': {'cap': CAP, 'stem': STEM, 'top': TOP, 'side': SIDE},
        'font': 'fonts/Pasy.ttf',
        'signs': out_signs,
    }
    (ROOT / 'data' / 'pasy.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n',
                                             encoding='utf-8')
    out = ROOT / 'web' / 'pasy'
    out.mkdir(exist_ok=True)
    for s in signs:
        (out / f'{file_name(s)}.svg').write_text(svg_parade(s) if s['set'] == 'parade' else svg_print(s),
                                                 encoding='utf-8')
    build_font(ROOT / 'web' / 'fonts' / 'Pasy.ttf')
    print(f'Знаков: {len(signs)}; data/pasy.json, web/pasy/*.svg, web/fonts/Pasy.ttf')
