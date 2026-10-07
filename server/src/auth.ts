import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { DB } from './db.ts';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 8;

/** Format: scrypt$N$r$p$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(key, expected);
}

/** Computed once so unknown usernames cost the same time as wrong passwords. */
let dummyHash: Promise<string> | null = null;
export function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash.then((h) => verifyPassword(password, h));
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface User {
  id: number;
  username: string;
}

/** Issues a random bearer token; only its hash is stored. */
export function createSession(db: DB, userId: number): string {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  );
  return token;
}

export function userForToken(db: DB, token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as { id: number; username: string; expires_at: number } | undefined;
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at < now) {
    deleteSession(db, token);
    return null;
  }
  // Sliding expiry: extend at most once a day to avoid a write per request.
  if (row.expires_at - now < SESSION_TTL_MS - 24 * 60 * 60 * 1000) {
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(now + SESSION_TTL_MS, sha256(token));
  }
  return { id: row.id, username: row.username };
}

export function deleteSession(db: DB, token: string) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function deleteOtherSessions(db: DB, userId: number, keepToken: string) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, sha256(keepToken));
}

export function purgeExpiredSessions(db: DB) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

/* ─── Login throttling (in memory, per IP and per username) ─── */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; first: number }>();

export function isThrottled(...keys: string[]): boolean {
  const now = Date.now();
  return keys.some((k) => {
    const f = fails.get(k);
    if (!f) return false;
    if (now - f.first > WINDOW_MS) {
      fails.delete(k);
      return false;
    }
    return f.count >= MAX_FAILS;
  });
}

export function recordFailure(...keys: string[]) {
  const now = Date.now();
  if (fails.size > 10_000) for (const [k, f] of fails) if (now - f.first > WINDOW_MS) fails.delete(k);
  for (const k of keys) {
    const f = fails.get(k);
    if (!f || now - f.first > WINDOW_MS) fails.set(k, { count: 1, first: now });
    else f.count++;
  }
}

export function clearFailures(...keys: string[]) {
  for (const k of keys) fails.delete(k);
}
