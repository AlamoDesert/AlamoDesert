"""Erzeugt public/data/seaways.bin (Seewege-Netz) und public/data/ports.json (Häfen) für searoute.js.
Quellen: Eurostat searoute „marnet_plus_10km.gpkg“ (EUPL-1.2, github.com/eurostat/searoute) und
UN/LOCODE code-list.csv (github.com/datasets/un-locode). Aufruf: python3 tools/seaways.py <marnet.gpkg> <code-list.csv>"""
import csv, json, re, sqlite3, struct, sys

def lines(path):
    db = sqlite3.connect(path)
    out = []
    for (g,) in db.execute('select geometry from type'):
        env = (g[3] >> 1) & 7
        w = g[8 + [0, 32, 48, 48, 64][env]:]
        bo = '<' if w[0] == 1 else '>'
        typ = struct.unpack(bo + 'I', w[1:5])[0] % 1000
        def ls(b, o):
            n = struct.unpack(bo + 'I', b[o:o + 4])[0]; o += 4
            pts = [struct.unpack(bo + 'dd', b[o + 16 * k:o + 16 * k + 16]) for k in range(n)]
            return pts, o + 16 * n
        if typ == 2: out.append(ls(w, 5)[0])
        elif typ == 5:
            n = struct.unpack(bo + 'I', w[5:9])[0]; o = 9
            for _ in range(n):
                p, o = ls(w, o + 5); out.append(p)
    return out

def graph(path, dst):
    nodes, edges = {}, set()
    def nid(p):
        k = (round(p[0], 3), round(p[1], 3))
        return nodes.setdefault(k, len(nodes))
    for l in lines(path):
        for a, b in zip(l, l[1:]):
            i, j = nid(a), nid(b)
            if i != j: edges.add((min(i, j), max(i, j)))
    coords = sorted(nodes, key=nodes.get)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<II', len(coords), len(edges)))
        for x, y in coords: f.write(struct.pack('<ii', round(x * 1000), round(y * 1000)))
        for i, j in sorted(edges): f.write(struct.pack('<II', i, j))

def ports(path, dst):
    def coord(s):
        m = re.match(r'(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])', s.strip())
        if not m: return None
        lat = int(m[1]) + int(m[2]) / 60; lon = int(m[4]) + int(m[5]) / 60
        return round(-lon if m[6] == 'W' else lon, 3), round(-lat if m[3] == 'S' else lat, 3)
    out = []
    for r in csv.DictReader(open(path, encoding='utf-8')):
        c = coord(r.get('Coordinates') or '')
        if r.get('Function', '')[:1] == '1' and c and r.get('Change') != 'X':
            out.append([r['Country'] + r['Location'], r['NameWoDiacritics'] or r['Name'], *c])
    json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    graph(sys.argv[1], 'public/data/seaways.bin')
    ports(sys.argv[2], 'public/data/ports.json')
