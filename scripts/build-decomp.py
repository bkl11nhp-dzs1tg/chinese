# Dựng data/decomp.json: cấu tạo chữ Hán cho mọi chữ trong nội dung học (và các thành phần của chúng).
# Nguồn: Make Me a Hanzi dictionary.txt (LGPL, từ Unihan + CJKlib) – https://github.com/skishore/makemeahanzi
# Gợi ý cấu tạo/nghĩa tiếng Anh được dịch máy sang tiếng Việt một lần (Google Dịch) và lưu cùng file.
# Chạy: python scripts/build-decomp.py <đường dẫn dictionary.txt>
import json, sys, glob, re, time, urllib.parse, urllib.request

SRC = sys.argv[1]
HAN = re.compile(r'[㐀-鿿⺀-⿟]')
mm = {}
for line in open(SRC, encoding='utf-8'):
    x = json.loads(line)
    mm[x['character']] = x

chars = set()
for f in glob.glob('data/vocab/*.csv') + glob.glob('data/lessons/*.json') + glob.glob('data/readings/*.json'):
    chars |= set(HAN.findall(open(f, encoding='utf-8').read()))
chars = {c for c in chars if c in mm}
# thêm thành phần (một cấp) để giải nghĩa thành phần
comps = set()
for c in chars:
    comps |= {k for k in HAN.findall(mm[c].get('decomposition') or '') if k in mm}
allc = sorted(chars | comps)

def translate(texts):
    out = []
    batch, size = [], 0
    def flush():
        if not batch: return
        q = '\n'.join(batch)
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + urllib.parse.quote(q)
        for attempt in range(4):
            try:
                data = json.loads(urllib.request.urlopen(url, timeout=30).read().decode('utf-8'))
                res = ''.join(seg[0] for seg in data[0] if seg and seg[0])
                parts = res.split('\n')
                if len(parts) != len(batch): parts = (parts + [''] * len(batch))[:len(batch)]
                out.extend(p.strip() for p in parts)
                break
            except Exception as e:
                time.sleep(2 + attempt * 3)
        else:
            out.extend([''] * len(batch))
        batch.clear()
        time.sleep(0.6)
    for t in texts:
        if size + len(t) > 3500: flush(); size = 0
        batch.append(t.replace('\n', ' ')); size += len(t) + 1
    flush()
    return out

defs = [(mm[c].get('definition') or '').split(';')[0][:80] for c in allc]
hints = [((mm[c].get('etymology') or {}).get('hint') or '') for c in allc]
need = [t for t in defs + hints if t]
tr = dict(zip(need, translate(need)))

out = {}
for c, d_en, h_en in zip(allc, defs, hints):
    x = mm[c]
    e = x.get('etymology') or {}
    out[c] = {k: v for k, v in {
        'd': x.get('decomposition') if x.get('decomposition') not in (None, '？') else None,
        'r': x.get('radical'),
        't': e.get('type'),
        's': e.get('semantic'),
        'p': e.get('phonetic'),
        'h': tr.get(h_en) if h_en else None,
        'm': tr.get(d_en) if d_en else None,
        'py': (x.get('pinyin') or [None])[0],
    }.items() if v}
open('data/decomp.json', 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(len(chars), 'chữ +', len(comps - chars), 'thành phần →', len(out))
