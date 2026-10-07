import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRIORITIES, SOURCES, STATUS_ORDER } from '../lib/constants';
import { shortDate } from '../lib/dates';
import { matchesFilters, silenceDays } from '../lib/derive';
import { useStore } from '../lib/store';
import type { Application } from '../lib/types';
import { Avatar, NextStep, PriorityFlame, Silence, StatusChip } from './bits';
import { NoMatches } from './EmptyState';

type SortKey = 'company' | 'status' | 'next' | 'applied' | 'source' | 'priority' | 'updated';

const COMPARE: Record<SortKey, (a: Application, b: Application) => number> = {
  company: (a, b) => a.company.localeCompare(b.company, 'ru'),
  status: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  next: (a, b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999'),
  applied: (a, b) => (a.dateApplied || '0000').localeCompare(b.dateApplied || '0000'),
  source: (a, b) => (a.source ? SOURCES[a.source] : 'я').localeCompare(b.source ? SOURCES[b.source] : 'я', 'ru'),
  priority: (a, b) => PRIORITIES[a.priority].weight - PRIORITIES[b.priority].weight,
  updated: (a, b) => a.updatedAt - b.updatedAt,
};

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'company', label: 'Компания' },
  { key: 'status', label: 'Статус' },
  { key: 'next', label: 'Следующий шаг', className: 'hide-sm' },
  { key: 'applied', label: 'Отклик', className: 'hide-md' },
  { key: 'source', label: 'Источник', className: 'hide-md' },
];

export function ListView() {
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);
  const silence = useStore((s) => s.settings.silenceDays);
  const openDrawer = useStore((s) => s.openDrawer);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'next', dir: 1 });

  const rows = useMemo(() => {
    const list = apps.filter((a) => matchesFilters(a, filters));
    return list.sort((a, b) => COMPARE[sort.key](a, b) * sort.dir || b.updatedAt - a.updatedAt);
  }, [apps, filters, sort]);

  if (!rows.length) return <NoMatches />;

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'applied' || key === 'updated' ? -1 : 1 }));

  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className={c.className} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button className="th-btn" onClick={() => toggle(c.key)}>
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} onClick={() => openDrawer({ id: a.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openDrawer({ id: a.id })}>
              <td>
                <div className="cell-company">
                  <Avatar name={a.company} size={34} />
                  <div>
                    <div className="cell-company__name">
                      {a.company} <PriorityFlame app={a} />
                    </div>
                    <div className="cell-company__pos">{a.position}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className="cell-status">
                  <StatusChip status={a.status} size="sm" />
                  <Silence days={silenceDays(a, silence)} />
                </div>
              </td>
              <td className="hide-sm">
                <NextStep app={a} compact /> {!a.nextAction && !a.nextDate && <span className="muted">—</span>}
              </td>
              <td className="hide-md tabular">{a.dateApplied ? shortDate(a.dateApplied) : '—'}</td>
              <td className="hide-md muted">{a.source ? SOURCES[a.source] : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
