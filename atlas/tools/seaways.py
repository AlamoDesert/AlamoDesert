"""Erzeugt public/data/seaways.bin (Seewege-Netz) und die gepackte Fassung seaways.bin.gz für searoute.js.
Quelle: Eurostat searoute „marnet_plus_10km.gpkg“ (EUPL-1.2, github.com/eurostat/searoute).
Aufruf: python3 tools/seaways.py <marnet.gpkg> (Häfen: node tools/ports.mjs)"""
import gzip, sqlite3, struct, sys

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

if __name__ == '__main__':
    graph(sys.argv[1], 'public/data/seaways.bin')
    # Cloudflare komprimiert .bin nicht selbst: gepackte Fassung daneben legen (searoute.js lädt sie, wenn der Browser
    # sie entpacken kann). Häfen erzeugt tools/ports.mjs.
    with open('public/data/seaways.bin', 'rb') as src, open('public/data/seaways.bin.gz', 'wb') as dst:
        dst.write(gzip.compress(src.read(), 9, mtime=0))
