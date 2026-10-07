import { FORMATS, PRIORITIES, SOURCES, STATUSES } from './constants';
import { addDays, format, parseDate, shortDate, todayISO } from './dates';
import { normalize } from './persist';
import type { Application } from './types';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(apps: Application[]) {
  const payload = { version: 2, exportedAt: new Date().toISOString(), applications: apps };
  download(`job-tracker-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

const csvCell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportCSV(apps: Application[]) {
  const head = [
    'Компания', 'Вакансия', 'Статус', 'Приоритет', 'Источник', 'Формат', 'Город', 'Зарплата',
    'Контакт', 'Дата отклика', 'Следующий шаг', 'Дата шага', 'Ссылка', 'Заметки', 'В архиве',
  ];
  const rows = apps.map((a) => [
    a.company, a.position, STATUSES[a.status].label, PRIORITIES[a.priority].label,
    a.source ? SOURCES[a.source] : '', a.format ? FORMATS[a.format] : '', a.location, a.salary,
    a.contact, a.dateApplied, a.nextAction, a.nextDate, a.link, a.notes, a.archived ? 'да' : '',
  ]);
  // BOM so Excel opens UTF-8 Cyrillic correctly; Google Sheets ignores it.
  const csv = '\uFEFF' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  download(`job-tracker-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
}

export async function readImportFile(file: File): Promise<Application[]> {
  const parsed: unknown = JSON.parse(await file.text());
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { applications?: unknown }).applications)
      ? (parsed as { applications: unknown[] }).applications
      : null;
  if (!list) throw new Error('В файле нет списка заявок');
  return list.map(normalize).filter((a): a is Application => a !== null);
}

/* ─── Calendar (.ics) ─── */

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function canExportEvent(app: Application): boolean {
  return !!parseDate(app.nextDate);
}

export function downloadICS(app: Application) {
  const day = parseDate(app.nextDate);
  if (!day) return;
  const stamp = format(new Date(), "yyyyMMdd'T'HHmmss");
  let when: string[];
  if (app.nextTime) {
    const [h, m] = app.nextTime.split(':').map(Number);
    const start = new Date(day);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    // Floating local time: the calendar app places it in the user's own zone.
    when = [`DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`, `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`];
  } else {
    when = [`DTSTART;VALUE=DATE:${format(day, 'yyyyMMdd')}`, `DTEND;VALUE=DATE:${format(addDays(day, 1), 'yyyyMMdd')}`];
  }
  const title = `${app.nextAction || 'Следующий шаг'} — ${app.company}`;
  const desc = [app.position, app.contact && `Контакт: ${app.contact}`, app.link].filter(Boolean).join('\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//jobtracker//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${app.id}-${app.nextDate}@jobtracker`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${icsEscape(title)}`,
    desc && `DESCRIPTION:${icsEscape(desc)}`,
    app.link && `URL:${app.link}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
  download(`${app.company || 'event'}-${app.nextDate}.ics`.replace(/[\\/:*?"<>|]+/g, '_'), ics, 'text/calendar');
}

/* ─── Message templates ─── */

export interface Template {
  key: string;
  label: string;
  build(app: Application): string;
}

const greeting = (app: Application) => {
  const name = app.contact.split(/[,(<@]/)[0].trim().split(/\s+/)[0];
  return name && /^[A-ZА-ЯЁ][a-zа-яё-]+$/.test(name) ? `Здравствуйте, ${name}!` : 'Здравствуйте!';
};

export const TEMPLATES: Template[] = [
  {
    key: 'followup',
    label: 'Напомнить о себе',
    build: (a) =>
      `${greeting(a)}\n\nПишу по поводу моего отклика на вакансию «${a.position}» в ${a.company}` +
      `${a.dateApplied ? ` от ${shortDate(a.dateApplied)}` : ''}. ` +
      'Подскажите, пожалуйста, есть ли обратная связь по моей кандидатуре?\n\n' +
      'С удовольствием расскажу подробнее о своём опыте. Спасибо!',
  },
  {
    key: 'thanks',
    label: 'Спасибо после интервью',
    build: (a) =>
      `${greeting(a)}\n\nСпасибо за сегодняшнюю встречу по вакансии «${a.position}». ` +
      `Было интересно узнать больше о команде ${a.company} и задачах. ` +
      'Если понадобится что-то дополнительно — портфолио, рекомендации или ответы на вопросы, — буду на связи.\n\nХорошего дня!',
  },
  {
    key: 'status',
    label: 'Уточнить сроки',
    build: (a) =>
      `${greeting(a)}\n\nПодскажите, пожалуйста, какие дальнейшие шаги и сроки по вакансии «${a.position}»? ` +
      'Хочу правильно спланировать время. Спасибо!',
  },
];
