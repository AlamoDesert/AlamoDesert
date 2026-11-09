/* Speicher auf Cloudflare D1 (SQLite). Die D1-Schnittstelle ist hier nur so weit typisiert, wie sie genutzt wird. */
import type { Store, Row } from './core.mts';

export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown[]>;
}

export const SCHEMA_STATEMENTS: string[] = [
  'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, rev INTEGER NOT NULL, t INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS kv_t ON kv (t)',
  'CREATE TABLE IF NOT EXISTS blobs (k TEXT PRIMARY KEY, data BLOB NOT NULL, type TEXT NOT NULL, t INTEGER NOT NULL)'
];

export function ensureSchema(db: D1Like): Promise<unknown[]> {
  return db.batch(SCHEMA_STATEMENTS.map((s) => db.prepare(s)));
}

function toBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return Uint8Array.from(v as number[]); // D1 liefert BLOBs als Zahlenlisten
  return new Uint8Array(0);
}

export function d1Store(db: D1Like): Store {
  return {
    async get(key) {
      const r = await db.prepare('SELECT v, rev, t FROM kv WHERE k = ?').bind(key).first<{ v: string; rev: number; t: number }>();
      return r ? { val: r.v, rev: r.rev, t: r.t } : null;
    },

    async put(key, val, opts = {}) {
      const t = opts.t ?? Date.now();
      if (opts.expectRev === null) {
        const r = await db.prepare('INSERT INTO kv (k, v, rev, t) VALUES (?, ?, 1, ?) ON CONFLICT(k) DO NOTHING').bind(key, val, t).run();
        return r.meta.changes > 0 ? 1 : false;
      }
      if (typeof opts.expectRev === 'number') {
        const r = await db.prepare('UPDATE kv SET v = ?, rev = rev + 1, t = ? WHERE k = ? AND rev = ?').bind(val, t, key, opts.expectRev).run();
        return r.meta.changes > 0 ? opts.expectRev + 1 : false;
      }
      await db.prepare(
        'INSERT INTO kv (k, v, rev, t) VALUES (?, ?, 1, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = kv.rev + 1, t = excluded.t'
      ).bind(key, val, t).run();
      const r = await db.prepare('SELECT rev FROM kv WHERE k = ?').bind(key).first<{ rev: number }>();
      return r ? r.rev : 1;
    },

    async del(key) {
      await db.prepare('DELETE FROM kv WHERE k = ?').bind(key).run();
    },

    async list(prefix, opts = {}) {
      let sql = 'SELECT k, v, rev, t FROM kv WHERE k >= ? AND k < ?';
      const args: unknown[] = [prefix, prefix + '￿'];
      if (opts.since != null) { sql += ' AND t > ?'; args.push(opts.since); }
      if (opts.before != null) { sql += ' AND k < ?'; args.push(opts.before); }
      sql += opts.desc ? ' ORDER BY k DESC' : ' ORDER BY k ASC';
      if (opts.limit != null) { sql += ' LIMIT ?'; args.push(opts.limit); }
      const { results } = await db.prepare(sql).bind(...args).all<{ k: string; v: string; rev: number; t: number }>();
      return results.map((r): Row => ({ key: r.k, val: r.v, rev: r.rev, t: r.t }));
    },

    async getBlob(key) {
      const r = await db.prepare('SELECT data, type FROM blobs WHERE k = ?').bind(key).first<{ data: unknown; type: string }>();
      return r ? { data: toBytes(r.data), type: r.type } : null;
    },

    async putBlob(key, data, type) {
      await db.prepare('INSERT OR REPLACE INTO blobs (k, data, type, t) VALUES (?, ?, ?, ?)').bind(key, data, type, Date.now()).run();
    }
  };
}
