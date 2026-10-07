import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

const MIGRATIONS = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE applications (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id         TEXT    NOT NULL,
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  `,
];

/** Open (or create) the database and apply pending migrations. */
export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return db;
}

export function transaction<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
