import { CalendarDays, Flame, Hourglass } from 'lucide-react';
import type { CSSProperties } from 'react';
import { STATUSES } from '../lib/constants';
import { relativeDay } from '../lib/dates';
import { dueState } from '../lib/derive';
import type { Application, Status } from '../lib/types';

export const stVar = (s: Status) => ({ '--st': `var(--st-${s})` }) as CSSProperties;

export function StatusChip({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' }) {
  return (
    <span className={`status status--${size}`} style={stVar(status)}>
      <i className="status__dot" />
      {STATUSES[status].label}
    </span>
  );
}

/** FNV-1a with a final avalanche, so similar names still land on different hues. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** Gradient monogram tile; hue is stable per company name. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hash(name.trim().toLowerCase() || '?');
  const hue = h % 360;
  const letter = (name.trim()[0] || '?').toUpperCase();
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 50) % 360} 80% 52%))`,
      }}
    >
      {letter}
    </span>
  );
}

export function PriorityFlame({ app }: { app: Application }) {
  if (app.priority !== 'high') return null;
  return (
    <span className="flame" title="Высокий приоритет" aria-label="Высокий приоритет">
      <Flame size={15} />
    </span>
  );
}

export function NextStep({ app, compact }: { app: Application; compact?: boolean }) {
  const due = dueState(app);
  if (!app.nextAction && !app.nextDate) return null;
  return (
    <div className={`next next--${due ?? 'none'} ${compact ? 'next--compact' : ''}`}>
      <CalendarDays size={14} aria-hidden="true" />
      <span className="next__text">{app.nextAction || 'Следующий шаг'}</span>
      {app.nextDate && (
        <span className="next__when">
          {due === 'overdue' ? 'просрочено · ' : ''}
          {relativeDay(app.nextDate)}
          {app.nextTime ? `, ${app.nextTime}` : ''}
        </span>
      )}
    </div>
  );
}

export function Silence({ days }: { days: number | null }) {
  if (days == null) return null;
  return (
    <span className="silence" title="Нет движения — стоит напомнить о себе">
      <Hourglass size={13} aria-hidden="true" /> тишина {days} дн.
    </span>
  );
}
