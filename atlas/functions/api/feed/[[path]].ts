/* Cloudflare Pages Function: derselbe Proxy wie bei Netlify (netlify/functions/feed), nur andere Anbindung.
   Pfad /api/feed/* – der Arbeitsspeicher-Cache gilt pro Worker-Instanz. */
import { createProxy } from '../../../netlify/functions/feed/core.mts';

const handle = createProxy({ fetch: (input, init) => fetch(input, init), now: Date.now });

export const onRequest = (ctx: { request: Request }) => handle(ctx.request);
