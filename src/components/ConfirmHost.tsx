import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useConfirm } from '../lib/confirm';

export function ConfirmHost() {
  const req = useConfirm((s) => s.req);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    // Focus the safe option; Enter then cancels unless the user tabs to the action.
    setTimeout(() => cancelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        req.resolve(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [req]);

  return (
    <AnimatePresence>
      {req && (
        <div className="confirm" data-modal-open role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <motion.div className="confirm__backdrop" onClick={() => req.resolve(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="confirm__panel"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <h2 id="confirm-title">{req.title}</h2>
            <p>{req.text}</p>
            <div className="confirm__actions">
              <button ref={cancelRef} className="btn btn--ghost" onClick={() => req.resolve(false)}>
                Отмена
              </button>
              <button className={`btn ${req.danger ? 'btn--danger-solid' : 'btn--primary'}`} onClick={() => req.resolve(true)}>
                {req.ok}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
