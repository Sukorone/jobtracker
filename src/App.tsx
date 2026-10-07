import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Analytics } from './components/Analytics';
import { Background } from './components/Background';
import { Board } from './components/Board';
import { ConfirmHost } from './components/ConfirmHost';
import { Drawer } from './components/Drawer';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { ListView } from './components/ListView';
import { Overview } from './components/Overview';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { useEffect } from 'react';
import { LoadError } from './components/LoadError';
import { LoginScreen, Splash } from './components/LoginScreen';
import { useAuth } from './lib/auth';
import { useHotkeys, useTheme } from './lib/hooks';
import { useStore } from './lib/store';
import { loadFromServer, resetSync, useSync } from './lib/sync';

export default function App() {
  useTheme();
  const auth = useAuth((s) => s.status);
  const loaded = useSync((s) => s.loaded);
  const loadError = useSync((s) => s.status === 'load-error');

  useEffect(() => {
    void useAuth.getState().check();
  }, []);
  useEffect(() => {
    if (auth === 'authed') void loadFromServer();
    else if (auth === 'anon') resetSync();
  }, [auth]);

  let screen;
  if (auth === 'anon') screen = <LoginScreen />;
  else if (auth === 'checking') screen = <Splash />;
  else if (loadError) screen = <LoadError />;
  else if (!loaded) screen = <Splash text="Загружаю отклики…" />;
  else screen = <Workspace />;

  return (
    <MotionConfig reducedMotion="user">
      <Background />
      {screen}
    </MotionConfig>
  );
}

function Workspace() {
  useHotkeys();
  const view = useStore((s) => s.settings.view);
  const empty = useStore((s) => s.apps.length === 0);

  return (
    <>
      <div className="shell">
        <TopBar />
        <main className="main">
          {empty ? (
            <EmptyState />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                className="view"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {view === 'stats' ? (
                  <Analytics />
                ) : (
                  <>
                    <Overview />
                    <FilterBar />
                    {view === 'board' ? <Board /> : <ListView />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
      <Drawer />
      <ConfirmHost />
      <Toasts />
    </>
  );
}
