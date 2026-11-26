# Thêm âm Hán Việt vào data/decomp.json (trường "hv": { "jian4": ["kiện"], ... } theo từng cách đọc pinyin).
# Nguồn:
#   - hanviet.csv của ph0ngp/hanviet-pinyin-wordlist (MIT, dựa trên Hán Việt tự điển – Thiều Chửu 1942),
#     chỉ có chữ phồn thể: https://github.com/ph0ngp/hanviet-pinyin-wordlist
#   - Unihan_Variants.txt (Unicode License) để đổi giản thể -> phồn thể (kTraditionalVariant).
# Chạy: python scripts/add-hanviet.py <hanviet.csv> <Unihan_Variants.txt>
import csv, ast, json, sys

CSV, VARIANTS = sys.argv[1], sys.argv[2]
DECOMP = 'data/decomp.json'

hv = {}  # (char, 'jian4') -> [readings]
for row in csv.DictReader(open(CSV, encoding='utf-8')):
    key = (row['char'], row['pinyin'].replace('u:', 'v'))
    for r in ast.literal_eval(row['hanviet']):
        lst = hv.setdefault(key, [])
        if r not in lst:
            lst.append(r)

trad = {}
cp = lambda s: chr(int(s[2:].split('<')[0], 16))
for line in open(VARIANTS, encoding='utf-8'):
    if '\tkTraditionalVariant\t' in line:
        a, _, v = line.rstrip('\n').split('\t')
        trad[cp(a)] = [cp(x) for x in v.split()]

data = json.load(open(DECOMP, encoding='utf-8'))
by_char = {}
for (k, p), r in hv.items():
    by_char.setdefault(k, {})[p] = r

hit = 0
for ch, x in data.items():
    if len(ch) != 1 or not ('㐀' <= ch <= '鿿'):
        continue
    r = {}
    for c in [ch] + trad.get(ch, []):
        for p, lst in by_char.get(c, {}).items():
            cur = r.setdefault(p, [])
            cur += [v for v in lst if v not in cur]
    if r:
        x['hv'] = r
        hit += 1
    else:
        x.pop('hv', None)

json.dump(data, open(DECOMP, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('hanviet:', hit, '/', sum(1 for c in data if len(c) == 1 and '㐀' <= c <= '鿿'))
