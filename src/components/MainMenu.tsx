import { Ellipsis, FileBraces, FileSpreadsheet, Hourglass, KeyRound, LogOut, Minus, Plus, Sparkles, Trash, Upload, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { confirm } from '../lib/confirm';
import { plural } from '../lib/dates';
import { demoApplications } from '../lib/demo';
import { exportCSV, exportJSON, readImportFile } from '../lib/io';
import { useStore } from '../lib/store';
import { PasswordDialog } from './PasswordDialog';
import { Popover } from './Popover';

export function MainMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importMode = useRef<'replace' | 'merge'>('merge');
  const apps = useStore((s) => s.apps);
  const silence = useStore((s) => s.settings.silenceDays);
  const { setSettings, replaceAll, mergeIn, toast } = useStore.getState();
  const username = useAuth((s) => s.username);
  const logout = useAuth((s) => s.logout);
  const [pwOpen, setPwOpen] = useState(false);

  const pickFile = (mode: 'replace' | 'merge') => {
    importMode.current = mode;
    fileRef.current?.click();
  };

  const onFile = async (file: File) => {
    try {
      const list = await readImportFile(file);
      if (importMode.current === 'replace') {
        const ok = await confirm({
          title: 'Заменить все данные?',
          text: `Из файла загрузится ${list.length} ${plural(list.length, 'запись', 'записи', 'записей')}, текущие ${apps.length} будут удалены.`,
          ok: 'Заменить',
          danger: true,
        });
        if (!ok) return;
        replaceAll(list);
        toast(`Импортировано: ${list.length}`);
      } else {
        const added = mergeIn(list);
        toast(added ? `Добавлено: ${added}` : 'Новых записей в файле нет');
      }
    } catch (err) {
      toast(`Ошибка импорта: ${err instanceof Error ? err.message : 'неверный файл'}`, { tone: 'error' });
    }
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Удалить все записи?',
      text: `Будет удалено ${apps.length} ${plural(apps.length, 'запись', 'записи', 'записей')}. Отменить это нельзя — сначала лучше сделать экспорт.`,
      ok: 'Удалить всё',
      danger: true,
    });
    if (ok) {
      replaceAll([]);
      toast('Все записи удалены');
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <Popover
        className="menu"
        trigger={({ open, toggle }) => (
          <button className={`icon-btn ${open ? 'is-on' : ''}`} onClick={toggle} aria-label="Меню" aria-expanded={open}>
            <Ellipsis size={18} />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="menu__account">
              <span className="menu__avatar">
                <User size={16} />
              </span>
              <span className="menu__user">{username || 'Аккаунт'}</span>
            </div>
            <button className="menu__item" onClick={() => (setPwOpen(true), close())}>
              <KeyRound size={16} /> Сменить пароль
            </button>
            <button className="menu__item" onClick={() => (close(), logout())}>
              <LogOut size={16} /> Выйти
            </button>

            <div className="menu__sep" />
            <div className="menu__label">Данные</div>
            <button className="menu__item" disabled={!apps.length} onClick={() => (exportJSON(apps), close())}>
              <FileBraces size={16} /> Экспорт JSON <span className="menu__hint">бэкап</span>
            </button>
            <button className="menu__item" disabled={!apps.length} onClick={() => (exportCSV(apps), close())}>
              <FileSpreadsheet size={16} /> Экспорт CSV <span className="menu__hint">Sheets / Excel</span>
            </button>
            <button className="menu__item" onClick={() => (pickFile('merge'), close())}>
              <Upload size={16} /> Импорт — добавить
            </button>
            <button className="menu__item" onClick={() => (pickFile('replace'), close())}>
              <Upload size={16} /> Импорт — заменить всё
            </button>

            <div className="menu__sep" />
            <div className="menu__label">Настройки</div>
            <div className="menu__row">
              <Hourglass size={16} />
              <span className="menu__row-text">
                «Тишина» через
                <small>отклик без движения</small>
              </span>
              <div className="stepper">
                <button onClick={() => setSettings({ silenceDays: Math.max(1, silence - 1) })} aria-label="Меньше">
                  <Minus size={14} />
                </button>
                <span>{silence} дн.</span>
                <button onClick={() => setSettings({ silenceDays: Math.min(60, silence + 1) })} aria-label="Больше">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <button
              className="menu__item"
              onClick={() => {
                mergeIn(demoApplications());
                toast('Добавлены демо-данные — удалите их, когда разберётесь');
                close();
              }}
            >
              <Sparkles size={16} /> Добавить демо-данные
            </button>

            <div className="menu__sep" />
            <button className="menu__item menu__item--danger" disabled={!apps.length} onClick={() => (close(), clearAll())}>
              <Trash size={16} /> Удалить всё
            </button>
          </>
        )}
      </Popover>
      <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
