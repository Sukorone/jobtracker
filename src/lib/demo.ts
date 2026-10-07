import { addDays, toISODate } from './dates';
import { uid } from './persist';
import type { Application, Priority, Source, Status, TimelineEvent, WorkFormat } from './types';

type Seed = [
  company: string,
  position: string,
  path: Status[],
  appliedAgo: number,
  source: Source,
  format: WorkFormat,
  priority: Priority,
  salary: string,
  next?: [action: string, inDays: number, time?: string],
];

const SEEDS: Seed[] = [
  ['Полярис', 'Senior Frontend Engineer', ['applied', 'hr', 'interview', 'final'], 24, 'hh', 'remote', 'high', '350–420 тыс. ₽', ['Финал с CTO', 1, '15:00']],
  ['Northwind Labs', 'React Developer', ['applied', 'hr', 'interview'], 16, 'linkedin', 'remote', 'high', '$4–5k', ['Подготовить вопросы к тех. интервью', 0]],
  ['Облако-9', 'Frontend Lead', ['applied', 'hr', 'test'], 12, 'habr', 'hybrid', 'medium', '400 тыс. ₽', ['Сдать тестовое', -1]],
  ['Квант', 'Middle+ Frontend', ['applied', 'hr', 'interview', 'test', 'final', 'offer'], 40, 'referral', 'office', 'high', '380 тыс. ₽', ['Ответить на оффер', 3]],
  ['Метеор', 'TypeScript Engineer', ['applied'], 11, 'hh', 'remote', 'medium', ''],
  ['Pixel Forge', 'UI Engineer', ['applied'], 9, 'linkedin', 'remote', 'low', '$3.5k'],
  ['Сфера', 'Frontend Developer', ['applied', 'rejected'], 30, 'hh', 'hybrid', 'medium', ''],
  ['Brightside', 'Product Engineer', ['applied', 'hr', 'rejected'], 35, 'site', 'remote', 'medium', '$5k'],
  ['Гравитон', 'Senior React Developer', ['applied', 'hr'], 6, 'telegram', 'remote', 'medium', '300–350 тыс. ₽', ['HR-созвон', 5, '11:30']],
  ['Ракета', 'Frontend (Next.js)', ['applied'], 2, 'hh', 'office', 'low', ''],
  ['Lumen', 'Design Engineer', ['wishlist'], 0, 'linkedin', 'remote', 'high', ''],
  ['Атлас Тех', 'Staff Frontend', ['wishlist'], 0, 'habr', 'hybrid', 'medium', '500+ тыс. ₽'],
  ['Вектор', 'Frontend Developer', ['applied', 'rejected'], 52, 'hh', 'office', 'low', ''],
  ['Orbit', 'JavaScript Engineer', ['applied', 'hr', 'interview', 'rejected'], 46, 'linkedin', 'remote', 'medium', '$4k'],
  ['Фокус', 'Frontend Developer', ['applied'], 63, 'hh', 'remote', 'low', ''],
];

export function demoApplications(): Application[] {
  const today = new Date();
  return SEEDS.map(([company, position, path, ago, source, format, priority, salary, next]) => {
    const applied = addDays(today, -ago);
    const timeline: TimelineEvent[] = [{ id: uid(), at: applied.getTime(), kind: 'created', to: path[0] }];
    // Spread status changes between the application date and today.
    path.slice(1).forEach((to, i) => {
      const at = addDays(applied, Math.round(((i + 1) * ago) / path.length)).getTime();
      timeline.push({ id: uid(), at, kind: 'status', from: path[i], to });
    });
    const status = path[path.length - 1];
    return {
      id: uid(),
      company,
      position,
      link: '',
      status,
      priority,
      source,
      format,
      location: format === 'remote' ? '' : 'Москва',
      salary,
      contact: '',
      dateApplied: status === 'wishlist' ? '' : toISODate(applied),
      nextAction: next?.[0] ?? '',
      nextDate: next ? toISODate(addDays(today, next[1])) : '',
      nextTime: next?.[2] ?? '',
      notes: '',
      archived: false,
      timeline,
      createdAt: applied.getTime(),
      updatedAt: timeline[timeline.length - 1].at,
    };
  });
}
