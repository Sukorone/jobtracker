import { create } from 'zustand';
import { emailToLogin, loginToEmail, supabase } from './supabase';

interface AuthState {
  status: 'checking' | 'anon' | 'authed';
  userId: string;
  username: string;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Неверный логин или пароль',
  email_not_confirmed: 'Учётная запись не подтверждена — подтвердите её в Supabase (Authentication → Users)',
  over_request_rate_limit: 'Слишком много попыток. Подождите немного.',
  weak_password: 'Слишком простой пароль',
  same_password: 'Новый пароль совпадает со старым',
};

function message(err: { code?: string; message?: string; status?: number }): string {
  if (err.code && MESSAGES[err.code]) return MESSAGES[err.code];
  if (!err.status || err.message?.includes('fetch')) return 'Нет связи с сервером';
  return err.message || 'Ошибка входа';
}

export const useAuth = create<AuthState>()((_set, get) => ({
  status: 'checking',
  userId: '',
  username: '',

  async login(username, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(username.trim()), password });
    if (error) throw new Error(message(error));
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async changePassword(current, next) {
    if (next.length < 8) throw new Error('Новый пароль — минимум 8 символов');
    // Supabase does not ask for the old password, so check it ourselves.
    const email = loginToEmail(get().username);
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) throw new Error(check.error.code === 'invalid_credentials' ? 'Текущий пароль неверный' : message(check.error));
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw new Error(message(error));
    // Sign out other devices.
    await supabase.auth.signOut({ scope: 'others' });
  },
}));

supabase.auth.onAuthStateChange((_event, session) => {
  const user = session?.user;
  const cur = useAuth.getState();
  if (!user) {
    if (cur.status !== 'anon') useAuth.setState({ status: 'anon', userId: '', username: '' });
  } else if (cur.userId !== user.id || cur.status !== 'authed') {
    useAuth.setState({ status: 'authed', userId: user.id, username: emailToLogin(user.email) });
  }
});
