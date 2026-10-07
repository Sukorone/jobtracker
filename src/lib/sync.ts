import { create } from 'zustand';
import { ApiError, api } from './api';
import { normalize } from './persist';
import { useStore } from './store';
import type { Application } from './types';

/**
 * Server sync. The store stays the single source of truth for the UI;
 * this module diffs every apps change against the previous state and
 * sends the difference in debounced batches (optimistic updates).
 */

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'error' | 'load-error';

interface SyncState {
  status: SyncStatus;
  error: string;
  loaded: boolean;
}

export const useSync = create<SyncState>(() => ({ status: 'idle', error: '', loaded: false }));

const pendingUpsert = new Set<string>();
const pendingDelete = new Set<string>();
let lastApps: Application[] = useStore.getState().apps;
let hydrating = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let retryDelay = 0;
let lastLoadedAt = 0;

const hasPending = () => pendingUpsert.size > 0 || pendingDelete.size > 0;

function diff(prev: Application[], next: Application[]) {
  const before = new Map(prev.map((a) => [a.id, a]));
  for (const a of next) {
    if (before.get(a.id) !== a) {
      pendingUpsert.add(a.id);
      pendingDelete.delete(a.id);
    }
    before.delete(a.id);
  }
  for (const id of before.keys()) {
    pendingDelete.add(id);
    pendingUpsert.delete(id);
  }
}

useStore.subscribe((s) => {
  if (s.apps === lastApps) return;
  const prev = lastApps;
  lastApps = s.apps;
  if (hydrating || !useSync.getState().loaded) return;
  diff(prev, s.apps);
  schedule(700);
});

function schedule(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

async function flush() {
  if (inFlight || !hasPending()) return;
  inFlight = true;
  const ids = [...pendingUpsert];
  const del = [...pendingDelete];
  pendingUpsert.clear();
  pendingDelete.clear();
  const byId = new Map(useStore.getState().apps.map((a) => [a.id, a]));
  const upsert = ids.map((id) => byId.get(id)).filter((a): a is Application => !!a);
  useSync.setState({ status: 'saving', error: '' });
  try {
    await api('/applications/sync', { body: { upsert, delete: del } });
    retryDelay = 0;
    useSync.setState({ status: hasPending() ? 'saving' : 'idle' });
  } catch (err) {
    // Put the batch back unless newer changes superseded it.
    for (const id of ids) if (!pendingDelete.has(id)) pendingUpsert.add(id);
    for (const id of del) if (!pendingUpsert.has(id)) pendingDelete.add(id);
    const message = err instanceof Error ? err.message : 'Не удалось сохранить';
    useSync.setState({ status: 'error', error: message });
    if (err instanceof ApiError && err.status === 401) return void (inFlight = false);
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 2000, 60_000);
    schedule(retryDelay);
  } finally {
    inFlight = false;
  }
  if (hasPending() && useSync.getState().status !== 'error') schedule(300);
}

function hydrate(apps: Application[]) {
  hydrating = true;
  useStore.getState().replaceAll(apps);
  hydrating = false;
}

/** Load all applications for the signed-in user. */
export async function loadFromServer({ quiet = false } = {}) {
  if (!quiet) useSync.setState({ status: 'loading', error: '' });
  try {
    const res = await api<{ applications: unknown[] }>('/applications');
    if (hasPending() || inFlight) return; // local edits win; they will be pushed shortly
    hydrate(res.applications.map(normalize).filter((a): a is Application => a !== null));
    lastLoadedAt = Date.now();
    useSync.setState({ status: 'idle', loaded: true, error: '' });
  } catch (err) {
    if (quiet) return;
    useSync.setState({ status: 'load-error', error: err instanceof Error ? err.message : 'Ошибка загрузки' });
  }
}

/** Forget local data on sign-out. */
export function resetSync() {
  clearTimeout(timer);
  pendingUpsert.clear();
  pendingDelete.clear();
  useSync.setState({ status: 'idle', error: '', loaded: false });
  hydrate([]);
  useStore.getState().openDrawer(null);
}

export function retryNow() {
  retryDelay = 0;
  if (hasPending()) schedule(0);
}

/* Pick up edits from other devices when coming back to the tab. */
window.addEventListener('focus', () => {
  if (useSync.getState().loaded && !hasPending() && !inFlight && Date.now() - lastLoadedAt > 30_000) {
    void loadFromServer({ quiet: true });
  }
});
window.addEventListener('online', retryNow);
window.addEventListener('beforeunload', (e) => {
  if (hasPending() || inFlight) e.preventDefault();
});
