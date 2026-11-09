// Speicher im Arbeitsspeicher (lokaler Server und Tests), gleiche Semantik wie der D1-Speicher.
export function memoryStore() {
  const kv = new Map();
  const blobs = new Map();
  return {
    async get(key) {
      const r = kv.get(key);
      return r ? { val: r.val, rev: r.rev, t: r.t } : null;
    },
    async put(key, val, opts = {}) {
      const cur = kv.get(key);
      const t = opts.t ?? Date.now();
      if (opts.expectRev === null && cur) return false;
      if (typeof opts.expectRev === 'number' && (!cur || cur.rev !== opts.expectRev)) return false;
      const rev = cur ? cur.rev + 1 : 1;
      kv.set(key, { val, rev, t });
      return rev;
    },
    async del(key) {
      kv.delete(key);
    },
    async list(prefix, opts = {}) {
      const hi = prefix + '￿';
      let rows = [...kv.entries()]
        .filter(([k, r]) => k >= prefix && k < hi && (opts.since == null || r.t > opts.since) && (opts.before == null || k < opts.before))
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      if (opts.desc) rows.reverse();
      if (opts.limit != null) rows = rows.slice(0, opts.limit);
      return rows.map(([key, r]) => ({ key, val: r.val, rev: r.rev, t: r.t }));
    },
    async getBlob(key) {
      const b = blobs.get(key);
      return b ? { data: new Uint8Array(b.data), type: b.type } : null;
    },
    async putBlob(key, data, type) {
      blobs.set(key, { data: new Uint8Array(data), type });
    }
  };
}
