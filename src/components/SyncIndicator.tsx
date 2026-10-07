import { Cloud, CloudAlert, LoaderCircle } from 'lucide-react';
import { retryNow, useSync } from '../lib/sync';

export function SyncIndicator() {
  const status = useSync((s) => s.status);
  const error = useSync((s) => s.error);

  if (status === 'error') {
    return (
      <button className="sync sync--error" onClick={retryNow} title={`${error}. Нажмите, чтобы повторить`}>
        <CloudAlert size={17} />
        <span>Не сохранено</span>
      </button>
    );
  }
  const saving = status === 'saving' || status === 'loading';
  return (
    <span className={`sync ${saving ? 'sync--saving' : ''}`} title={saving ? 'Сохраняю…' : 'Всё сохранено на сервере'} role="status">
      {saving ? <LoaderCircle size={17} className="spin" /> : <Cloud size={17} />}
      <span className="sr-only">{saving ? 'Сохраняю' : 'Сохранено'}</span>
    </span>
  );
}
