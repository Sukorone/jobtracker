export type Status =
  | 'wishlist'
  | 'applied'
  | 'hr'
  | 'interview'
  | 'test'
  | 'final'
  | 'offer'
  | 'rejected';

export type Priority = 'high' | 'medium' | 'low';

export type Source = '' | 'hh' | 'linkedin' | 'habr' | 'telegram' | 'referral' | 'site' | 'other';

export type WorkFormat = '' | 'remote' | 'hybrid' | 'office';

export type EventKind = 'created' | 'status' | 'note' | 'step';

export interface TimelineEvent {
  id: string;
  /** epoch ms */
  at: number;
  kind: EventKind;
  from?: Status;
  to?: Status;
  text?: string;
}

export interface Application {
  id: string;
  company: string;
  position: string;
  link: string;
  status: Status;
  priority: Priority;
  source: Source;
  format: WorkFormat;
  location: string;
  salary: string;
  contact: string;
  /** yyyy-mm-dd */
  dateApplied: string;
  nextAction: string;
  /** yyyy-mm-dd */
  nextDate: string;
  /** HH:mm, optional */
  nextTime: string;
  notes: string;
  archived: boolean;
  timeline: TimelineEvent[];
  createdAt: number;
  updatedAt: number;
}

export type Draft = Omit<Application, 'id' | 'timeline' | 'createdAt' | 'updatedAt' | 'archived'>;

export type ThemePref = 'system' | 'light' | 'dark';
export type View = 'board' | 'list' | 'stats';

export interface Settings {
  theme: ThemePref;
  /** days without movement after which an application counts as "silent" */
  silenceDays: number;
  view: View;
  focusCollapsed: boolean;
}

export interface Filters {
  search: string;
  priority: Priority | '';
  source: Source | 'any';
  format: WorkFormat | 'any';
  showArchived: boolean;
}
