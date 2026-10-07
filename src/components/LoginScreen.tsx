import { LoaderCircle, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

export function LoginScreen() {
  const login = useAuth((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <motion.form
        className="auth__card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <img className="auth__logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={56} height={56} />
        <h1 className="auth__title">
          job<span className="grad-text">tracker</span>
        </h1>
        <p className="auth__text">Войдите, чтобы открыть свои отклики.</p>

        <label className="field">
          <span className="field__label">Логин</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div className="auth__error" role="alert">
            {error}
          </div>
        )}

        <button className="btn btn--primary btn--lg auth__submit" type="submit" disabled={busy}>
          {busy ? <LoaderCircle size={18} className="spin" /> : <LogIn size={18} />}
          Войти
        </button>
        <p className="auth__hint">Регистрация закрыта — учётные записи создаются на сервере.</p>
      </motion.form>
    </main>
  );
}

export function Splash({ text }: { text?: string }) {
  return (
    <main className="auth">
      <div className="splash">
        <LoaderCircle size={28} className="spin" />
        {text && <p>{text}</p>}
      </div>
    </main>
  );
}
