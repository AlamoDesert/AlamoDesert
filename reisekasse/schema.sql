-- Reisekasse: Schlüssel-Wert-Speicher auf D1. Einmalig: npx wrangler d1 execute reisekasse --remote --file=schema.sql
-- (die Pages Function legt die Tabellen beim ersten Aufruf auch selbst an)
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, rev INTEGER NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS kv_t ON kv (t);
CREATE TABLE IF NOT EXISTS blobs (k TEXT PRIMARY KEY, data BLOB NOT NULL, type TEXT NOT NULL, t INTEGER NOT NULL);
