import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';
import { hashPassword } from '../src/auth.ts';
import { openDb } from '../src/db.ts';

async function setup() {
  const db = openDb(':memory:');
  const add = async (name: string, pw: string) =>
    db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(name, await hashPassword(pw), 0);
  await add('alex', 'correct horse');
  await add('bob', 'bob-password');
  const app = createApp({ db, corsOrigins: ['https://example.github.io'], trustProxy: false });
  const call = (path: string, init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}) =>
    app.request(path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        'content-type': 'application/json',
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  const login = async (username: string, password: string) => {
    const res = await call('/api/auth/login', { body: { username, password } });
    return { res, json: (await res.json()) as { token?: string; error?: string } };
  };
  return { db, call, login };
}

test('login rejects bad credentials and accepts good ones', async () => {
  const { login } = await setup();
  assert.equal((await login('alex', 'wrong')).res.status, 401);
  assert.equal((await login('nobody', 'whatever')).res.status, 401);
  const ok = await login('ALEX', 'correct horse');
  assert.equal(ok.res.status, 200);
  assert.ok(ok.json.token);
});

test('protected routes need a valid token', async () => {
  const { call } = await setup();
  assert.equal((await call('/api/applications')).status, 401);
  assert.equal((await call('/api/applications', { token: 'nope' })).status, 401);
});

test('sync upserts, deletes, replaces and isolates users', async () => {
  const { call, login } = await setup();
  const alex = (await login('alex', 'correct horse')).json.token!;
  const bob = (await login('bob', 'bob-password')).json.token!;

  let res = await call('/api/applications/sync', {
    token: alex,
    body: { upsert: [{ id: 'a1', company: 'A' }, { id: 'a2', company: 'B' }] },
  });
  assert.equal(res.status, 200);
  res = await call('/api/applications/sync', { token: alex, body: { upsert: [{ id: 'a1', company: 'A2' }], delete: ['a2'] } });
  assert.equal(res.status, 200);

  let list = (await (await call('/api/applications', { token: alex })).json()) as { applications: { id: string; company: string }[] };
  assert.deepEqual(list.applications, [{ id: 'a1', company: 'A2' }]);

  const bobList = (await (await call('/api/applications', { token: bob })).json()) as { applications: unknown[] };
  assert.equal(bobList.applications.length, 0);

  await call('/api/applications/sync', { token: alex, body: { replace: true, upsert: [{ id: 'z', company: 'Z' }] } });
  list = (await (await call('/api/applications', { token: alex })).json()) as typeof list;
  assert.deepEqual(list.applications.map((a) => a.id), ['z']);

  assert.equal((await call('/api/applications/sync', { token: alex, body: { upsert: [{ id: '../x' }] } })).status, 400);
});

test('logout revokes the token; password change signs out other sessions', async () => {
  const { call, login } = await setup();
  const t1 = (await login('alex', 'correct horse')).json.token!;
  const t2 = (await login('alex', 'correct horse')).json.token!;
  assert.equal((await call('/api/auth/password', { token: t1, body: { current: 'bad', next: 'new-password-1' } })).status, 400);
  assert.equal((await call('/api/auth/password', { token: t1, body: { current: 'correct horse', next: 'new-password-1' } })).status, 200);
  assert.equal((await call('/api/me', { token: t2 })).status, 401);
  assert.equal((await call('/api/me', { token: t1 })).status, 200);
  await call('/api/auth/logout', { token: t1, method: 'POST' });
  assert.equal((await call('/api/me', { token: t1 })).status, 401);
  assert.equal((await login('alex', 'new-password-1')).res.status, 200);
});

test('login is throttled after repeated failures', async () => {
  const { login } = await setup();
  for (let i = 0; i < 10; i++) await login('bob', 'wrong-' + i);
  assert.equal((await login('bob', 'bob-password')).res.status, 429);
});

test('CORS only allows configured origins', async () => {
  const { call } = await setup();
  const ok = await call('/api/health', { headers: { origin: 'https://example.github.io' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://example.github.io');
  const bad = await call('/api/health', { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
