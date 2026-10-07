import { CloudOff, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { loadFromServer, useSync } from '../lib/sync';

export function LoadError() {
  const error = useSync((s) => s.error);
  const logout = useAuth((s) => s.logout);
  return (
    <main className="auth">
      <div className="auth__card auth__card--center">
        <span className="feature__icon">
          <CloudOff size={22} />
        </span>
        <h1 className="auth__title auth__title--sm">Не удалось загрузить данные</h1>
        <p className="auth__text">{error}. Проверьте интернет или доступность сервера.</p>
        <div className="welcome__cta">
          <button className="btn btn--primary" onClick={() => loadFromServer()}>
            <RotateCcw size={16} /> Повторить
          </button>
          <button className="btn btn--ghost" onClick={() => logout()}>
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </div>
    </main>
  );
}
