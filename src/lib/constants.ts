import type { Priority, Source, Status, WorkFormat } from './types';

export const STATUS_ORDER: Status[] = [
  'wishlist',
  'applied',
  'hr',
  'interview',
  'test',
  'final',
  'offer',
  'rejected',
];

export const STATUSES: Record<Status, { label: string; hint: string }> = {
  wishlist: { label: 'Хочу', hint: 'На примете, отклика ещё не было' },
  applied: { label: 'Отклик', hint: 'Резюме отправлено, ждём ответа' },
  hr: { label: 'Скрининг', hint: 'Первый контакт, HR-созвон' },
  interview: { label: 'Интервью', hint: 'Техническое или с командой' },
  test: { label: 'Тестовое', hint: 'Делаю тестовое задание' },
  final: { label: 'Финал', hint: 'Финальный этап' },
  offer: { label: 'Оффер', hint: 'Есть предложение' },
  rejected: { label: 'Отказ', hint: 'Процесс завершён' },
};

/** Statuses where the ball is in the employer's court — candidates for "silence". */
export const WAITING_STATUSES: Status[] = ['applied', 'hr'];
export const CLOSED_STATUSES: Status[] = ['offer', 'rejected'];

/** Pipeline depth used for the funnel. Rejected carries no depth by itself. */
export const STATUS_RANK: Record<Status, number> = {
  wishlist: 0,
  applied: 1,
  hr: 2,
  interview: 3,
  test: 3,
  final: 4,
  offer: 5,
  rejected: -1,
};

export const PRIORITIES: Record<Priority, { label: string; weight: number }> = {
  high: { label: 'Высокий', weight: 0 },
  medium: { label: 'Средний', weight: 1 },
  low: { label: 'Низкий', weight: 2 },
};

export const SOURCES: Record<Exclude<Source, ''>, string> = {
  hh: 'hh.ru',
  linkedin: 'LinkedIn',
  habr: 'Хабр Карьера',
  telegram: 'Telegram',
  referral: 'Рекомендация',
  site: 'Сайт компании',
  other: 'Другое',
};

export const FORMATS: Record<Exclude<WorkFormat, ''>, string> = {
  remote: 'Удалёнка',
  hybrid: 'Гибрид',
  office: 'Офис',
};

export function detectSource(link: string): Source {
  const l = link.toLowerCase();
  if (!l) return '';
  if (/(^|\.|\/)hh\.(ru|kz|by|uz)|headhunter/.test(l)) return 'hh';
  if (l.includes('linkedin.')) return 'linkedin';
  if (l.includes('career.habr') || l.includes('habr.com')) return 'habr';
  if (l.includes('t.me/') || l.includes('telegram')) return 'telegram';
  return 'site';
}
