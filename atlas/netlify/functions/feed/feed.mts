/* Netlify Function: Proxy für alle Live-Quellen unter /api/feed/*. Der Arbeitsspeicher-Cache gilt pro Instanz,
   den Abgleich über alle Besucher übernimmt der Netlify-CDN-Cache (siehe core.mts). */
import type { Config } from '@netlify/functions';
import { createProxy } from './core.mts';

const handle = createProxy({ fetch: globalThis.fetch.bind(globalThis), now: Date.now });

export default async (req: Request) => handle(req);

export const config: Config = { path: '/api/feed/*' };
