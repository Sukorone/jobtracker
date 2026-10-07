import { ChartColumn, Kanban, List, Monitor, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../lib/store';
import type { ThemePref, View } from '../lib/types';
import { MainMenu } from './MainMenu';

const VIEWS: { key: View; label: string; icon: typeof Kanban }[] = [
  { key: 'board', label: 'Доска', icon: Kanban },
  { key: 'list', label: 'Список', icon: List },
  { key: 'stats', label: 'Аналитика', icon: ChartColumn },
];

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'dark', dark: 'light', light: 'system' };
const THEME_META: Record<ThemePref, { icon: typeof Sun; label: string }> = {
  system: { icon: Monitor, label: 'Тема: как в системе' },
  dark: { icon: Moon, label: 'Тема: тёмная' },
  light: { icon: Sun, label: 'Тема: светлая' },
};

export function TopBar() {
  const view = useStore((s) => s.settings.view);
  const theme = useStore((s) => s.settings.theme);
  const search = useStore((s) => s.filters.search);
  const setSettings = useStore((s) => s.setSettings);
  const setFilters = useStore((s) => s.setFilters);
  const openDrawer = useStore((s) => s.openDrawer);
  const ThemeIcon = THEME_META[theme].icon;

  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand__logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={34} height={34} />
        <span className="brand__name">
          job<span className="grad-text">tracker</span>
        </span>
      </div>

      <nav className="viewswitch" aria-label="Вид">
        {VIEWS.map(({ key, label, icon: Icon }, i) => (
          <button
            key={key}
            className={`viewswitch__btn ${view === key ? 'is-active' : ''}`}
            onClick={() => setSettings({ view: key })}
            aria-current={view === key ? 'page' : undefined}
            title={`${label} (${i + 1})`}
          >
            {view === key && (
              <motion.span
                layoutId="viewswitch-pill"
                className="viewswitch__pill"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {view !== 'stats' && (
        <label className="search topbar__search">
          <Search size={16} className="search__icon" aria-hidden="true" />
          <input
            id="search"
            type="search"
            placeholder="Поиск: компания, вакансия, заметки"
            value={search}
            onChange={(e) => setFilters({ search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilters({ search: '' });
                e.currentTarget.blur();
              }
            }}
            autoComplete="off"
            aria-label="Поиск"
          />
          {search ? (
            <button className="search__clear" onClick={() => setFilters({ search: '' })} aria-label="Очистить поиск">
              <X size={14} />
            </button>
          ) : (
            <kbd className="search__kbd">/</kbd>
          )}
        </label>
      )}

      <div className="topbar__tools">
        <button
          className="icon-btn"
          onClick={() => setSettings({ theme: THEME_NEXT[theme] })}
          title={THEME_META[theme].label}
          aria-label={THEME_META[theme].label}
        >
          <ThemeIcon size={18} />
        </button>
        <MainMenu />
        <button className="btn btn--primary topbar__add" onClick={() => openDrawer({ draft: {} })} title="Новый отклик (N)">
          <Plus size={18} strokeWidth={2.4} />
          <span>Новый отклик</span>
        </button>
      </div>
    </header>
  );
}
