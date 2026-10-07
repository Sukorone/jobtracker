/** Thin client for the jobtracker API. The bearer token lives in localStorage. */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'job-tracker:token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session simply won't survive a reload */
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    throw new ApiError(res.status, data.error ?? (res.status >= 500 ? 'Сервер недоступен' : `Ошибка ${res.status}`));
  }
  return data;
}
