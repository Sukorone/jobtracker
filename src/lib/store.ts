import { create } from 'zustand';
import { STATUSES } from './constants';
import { todayISO } from './dates';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, uid, writeJSON } from './persist';
import type { Application, Draft, Filters, Settings, Status, TimelineEvent } from './types';

export interface Toast {
  id: string;
  text: string;
  tone: 'ok' | 'error';
  action?: { label: string; run: () => void };
}

/** Which application the side sheet shows: an existing id, 'new', or nothing. */
export type DrawerTarget = { id: string } | { draft: Partial<Draft> } | null;

interface State {
  apps: Application[];
  settings: Settings;
  filters: Filters;
  drawer: DrawerTarget;
  toasts: Toast[];

  add(draft: Draft): string;
  update(id: string, patch: Partial<Draft>): void;
  setStatus(id: string, status: Status): void;
  addNote(id: string, text: string): void;
  completeStep(id: string): void;
  setArchived(id: string, archived: boolean): void;
  remove(id: string): void;
  replaceAll(apps: Application[]): void;
  mergeIn(apps: Application[]): number;

  setSettings(patch: Partial<Settings>): void;
  setFilters(patch: Partial<Filters>): void;
  resetFilters(): void;
  openDrawer(target: DrawerTarget): void;
  toast(text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>): void;
  dismissToast(id: string): void;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  priority: '',
  source: 'any',
  format: 'any',
  showArchived: false,
};

function event(e: Omit<TimelineEvent, 'id' | 'at'>): TimelineEvent {
  return { id: uid(), at: Date.now(), ...e };
}

export const useStore = create<State>()((set, get) => {
  const patchApp = (id: string, fn: (a: Application) => Application) =>
    set((s) => ({ apps: s.apps.map((a) => (a.id === id ? { ...fn(a), updatedAt: Date.now() } : a)) }));

  return {
    // Filled from the server after sign-in (see sync.ts).
    apps: [],
    settings: loadSettings(),
    filters: DEFAULT_FILTERS,
    drawer: null,
    toasts: [],

    add(draft) {
      const now = Date.now();
      const app: Application = {
        ...draft,
        id: uid(),
        archived: false,
        timeline: [event({ kind: 'created', to: draft.status })],
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ apps: [app, ...s.apps] }));
      return app.id;
    },

    update(id, patch) {
      const { status, ...rest } = patch;
      patchApp(id, (a) => ({ ...a, ...rest }));
      if (status && status !== get().apps.find((a) => a.id === id)?.status) get().setStatus(id, status);
    },

    setStatus(id, status) {
      patchApp(id, (a) => {
        if (a.status === status) return a;
        const extra: Partial<Application> = {};
        // Moving off the wishlist means the application has just been sent.
        if (a.status === 'wishlist' && status !== 'wishlist' && !a.dateApplied) {
          extra.dateApplied = todayISO();
        }
        return {
          ...a,
          ...extra,
          status,
          timeline: [...a.timeline, event({ kind: 'status', from: a.status, to: status })],
        };
      });
    },

    addNote(id, text) {
      const t = text.trim();
      if (!t) return;
      patchApp(id, (a) => ({ ...a, timeline: [...a.timeline, event({ kind: 'note', text: t })] }));
    },

    completeStep(id) {
      patchApp(id, (a) => ({
        ...a,
        nextAction: '',
        nextDate: '',
        nextTime: '',
        timeline: [...a.timeline, event({ kind: 'step', text: a.nextAction || 'Шаг выполнен' })],
      }));
    },

    setArchived(id, archived) {
      patchApp(id, (a) => ({ ...a, archived }));
    },

    remove(id) {
      const s = get();
      const idx = s.apps.findIndex((a) => a.id === id);
      if (idx < 0) return;
      const removed = s.apps[idx];
      set({ apps: s.apps.filter((a) => a.id !== id) });
      s.toast(`«${removed.company}» удалено`, {
        action: {
          label: 'Вернуть',
          run: () =>
            set((cur) => {
              const apps = [...cur.apps];
              apps.splice(Math.min(idx, apps.length), 0, removed);
              return { apps };
            }),
        },
      });
    },

    replaceAll(apps) {
      set({ apps });
    },

    mergeIn(incoming) {
      const known = new Set(get().apps.map((a) => a.id));
      const fresh = incoming.filter((a) => !known.has(a.id));
      set((s) => ({ apps: [...fresh, ...s.apps] }));
      return fresh.length;
    },

    setSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
    },
    setFilters(patch) {
      set((s) => ({ filters: { ...s.filters, ...patch } }));
    },
    resetFilters() {
      set((s) => ({ filters: { ...DEFAULT_FILTERS, search: s.filters.search } }));
    },
    openDrawer(target) {
      set({ drawer: target });
    },

    toast(text, opts = {}) {
      const t: Toast = { id: uid(), text, tone: opts.tone ?? 'ok', action: opts.action };
      set((s) => ({ toasts: [...s.toasts.slice(-2), t] }));
      setTimeout(() => get().dismissToast(t.id), t.action ? 6000 : 3000);
    },
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  };
});

/* Settings are per device and stay in localStorage; applications sync to the server. */
let lastSettings = useStore.getState().settings;
useStore.subscribe((s) => {
  if (s.settings !== lastSettings) {
    lastSettings = s.settings;
    writeJSON(SETTINGS_KEY, s.settings);
  }
});

export function emptyDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    company: '',
    position: '',
    link: '',
    status: 'applied',
    priority: 'medium',
    source: '',
    format: '',
    location: '',
    salary: '',
    contact: '',
    dateApplied: todayISO(),
    nextAction: '',
    nextDate: '',
    nextTime: '',
    notes: '',
    ...overrides,
  };
}

export const statusLabel = (s: Status) => STATUSES[s].label;
export { DEFAULT_SETTINGS };
