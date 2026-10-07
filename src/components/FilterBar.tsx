import { Archive, RotateCcw } from 'lucide-react';
import { FORMATS, PRIORITIES, SOURCES } from '../lib/constants';
import { hasActiveFilters } from '../lib/derive';
import { useStore } from '../lib/store';
import type { Filters } from '../lib/types';

function ChipSelect<K extends keyof Filters>({
  name,
  label,
  value,
  options,
  empty,
}: {
  name: K;
  label: string;
  value: string;
  options: Record<string, string>;
  empty: string;
}) {
  const setFilters = useStore((s) => s.setFilters);
  const active = value !== empty;
  return (
    <label className={`chip-select ${active ? 'is-active' : ''}`}>
      <span className="chip-select__label">{label}</span>
      <select value={value} onChange={(e) => setFilters({ [name]: e.target.value } as Partial<Filters>)}>
        <option value={empty}>все</option>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const archivedCount = useStore((s) => s.apps.filter((a) => a.archived).length);

  return (
    <div className="filterbar" role="toolbar" aria-label="Фильтры">
      <ChipSelect
        name="priority"
        label="Приоритет"
        value={filters.priority}
        empty=""
        options={Object.fromEntries(Object.entries(PRIORITIES).map(([k, v]) => [k, v.label]))}
      />
      <ChipSelect name="source" label="Источник" value={filters.source} empty="any" options={{ ...SOURCES, '': 'Не указан' }} />
      <ChipSelect name="format" label="Формат" value={filters.format} empty="any" options={{ ...FORMATS, '': 'Не указан' }} />
      {(archivedCount > 0 || filters.showArchived) && (
        <button
          className={`chip-toggle ${filters.showArchived ? 'is-active' : ''}`}
          onClick={() => setFilters({ showArchived: !filters.showArchived })}
          aria-pressed={filters.showArchived}
        >
          <Archive size={14} /> Архив <span className="chip-toggle__count">{archivedCount}</span>
        </button>
      )}
      {hasActiveFilters(filters) && (
        <button className="link-btn" onClick={resetFilters}>
          <RotateCcw size={14} /> Сбросить
        </button>
      )}
    </div>
  );
}
