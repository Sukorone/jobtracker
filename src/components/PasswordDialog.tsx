import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';

export function PasswordDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const changePassword = useAuth((s) => s.changePassword);
  const toast = useStore((s) => s.toast);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCurrent('');
    setNext('');
    setRepeat('');
    setError('');
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setError('Новые пароли не совпадают');
    setBusy(true);
    try {
      await changePassword(current, next);
      toast('Пароль изменён, на других устройствах нужно войти заново');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="confirm" data-modal-open role="dialog" aria-modal="true" aria-labelledby="pw-title" onKeyDown={(e) => e.key === 'Escape' && close()}>
          <motion.div className="confirm__backdrop" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.form
            className="confirm__panel pwform"
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <h2 id="pw-title">Сменить пароль</h2>
            <label className="field">
              <span className="field__label">Текущий пароль</span>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Новый пароль</span>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            <label className="field">
              <span className="field__label">Ещё раз</span>
              <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            {error && <div className="auth__error">{error}</div>}
            <div className="confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={close}>
                Отмена
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                Сохранить
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
