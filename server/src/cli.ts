/**
 * User management. Registration is closed, accounts are created here.
 *
 *   node src/cli.ts add <username>       create a user (asks for a password)
 *   node src/cli.ts passwd <username>    set a new password, signs out all devices
 *   node src/cli.ts list                 list users
 *   node src/cli.ts remove <username>    delete a user and all their data
 */
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { MIN_PASSWORD, USERNAME_RE, hashPassword } from './auth.ts';
import { openDb } from './db.ts';

const dataDir = process.env.DATA_DIR ?? join(import.meta.dirname, '..', 'data');
const db = openDb(join(dataDir, 'jobtracker.db'));
const [cmd, username] = process.argv.slice(2);

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/** Reads a password without echoing it; falls back to plain stdin when piped. */
function askPassword(prompt: string): Promise<string> {
  if (process.env.JT_PASSWORD) return Promise.resolve(process.env.JT_PASSWORD);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    const out = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WriteStream };
    if (process.stdin.isTTY) {
      out._writeToOutput = (s: string) => {
        if (s.includes(prompt)) out.output.write(s);
        else if (s === '\r\n' || s === '\n') out.output.write('\n');
      };
    }
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function readNewPassword(): Promise<string> {
  const pw = await askPassword('Пароль: ');
  if (pw.length < MIN_PASSWORD) fail(`Пароль должен быть не короче ${MIN_PASSWORD} символов`);
  if (!process.env.JT_PASSWORD && (await askPassword('Ещё раз: ')) !== pw) fail('Пароли не совпадают');
  return pw;
}

const findUser = (name: string) =>
  db.prepare('SELECT id, username FROM users WHERE username = ?').get(name) as { id: number; username: string } | undefined;

switch (cmd) {
  case 'add': {
    if (!username || !USERNAME_RE.test(username)) fail('Логин: 3–32 символа, латиница, цифры, . _ -');
    if (findUser(username)) fail(`Пользователь ${username} уже есть`);
    const hash = await hashPassword(await readNewPassword());
    db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, hash, Date.now());
    console.log(`Создан пользователь ${username}`);
    break;
  }
  case 'passwd': {
    const user = findUser(username ?? '') ?? fail(`Нет пользователя ${username}`);
    const hash = await hashPassword(await readNewPassword());
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    console.log(`Пароль для ${user.username} обновлён, все устройства разлогинены`);
    break;
  }
  case 'list': {
    const rows = db
      .prepare(
        `SELECT u.username, u.created_at, (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) AS apps
         FROM users u ORDER BY u.id`,
      )
      .all() as { username: string; created_at: number; apps: number }[];
    if (!rows.length) console.log('Пользователей нет');
    for (const r of rows) console.log(`${r.username}\tоткликов: ${r.apps}\tсоздан: ${new Date(r.created_at).toISOString().slice(0, 10)}`);
    break;
  }
  case 'remove': {
    const user = findUser(username ?? '') ?? fail(`Нет пользователя ${username}`);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    console.log(`Пользователь ${user.username} и все его данные удалены`);
    break;
  }
  default:
    fail('Команды: add <логин> | passwd <логин> | list | remove <логин>');
}
db.close();
