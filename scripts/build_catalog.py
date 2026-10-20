#!/usr/bin/env python3
"""Regenerate public/data/hyg_stars.json and constellations_lines.json from
real Hipparcos-derived data shipped in the `d3-celestial` npm package
(BSD-3-Clause; https://github.com/ofrohn/d3-celestial).

    npm pack d3-celestial@0.7.35 && tar xzf d3-celestial-*.tgz
    python3 scripts/build_catalog.py <path-to>/package/data

Output schema is unchanged (see src/types/star.ts, src/types/constellation.ts):
  hyg_stars.json            [{hip, proper, ra, dec, mag, ci, con}]  ra/dec in radians
  constellations_lines.json {abbr: [[hipA, hipB], ...]}
"""
import json
import math
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit(__doc__)

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / 'public' / 'data'

DEFAULT_BV = 0.6  # for the few stars without a B-V value
# d3-celestial splits Serpens into two parts; the app's metadata uses one 'Ser'.
CON_ALIASES = {'Ser1': 'Ser', 'Ser2': 'Ser'}


def load(name):
    return json.loads((src / name).read_text(encoding='utf-8'))


def to_star(feature, names):
    hip = int(feature['id'])
    lon, lat = feature['geometry']['coordinates']
    info = names.get(str(hip), {})
    try:
        bv = float(feature['properties'].get('bv') or DEFAULT_BV)
    except ValueError:
        bv = DEFAULT_BV
    return {
        'hip': hip,
        'proper': info.get('name', '') or '',
        'ra': round(math.radians(lon % 360.0), 6),
        'dec': round(math.radians(lat), 6),
        'mag': round(float(feature['properties']['mag']), 2),
        'ci': round(bv, 3),
        'con': info.get('c', '') or '',
    }


names = load('starnames.json')
stars = {s['hip']: s for s in (to_star(f, names) for f in load('stars.6.json')['features'])}

# Line endpoints are matched to catalog stars by position. A few can be fainter
# than mag 6, so index the mag-8 catalog as a fallback and pull those stars in.
def key(lon, lat):
    return (round(lon, 3), round(lat, 3))

by_pos = {}
for f in load('stars.6.json')['features']:
    by_pos[key(*f['geometry']['coordinates'])] = int(f['id'])
fallback = None

lines = {}
unmatched = []
for feat in load('constellations.lines.json')['features']:
    abbr = CON_ALIASES.get(feat['id'], feat['id'])
    pairs = lines.setdefault(abbr, [])
    seen = {tuple(sorted(p)) for p in pairs}
    for poly in feat['geometry']['coordinates']:
        ids = []
        for lon, lat in poly:
            hip = by_pos.get(key(lon, lat))
            if hip is None:
                if fallback is None:
                    fallback = {}
                    for f in load('stars.8.json')['features']:
                        fallback[key(*f['geometry']['coordinates'])] = f
                f = fallback.get(key(lon, lat))
                if f is None:
                    unmatched.append((abbr, lon, lat))
                else:
                    star = to_star(f, names)
                    stars[star['hip']] = star
                    by_pos[key(lon, lat)] = hip = star['hip']
            ids.append(hip)
        for a, b in zip(ids, ids[1:]):
            if a is None or b is None or a == b:
                continue
            k = tuple(sorted((a, b)))
            if k not in seen:
                seen.add(k)
                pairs.append([a, b])

if unmatched:
    sys.exit(f'{len(unmatched)} line vertices matched no star: {unmatched[:5]}')

for abbr, pairs in lines.items():
    for a, b in pairs:
        assert a in stars and b in stars, (abbr, a, b)

# Stars sorted by magnitude (brightest first); compact JSON keeps the file small.
star_list = sorted(stars.values(), key=lambda s: (s['mag'], s['hip']))
dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
(out / 'hyg_stars.json').write_text(dump(star_list), encoding='utf-8')
(out / 'constellations_lines.json').write_text(dump(lines), encoding='utf-8')

print(f'stars: {len(star_list)} (named: {sum(1 for s in star_list if s["proper"])}, '
      f'dec<0: {sum(1 for s in star_list if s["dec"] < 0)})')
print(f'constellations with lines: {len(lines)}, segments: {sum(len(p) for p in lines.values())}')
