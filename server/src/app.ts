import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import {
  MIN_PASSWORD,
  clearFailures,
  createSession,
  deleteOtherSessions,
  deleteSession,
  dummyVerify,
  hashPassword,
  isThrottled,
  recordFailure,
  userForToken,
  verifyPassword,
  type User,
} from './auth.ts';
import { transaction, type DB } from './db.ts';

export interface Options {
  db: DB;
  /** Allowed browser origins, e.g. https://user.github.io. Empty = same-origin only. */
  corsOrigins: string[];
  /** Read the client IP from X-Forwarded-For (only behind a reverse proxy you control). */
  trustProxy: boolean;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_APP_BYTES = 256 * 1024;
const MAX_APPS_PER_USER = 5000;

type Env = { Variables: { user: User; token: string } };

export function createApp({ db, corsOrigins, trustProxy }: Options) {
  const app = new Hono<Env>();

  app.use('*', secureHeaders());
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (corsOrigins.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86400,
    }),
  );
  app.use('/api/*', bodyLimit({ maxSize: 8 * 1024 * 1024, onError: (c) => c.json({ error: 'Слишком большой запрос' }, 413) }));

  app.get('/api/health', (c) => c.json({ ok: true }));

  const clientIp = (c: Context) => {
    if (trustProxy) {
      const fwd = c.req.header('x-forwarded-for');
      if (fwd) return fwd.split(',')[0].trim();
    }
    try {
      return getConnInfo(c).remote.address ?? 'unknown';
    } catch {
      return 'unknown';
    }
  };

  /* ─── Auth ─── */

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) return c.json({ error: 'Введите логин и пароль' }, 400);

    const keys = [`ip:${clientIp(c)}`, `user:${username.toLowerCase()}`];
    if (isThrottled(...keys)) return c.json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' }, 429);

    const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as
      | { id: number; username: string; password_hash: string }
      | undefined;
    const ok = row ? await verifyPassword(password, row.password_hash) : await dummyVerify(password);
    if (!row || !ok) {
      recordFailure(...keys);
      return c.json({ error: 'Неверный логин или пароль' }, 401);
    }
    clearFailures(...keys);
    const token = createSession(db, row.id);
    return c.json({ token, user: { username: row.username } });
  });

  /** Everything below requires a valid bearer token. */
  app.use('/api/*', async (c, next) => {
    const m = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '');
    const user = m ? userForToken(db, m[1]) : null;
    if (!m || !user) return c.json({ error: 'Требуется вход' }, 401);
    c.set('user', user);
    c.set('token', m[1]);
    await next();
  });

  app.get('/api/me', (c) => c.json({ user: { username: c.get('user').username } }));

  app.post('/api/auth/logout', (c) => {
    deleteSession(db, c.get('token'));
    return c.json({ ok: true });
  });

  app.post('/api/auth/password', async (c) => {
    const body = await c.req.json().catch(() => null);
    const current = typeof body?.current === 'string' ? body.current : '';
    const next = typeof body?.next === 'string' ? body.next : '';
    if (next.length < MIN_PASSWORD) return c.json({ error: `Новый пароль — минимум ${MIN_PASSWORD} символов` }, 400);
    const user = c.get('user');
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!(await verifyPassword(current, row.password_hash))) return c.json({ error: 'Текущий пароль неверный' }, 400);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), user.id);
    deleteOtherSessions(db, user.id, c.get('token'));
    return c.json({ ok: true });
  });

  /* ─── Applications ─── */

  app.get('/api/applications', (c) => {
    const rows = db
      .prepare('SELECT data FROM applications WHERE user_id = ? ORDER BY updated_at DESC')
      .all(c.get('user').id) as { data: string }[];
    return c.json({ applications: rows.map((r) => JSON.parse(r.data)) });
  });

  /**
   * Batched changes from the client: upsert whole records, delete by id.
   * `replace: true` drops everything not in `upsert` (import / clear all).
   */
  app.post('/api/applications/sync', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') return c.json({ error: 'Неверный формат' }, 400);
    const upsert: unknown[] = Array.isArray(body.upsert) ? body.upsert : [];
    const del: unknown[] = Array.isArray(body.delete) ? body.delete : [];
    const replace = body.replace === true;

    const records: { id: string; json: string }[] = [];
    for (const item of upsert) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return c.json({ error: 'Запись должна быть объектом' }, 400);
      const id = (item as { id?: unknown }).id;
      if (typeof id !== 'string' || !ID_RE.test(id)) return c.json({ error: 'Неверный id записи' }, 400);
      const json = JSON.stringify(item);
      if (json.length > MAX_APP_BYTES) return c.json({ error: 'Запись слишком большая' }, 413);
      records.push({ id, json });
    }
    if (!del.every((id) => typeof id === 'string' && ID_RE.test(id))) return c.json({ error: 'Неверный id' }, 400);

    const userId = c.get('user').id;
    const now = Date.now();
    const result = transaction(db, () => {
      if (replace) db.prepare('DELETE FROM applications WHERE user_id = ?').run(userId);
      const put = db.prepare(
        `INSERT INTO applications (user_id, id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      );
      for (const r of records) put.run(userId, r.id, r.json, now);
      const remove = db.prepare('DELETE FROM applications WHERE user_id = ? AND id = ?');
      for (const id of del as string[]) remove.run(userId, id);
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM applications WHERE user_id = ?').get(userId) as { n: number };
      if (n > MAX_APPS_PER_USER) throw new LimitError();
      return n;
    });
    return c.json({ ok: true, count: result });
  });

  app.onError((err, c) => {
    if (err instanceof LimitError) return c.json({ error: `Лимит — ${MAX_APPS_PER_USER} записей` }, 413);
    console.error(err);
    return c.json({ error: 'Ошибка сервера' }, 500);
  });

  app.notFound((c) => c.json({ error: 'Не найдено' }, 404));

  return app;
}

class LimitError extends Error {}
