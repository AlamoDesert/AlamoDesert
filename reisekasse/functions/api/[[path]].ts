/* Cloudflare Pages Function: Reisekasse-API unter /api/*, Speicher ist die D1-Datenbank (Bindung DB). */
import { handle } from '../../server/core.mts';
import { d1Store, ensureSchema } from '../../server/d1-store.mts';
import type { D1Like } from '../../server/d1-store.mts';

interface Env { DB?: D1Like }
interface Ctx { request: Request; env: Env }

// Tabellen pro Worker-Instanz nur einmal anlegen (CREATE IF NOT EXISTS ist harmlos, spart aber Aufrufe).
let schemaReady: Promise<unknown> | null = null;

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const db = ctx.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Speicher nicht eingerichtet.' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
  if (!schemaReady) schemaReady = ensureSchema(db).catch((e) => { schemaReady = null; throw e; });
  await schemaReady;
  return handle(ctx.request, d1Store(db));
};
