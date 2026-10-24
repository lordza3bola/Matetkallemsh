"""Convert Matetkallemsh-Titles.xlsx (sheet '3anaween') into js/titles.js.

Usage: python3 tools/xlsx_to_titles.py Matetkallemsh-Titles.xlsx js/titles.js
Rows with Status 'Shilo' are left out. Era and first letter are computed by the app.
"""
import json
import sys
from openpyxl import load_workbook

ERA = lambda y: '' if not y else ('Abyad w eswed' if y < 1970 else '70s-90s' if y < 2000 else '2000s' if y < 2015 else 'Gedeed')

src, out = sys.argv[1], sys.argv[2]
ws = load_workbook(src, data_only=False)['3anaween']
head = [c.value for c in ws[1]]
col = {h: i for i, h in enumerate(head)}
need = ['El 3onwan', 'Franco (lel ba7th)', 'El no3', 'El sana', 'El mostawa', 'El genre',
        'El batal / batala', 'Esm sha5seya', 'Efeh mashhoora', 'Status']
missing = [n for n in need if n not in col]
if missing:
    sys.exit(f'Missing columns: {missing}')

titles, seen = [], set()
for row in ws.iter_rows(min_row=2, values_only=True):
    t = (row[col['El 3onwan']] or '').strip() if isinstance(row[col['El 3onwan']], str) else ''
    if not t:
        continue
    status = (row[col['Status']] or '').strip()
    if status == 'Shilo':
        continue
    if t in seen:
        continue
    seen.add(t)
    try:
        y = int(row[col['El sana']] or 0)
    except (TypeError, ValueError):
        y = 0
    s = lambda k: (str(row[col[k]]).strip() if row[col[k]] is not None else '')
    titles.append({
        'id': f't{len(titles) + 1}', 't': t, 'f': s('Franco (lel ba7th)'), 'k': s('El no3') or 'Film',
        'y': y, 'e': ERA(y), 'd': s('El mostawa') or 'Wasat', 'g': s('El genre'), 'l': s('El batal / batala'),
        'c': s('Esm sha5seya'), 'q': s('Efeh mashhoora'),
    })

with open(out, 'w', encoding='utf-8') as f:
    f.write('// Generated from Matetkallemsh-Titles.xlsx by tools/xlsx_to_titles.py — edit the sheet, then re-run.\n')
    f.write('export const TITLES = ')
    json.dump(titles, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print(len(titles), 'titles ->', out)
