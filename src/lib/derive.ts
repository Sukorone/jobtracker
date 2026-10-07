import { PRIORITIES, SOURCES, STATUS_RANK, WAITING_STATUSES } from './constants';
import { addDays, daysBetween, daysFromToday, parseDate, toISODate, weekStart } from './dates';
import type { Application, Filters, Source } from './types';

/* ─── Per-application flags ─── */

/** Last activity on the application: any timeline event, or the application date. */
export function lastMovedAt(app: Application): number {
  let t = app.createdAt;
  for (const e of app.timeline) if (e.at > t) t = e.at;
  const applied = parseDate(app.dateApplied)?.getTime();
  return applied && applied > t ? applied : t;
}

/** Days of silence for applications waiting on the employer, or null when not silent. */
export function silenceDays(app: Application, threshold: number): number | null {
  if (app.archived || !WAITING_STATUSES.includes(app.status)) return null;
  if (app.nextDate && (daysFromToday(app.nextDate) ?? -1) >= 0) return null;
  const days = daysBetween(lastMovedAt(app), new Date());
  return days >= threshold ? days : null;
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | null;

export function dueState(app: Application): DueState {
  if (!app.nextDate || app.status === 'rejected') return null;
  const n = daysFromToday(app.nextDate);
  if (n == null) return null;
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  return 'later';
}

/* ─── Filtering & sorting ─── */

export function matchesFilters(app: Application, f: Filters): boolean {
  if (app.archived !== f.showArchived) return false;
  if (f.priority && app.priority !== f.priority) return false;
  if (f.source !== 'any' && app.source !== f.source) return false;
  if (f.format !== 'any' && app.format !== f.format) return false;
  const q = f.search.trim().toLowerCase();
  if (q) {
    const hay = [app.company, app.position, app.contact, app.location, app.notes, app.salary].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const hasActiveFilters = (f: Filters) =>
  !!f.priority || f.source !== 'any' || f.format !== 'any' || f.showArchived;

/** Board order inside a column: urgent next steps first, then priority, then freshest. */
export function boardSort(a: Application, b: Application): number {
  const da = a.nextDate || '9999';
  const db = b.nextDate || '9999';
  if (da !== db) return da < db ? -1 : 1;
  const p = PRIORITIES[a.priority].weight - PRIORITIES[b.priority].weight;
  if (p) return p;
  return b.updatedAt - a.updatedAt;
}

/* ─── Focus ─── */

export interface FocusItem {
  app: Application;
  kind: 'overdue' | 'today' | 'week' | 'silent';
  days: number;
}

export function focusItems(apps: Application[], threshold: number): FocusItem[] {
  const out: FocusItem[] = [];
  for (const app of apps) {
    if (app.archived || app.status === 'rejected') continue;
    if (app.nextDate) {
      const n = daysFromToday(app.nextDate);
      if (n == null) continue;
      if (n < 0) out.push({ app, kind: 'overdue', days: -n });
      else if (n === 0) out.push({ app, kind: 'today', days: 0 });
      else if (n <= 7) out.push({ app, kind: 'week', days: n });
      continue;
    }
    const s = silenceDays(app, threshold);
    if (s != null) out.push({ app, kind: 'silent', days: s });
  }
  const order = { overdue: 0, today: 1, week: 2, silent: 3 };
  return out.sort((a, b) =>
    order[a.kind] - order[b.kind] ||
    (a.kind === 'week' ? a.days - b.days : b.days - a.days) ||
    PRIORITIES[a.app.priority].weight - PRIORITIES[b.app.priority].weight,
  );
}

/* ─── Analytics ─── */

export function maxRank(app: Application): number {
  let r = STATUS_RANK[app.status];
  for (const e of app.timeline) if (e.to) r = Math.max(r, STATUS_RANK[e.to]);
  return r;
}

const wasRejected = (app: Application) =>
  app.status === 'rejected' || app.timeline.some((e) => e.to === 'rejected');

export function hasResponse(app: Application): boolean {
  return maxRank(app) >= 2 || wasRejected(app);
}

/** Sent applications: anything that left the wishlist. */
export function sentApps(apps: Application[]): Application[] {
  return apps.filter((a) => a.status !== 'wishlist');
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
}

export function funnel(apps: Application[]): FunnelStep[] {
  const sent = sentApps(apps);
  return [
    { key: 'sent', label: 'Отклики', count: sent.length },
    { key: 'resp', label: 'Ответили', count: sent.filter(hasResponse).length },
    { key: 'int', label: 'Интервью', count: sent.filter((a) => maxRank(a) >= 3).length },
    { key: 'fin', label: 'Финал', count: sent.filter((a) => maxRank(a) >= 4).length },
    { key: 'off', label: 'Оффер', count: sent.filter((a) => maxRank(a) >= 5).length },
  ];
}

/** Median days from sending to the first status change after it. */
export function medianResponseDays(apps: Application[]): number | null {
  const samples: number[] = [];
  for (const a of sentApps(apps)) {
    const start = parseDate(a.dateApplied)?.getTime() ?? a.createdAt;
    const first = a.timeline.find((e) => e.kind === 'status' && e.from === 'applied' && e.to !== 'applied');
    if (first) samples.push(Math.max(0, daysBetween(start, first.at)));
  }
  if (!samples.length) return null;
  samples.sort((x, y) => x - y);
  const m = samples.length >> 1;
  return samples.length % 2 ? samples[m] : Math.round((samples[m - 1] + samples[m]) / 2);
}

export interface WeekBucket {
  start: string;
  count: number;
}

export function weekly(apps: Application[], weeks = 12): WeekBucket[] {
  const thisWeek = weekStart(new Date());
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) buckets.push({ start: toISODate(addDays(thisWeek, -7 * i)), count: 0 });
  const index = new Map(buckets.map((b, i) => [b.start, i]));
  for (const a of sentApps(apps)) {
    const d = parseDate(a.dateApplied);
    if (!d) continue;
    const i = index.get(toISODate(weekStart(d)));
    if (i != null) buckets[i].count++;
  }
  return buckets;
}

export interface SourceRow {
  source: Source;
  label: string;
  count: number;
  responded: number;
}

export function bySource(apps: Application[]): SourceRow[] {
  const map = new Map<Source, SourceRow>();
  for (const a of sentApps(apps)) {
    const row = map.get(a.source) ?? {
      source: a.source,
      label: a.source ? SOURCES[a.source] : 'Не указан',
      count: 0,
      responded: 0,
    };
    row.count++;
    if (hasResponse(a)) row.responded++;
    map.set(a.source, row);
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

export function pct(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}
