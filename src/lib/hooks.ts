import { useEffect, useState } from 'react';
import { useStore } from './store';

export function useMediaQuery(q: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}

/** Resolve the theme preference and stamp it on <html>. */
export function useTheme(): 'light' | 'dark' {
  const pref = useStore((s) => s.settings.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0a1a' : '#f4f2ff');
  }, [theme]);
  return theme;
}

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      const s = useStore.getState();
      if (s.drawer || document.querySelector('[data-modal-open]')) return;
      const key = e.key.toLowerCase();
      if (key === 'n' || key === 'т') {
        e.preventDefault();
        s.openDrawer({ draft: {} });
      } else if (key === '/' || key === '.') {
        e.preventDefault();
        document.getElementById('search')?.focus();
      } else if (key === '1') s.setSettings({ view: 'board' });
      else if (key === '2') s.setSettings({ view: 'list' });
      else if (key === '3') s.setSettings({ view: 'stats' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
