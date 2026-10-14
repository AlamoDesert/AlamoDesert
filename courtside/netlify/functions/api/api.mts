/* Netlify Function: bindet die Anmelde-API an Netlify Blobs. Läuft unter /api/*. */
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { handle } from './core.mts';

// Anmeldungen enthalten Namen: Speicherort Frankfurt (EU) statt des US-Standards.
export default async (req: Request) => handle(req, getStore({ name: 'courtside', consistency: 'strong', region: 'eu-central-1' }));

export const config: Config = { path: '/api/*' };
