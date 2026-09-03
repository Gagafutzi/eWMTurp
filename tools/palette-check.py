#!/usr/bin/env python3
"""
Check that the eight colour stimuli are actually far enough apart.

The palette this replaced had a red and a magenta 0.093 apart in OKLab, which
made some trials a test of eyesight rather than of memory. This reads COLORS out
of js/02-words.js -- the file that ships, not a copy kept in step by hand -- and
fails if any pair falls back under the floors.

Stdlib only. Run:  python3 tools/palette-check.py
"""

import itertools
import math
import os
import re
import sys

# Distances are floors, not targets: every pair must clear them.
MIN_NORMAL = 0.19      # OKLab, normal colour vision
MIN_CVD    = 0.12      # the same under simulated deuteranopia / protanopia
MIN_HUE    = 32.0      # degrees, so that no two colours answer to one name

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def srgb_to_linear(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(h):
    h = h.lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def oklab(r, g, b):
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)


# Vienot, Brettel & Mollon (1999): project onto the dichromat's reduced gamut.
RGB2LMS = [[17.8824, 43.5161, 4.11935],
           [3.45565, 27.1554, 3.86714],
           [0.0299566, 0.184309, 1.46709]]
LMS2RGB = [[0.080944, -0.130504, 0.116721],
           [-0.010248, 0.054019, -0.113614],
           [-0.000365, -0.004122, 0.693513]]


def _mul(mat, v):
    return [sum(mat[i][j] * v[j] for j in range(3)) for i in range(3)]


def simulate(rgb, kind):
    L, M, S = _mul(RGB2LMS, list(rgb))
    if kind == 'prot':
        L = 2.02344 * M - 2.52581 * S
    elif kind == 'deut':
        M = 0.494207 * L + 1.24827 * S
    return tuple(_mul(LMS2RGB, [L, M, S]))


def distance(a, b):
    return math.dist(oklab(*a), oklab(*b))


def read_palette():
    path = os.path.join(ROOT, 'js', '02-words.js')
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    match = re.search(r'^const COLORS = \[(.*?)\];', src, re.M)
    if not match:
        sys.exit('could not find `const COLORS` in js/02-words.js')
    return re.findall(r'#[0-9A-Fa-f]{6}', match.group(1))


def main():
    hexes = read_palette()
    failures = []

    if len(hexes) != len(set(h.upper() for h in hexes)):
        failures.append('the palette repeats a colour')

    cols = [hex_to_linear(h) for h in hexes]
    pairs = []
    for i, j in itertools.combinations(range(len(cols)), 2):
        pairs.append((
            distance(cols[i], cols[j]),
            distance(simulate(cols[i], 'deut'), simulate(cols[j], 'deut')),
            distance(simulate(cols[i], 'prot'), simulate(cols[j], 'prot')),
            hexes[i], hexes[j]))
    pairs.sort()

    hues = []
    for h in hexes:
        L, a, b = oklab(*hex_to_linear(h))
        chroma = math.hypot(a, b)
        hues.append(None if chroma < 0.04 else (math.degrees(math.atan2(b, a)) + 360) % 360)
    gaps = [min(abs(hues[i] - hues[j]), 360 - abs(hues[i] - hues[j]))
            for i, j in itertools.combinations(range(len(hues)), 2)
            if hues[i] is not None and hues[j] is not None]

    print('%d colours: %s' % (len(hexes), ' '.join(hexes)))
    print('closest pairs:')
    for d, dd, dp, x, y in pairs[:3]:
        print('  %s vs %s   normal %.3f  deuter %.3f  protan %.3f' % (x, y, d, dd, dp))
    print('floors: normal %.3f  deuter %.3f  protan %.3f  hue gap %.0f deg'
          % (pairs[0][0], min(p[1] for p in pairs), min(p[2] for p in pairs), min(gaps)))

    if pairs[0][0] < MIN_NORMAL:
        failures.append('normal-vision floor %.3f is under %.2f' % (pairs[0][0], MIN_NORMAL))
    for label, k in (('deuteranopia', 1), ('protanopia', 2)):
        floor = min(p[k] for p in pairs)
        if floor < MIN_CVD:
            failures.append('%s floor %.3f is under %.2f' % (label, floor, MIN_CVD))
    if min(gaps) < MIN_HUE:
        failures.append('two colours are %.0f deg apart in hue, under %.0f' % (min(gaps), MIN_HUE))

    if failures:
        for f in failures:
            print('FAIL: ' + f)
        return 1
    print('PASS: every pair clears the floor')
    return 0


if __name__ == '__main__':
    sys.exit(main())
