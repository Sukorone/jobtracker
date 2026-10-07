import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'job-tracker:auth' },
});

/** Accounts are plain logins; Supabase needs an email, so map `alex` → `alex@jobtracker.local`. */
export const loginToEmail = (login: string) => (login.includes('@') ? login : `${login.toLowerCase()}@jobtracker.local`);
export const emailToLogin = (email = '') => email.replace(/@jobtracker\.local$/, '');
