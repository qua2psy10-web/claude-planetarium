#!/usr/bin/env python3
"""Regenerate public/data/comets.json: comet orbital elements for the planetarium.

The numbers are orbital elements (Minor Planet Center / MPEC) as collected in Stellarium's
data/ssystem_minor.ini; only the elements and brightness parameters are taken from it.

    curl -o ssystem_minor.ini https://raw.githubusercontent.com/Stellarium/stellarium/master/data/ssystem_minor.ini
    python3 scripts/build_comets.py ssystem_minor.ini

Each comet: orbit elements for J2000 ecliptic (q in AU, angles in degrees, epochs as Julian dates)
and the magnitude parameters H and K used in  m = H + 5 log10(distance to Earth) + K log10(distance to Sun).
"""
import json
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit(__doc__)

out = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'comets.json'

# Japanese names for the well-known ones, by IAU designation.
NAME_JA = {
    'P/1982 U1': 'ハレー彗星',
    'C/1956 R1': 'アレンド・ローラン彗星',
    'C/1965 S1-A': '池谷・関彗星',
    'C/1969 Y1': 'ベネット彗星',
    'C/1975 V1': 'ウェスト彗星',
    'C/1995 O1': 'ヘール・ボップ彗星',
    'C/1996 B2': '百武彗星',
    'C/2006 P1': 'マクノート彗星',
    'C/2011 W3': 'ラヴジョイ彗星',
    'C/2020 F3': 'ネオワイズ彗星',
    'C/2026 C1': '紫金山彗星',
}

text = Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
comets, seen = [], set()
for section in re.split(r'\n(?=\[)', text):
    if not re.search(r'^type\s*=\s*comet', section, re.M):
        continue
    d = {}
    for line in section.splitlines()[1:]:
        m = re.match(r'^(\w+)\s*=\s*(.*)$', line.strip())
        if m:
            d[m.group(1)] = m.group(2).strip()
    name = d['name']
    # "(2026)" and "(Great Comet of 1680)" only say which apparition the elements are for.
    name = re.sub(r'\s*\((?:\d{4}|Great Comet of \d{4})\)$', '', name)
    designation = d.get('iau_designation', '')
    # "A/..." objects are asteroids on comet-like orbits; they are never bright.
    if name.startswith('A/') or name in seen:
        continue
    seen.add(name)
    comets.append({
        'name': name,
        'designation': designation,
        'nameJa': NAME_JA.get(designation),
        'epoch': float(d['orbit_Epoch']),
        'perihelion': float(d['orbit_TimeAtPericenter']),
        'q': float(d['orbit_PericenterDistance']),
        'e': float(d['orbit_Eccentricity']),
        'i': float(d['orbit_Inclination']),
        'node': float(d['orbit_AscendingNode']),
        'peri': float(d['orbit_ArgOfPericenter']),
        'H': float(d['absolute_magnitude']),
        'K': float(d['slope_parameter']),
    })

comets.sort(key=lambda c: c['perihelion'])
payload = {
    'source': "Orbital elements from the Minor Planet Center (MPEC), via Stellarium's data/ssystem_minor.ini",
    'comets': comets,
}
out.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(comets)} comets, {out.stat().st_size} bytes; with a Japanese name: {sum(1 for c in comets if c["nameJa"])}')
