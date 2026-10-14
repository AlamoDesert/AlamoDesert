// Ausführen: node --experimental-strip-types --test courtside/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../netlify/functions/api/core.mts';
import { memoryStore } from '../dev/memory-store.mjs';

function client(store) {
  return async (method, path, body, key) => {
    const headers = { 'content-type': 'application/json' };
    if (key) headers.authorization = `Bearer ${key}`;
    const res = await handle(new Request('http://x/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), store);
    return { status: res.status, data: await res.json() };
  };
}

async function setup() {
  const store = memoryStore();
  const api = client(store);
  const r = await api('POST', '/events', { name: 'Padel Freitag', sport: 'padel', mode: 'americano', when: 'Fr 18 Uhr' });
  assert.equal(r.status, 201);
  return { store, api, id: r.data.event.id, admin: r.data.adminKey };
}

test('Anmeldung eröffnen, anmelden, öffentlich lesen', async () => {
  const { api, id } = await setup();
  const a = await api('POST', `/events/${id}/players`, { name: '  Anna  ', level: 'pro' });
  assert.equal(a.status, 201);
  assert.ok(a.data.token);
  const b = await api('POST', `/events/${id}/players`, { name: 'Ben', rating: '3,4' });
  assert.equal(b.data.player.level, 'intermediate');
  assert.equal(b.data.player.rating, 3.4);
  const g = await api('GET', `/events/${id}`);
  assert.deepEqual(g.data.event.players.map((p) => p.name), ['Anna', 'Ben']);
  assert.equal(g.data.admin, false);
  assert.ok(!JSON.stringify(g.data).includes('Hash'), 'keine Hashes nach außen');
});

test('Eingaben werden geprüft', async () => {
  const { api, id } = await setup();
  assert.equal((await api('POST', `/events/${id}/players`, { name: '' , level: 'pro' })).status, 400);
  assert.equal((await api('POST', `/events/${id}/players`, { name: 'X' })).status, 400);
  assert.equal((await api('POST', `/events/${id}/players`, { name: 'X', rating: 9 })).status, 400);
  await api('POST', `/events/${id}/players`, { name: 'Anna', level: 'pro' });
  assert.equal((await api('POST', `/events/${id}/players`, { name: 'anna', level: 'pro' })).status, 409);
  assert.equal((await api('GET', '/events/../../x')).status, 404);
  assert.equal((await api('POST', '/events', { name: 'X', sport: 'golf', mode: 'americano' })).status, 400);
});

test('Ändern und Abmelden nur mit eigenem Link oder als Turnierleitung', async () => {
  const { api, id, admin } = await setup();
  const a = await api('POST', `/events/${id}/players`, { name: 'Anna', level: 'pro' });
  const pid = a.data.player.id;
  assert.equal((await api('PUT', `/events/${id}/players/${pid}`, { name: 'Anna B.', level: 'pro' })).status, 403);
  assert.equal((await api('PUT', `/events/${id}/players/${pid}`, { name: 'Anna B.', level: 'pro' }, 'falsch')).status, 403);
  const ok = await api('PUT', `/events/${id}/players/${pid}`, { name: 'Anna B.', level: 'intermediate', rating: 3.1 }, a.data.token);
  assert.equal(ok.data.player.name, 'Anna B.');
  assert.equal((await api('PUT', `/events/${id}/players/${pid}`, { name: 'Anna B.', level: 'beginner' }, admin)).status, 200);
  assert.equal((await api('DELETE', `/events/${id}/players/${pid}`, null, a.data.token)).status, 200);
  assert.equal((await api('GET', `/events/${id}`)).data.event.players.length, 0);
});

test('Geschlossene Anmeldung: nur noch die Turnierleitung trägt ein', async () => {
  const { api, id, admin } = await setup();
  assert.equal((await api('PATCH', `/events/${id}`, { open: false })).status, 403);
  assert.equal((await api('PATCH', `/events/${id}`, { open: false }, admin)).data.event.open, false);
  assert.equal((await api('POST', `/events/${id}/players`, { name: 'Zu spät', level: 'pro' })).status, 409);
  assert.equal((await api('POST', `/events/${id}/players`, { name: 'Nachgemeldet', level: 'pro' }, admin)).status, 201);
  assert.equal((await api('GET', `/events/${id}`, null, admin)).data.admin, true);
});

test('Turnierleitung löscht die Anmeldung samt Einträgen', async () => {
  const { api, id, admin, store } = await setup();
  await api('POST', `/events/${id}/players`, { name: 'Anna', level: 'pro' });
  assert.equal((await api('DELETE', `/events/${id}`, null, admin)).status, 200);
  assert.equal(store.size(), 0);
  assert.equal((await api('GET', `/events/${id}`)).status, 404);
});
