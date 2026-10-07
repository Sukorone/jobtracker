import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Local calendar date as yyyy-mm-dd. */
export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

/** Calendar days from today to `s` (negative = in the past). */
export function daysFromToday(s: string): number | null {
  const d = parseDate(s);
  return d ? differenceInCalendarDays(d, new Date()) : null;
}

export function daysBetween(a: Date | number, b: Date | number): number {
  return differenceInCalendarDays(b, a);
}

export function shortDate(s: string): string {
  const d = parseDate(s);
  if (!d) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: ru }).replace('.', '');
}

export function relativeDay(s: string): string {
  const n = daysFromToday(s);
  if (n == null) return '';
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  if (n > 1 && n <= 14) return `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  if (n < -1 && n >= -14) return `${-n} ${plural(-n, 'день', 'дня', 'дней')} назад`;
  return shortDate(s);
}

export function dateTime(ms: number): string {
  return format(ms, 'd MMM, HH:mm', { locale: ru }).replace('.', '');
}

export function weekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export { addDays, format };

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
