import { FORMATS, PRIORITIES, SOURCES, STATUSES, detectSource } from './constants';
import { parseDate } from './dates';
import type { Application, Priority, Settings, Source, Status, TimelineEvent, WorkFormat } from './types';

export const STORAGE_KEY = 'job-tracker:v2';
export const LEGACY_KEY = 'job-tracker:v1';
export const SETTINGS_KEY = 'job-tracker:settings';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  silenceDays: 7,
  view: 'board',
  focusCollapsed: false,
};

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadApplications(): Application[] {
  const v2 = readJSON(STORAGE_KEY);
  if (Array.isArray(v2)) return v2.map(normalize).filter((a): a is Application => a !== null);
  // First run on v2: pick up records saved by the old single-file version.
  const v1 = readJSON(LEGACY_KEY);
  if (Array.isArray(v1)) {
    const migrated = v1.map(normalize).filter((a): a is Application => a !== null);
    writeJSON(STORAGE_KEY, migrated);
    return migrated;
  }
  return [];
}

export function loadSettings(): Settings {
  const s = readJSON(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? (s as Partial<Settings>) : {}) };
}

/* ─── Normalisation (v1 → v2 and untrusted imports) ─── */

const V1_STAGE_TO_STATUS: Record<string, Status> = {
  screening: 'hr',
  hr_interview: 'hr',
  tech_interview: 'interview',
  test_task: 'test',
  final_interview: 'final',
  offer_negotiation: 'offer',
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isoDate(v: unknown): string {
  const s = str(v).slice(0, 10);
  return parseDate(s) ? s : '';
}

function mapStatus(raw: Record<string, unknown>): Status {
  const s = str(raw.status);
  if (s in STATUSES) return s as Status;
  // v1 statuses
  const stage = V1_STAGE_TO_STATUS[str(raw.stage)];
  if (s === 'in_progress') return stage ?? 'hr';
  if (s === 'no_response') return 'applied';
  return stage ?? 'applied';
}

function toMs(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function normalize(input: unknown): Application | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const company = str(raw.company);
  const position = str(raw.position);
  if (!company && !position) return null;

  const now = Date.now();
  const status = mapStatus(raw);
  const dateApplied = isoDate(raw.dateApplied);
  const createdAt = toMs(raw.createdAt, parseDate(dateApplied)?.getTime() ?? now);

  let timeline: TimelineEvent[] = Array.isArray(raw.timeline)
    ? (raw.timeline as unknown[]).flatMap((e) => {
        if (!e || typeof e !== 'object') return [];
        const ev = e as Record<string, unknown>;
        const kind = str(ev.kind);
        if (!['created', 'status', 'note', 'step'].includes(kind)) return [];
        return [
          {
            id: str(ev.id) || uid(),
            at: toMs(ev.at, now),
            kind: kind as TimelineEvent['kind'],
            ...(str(ev.from) in STATUSES ? { from: str(ev.from) as Status } : {}),
            ...(str(ev.to) in STATUSES ? { to: str(ev.to) as Status } : {}),
            ...(str(ev.text) ? { text: str(ev.text) } : {}),
          },
        ];
      })
    : [];
  if (timeline.length === 0) {
    timeline = [{ id: uid(), at: createdAt, kind: 'created', to: status }];
  }

  // v1 had no source field: recover the obvious ones from the link.
  const guessed = detectSource(str(raw.link));
  const source = str(raw.source) || (guessed === 'site' ? '' : guessed);
  const format = str(raw.format);
  const priority = str(raw.priority);

  return {
    id: str(raw.id) || uid(),
    company,
    position,
    link: str(raw.link),
    status,
    priority: (priority in PRIORITIES ? priority : 'medium') as Priority,
    source: (source in SOURCES ? source : '') as Source,
    format: (format in FORMATS ? format : '') as WorkFormat,
    location: str(raw.location),
    salary: str(raw.salary),
    // v1 called it `hr`
    contact: str(raw.contact) || str(raw.hr),
    dateApplied,
    nextAction: str(raw.nextAction),
    nextDate: isoDate(raw.nextDate),
    nextTime: /^\d{2}:\d{2}$/.test(str(raw.nextTime)) ? str(raw.nextTime) : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    archived: raw.archived === true,
    timeline,
    createdAt,
    updatedAt: toMs(raw.updatedAt, createdAt),
  };
}
