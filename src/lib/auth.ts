import { create } from 'zustand';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

interface AuthState {
  status: 'checking' | 'anon' | 'authed';
  username: string;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  check(): Promise<void>;
}

export const useAuth = create<AuthState>()((set) => ({
  status: getToken() ? 'checking' : 'anon',
  username: '',

  async login(username, password) {
    const res = await api<{ token: string; user: { username: string } }>('/auth/login', { body: { username, password } });
    setToken(res.token);
    set({ status: 'authed', username: res.user.username });
  },

  async logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    set({ status: 'anon', username: '' });
  },

  async changePassword(current, next) {
    await api('/auth/password', { body: { current, next } });
  },

  async check() {
    if (!getToken()) return set({ status: 'anon' });
    try {
      const res = await api<{ user: { username: string } }>('/me');
      set({ status: 'authed', username: res.user.username });
    } catch (err) {
      // 401 is handled globally (back to the login screen). Any other failure — offline,
      // server down — keeps the session; the load step shows the error with a retry button.
      if ((err as { status?: number }).status !== 401) set({ status: 'authed' });
    }
  },
}));

setUnauthorizedHandler(() => {
  setToken(null);
  useAuth.setState({ status: 'anon', username: '' });
});
