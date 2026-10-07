import { CalendarCheck, ChartColumn, Kanban, Plus, SearchX, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { demoApplications } from '../lib/demo';
import { useStore } from '../lib/store';

const FEATURES = [
  { icon: Kanban, title: 'Доска', text: 'Перетаскивайте отклики между этапами — от «хочу» до оффера.' },
  { icon: CalendarCheck, title: 'Фокус', text: 'Просроченные шаги, дела на сегодня и отклики, о которых пора напомнить.' },
  { icon: ChartColumn, title: 'Аналитика', text: 'Воронка, активность по неделям и какие площадки реально отвечают.' },
];

export function EmptyState() {
  const openDrawer = useStore((s) => s.openDrawer);
  const mergeIn = useStore((s) => s.mergeIn);

  return (
    <motion.section
      className="welcome"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="welcome__kicker">Поиск работы без хаоса</p>
      <h1 className="welcome__title">
        Все отклики — <span className="grad-text">в одном месте</span>
      </h1>
      <p className="welcome__text">
        Добавьте первую вакансию или посмотрите, как всё выглядит, на демо-данных. Всё сохраняется на сервере и доступно с любого устройства.
      </p>
      <div className="welcome__cta">
        <button className="btn btn--primary btn--lg" onClick={() => openDrawer({ draft: {} })}>
          <Plus size={18} strokeWidth={2.4} /> Добавить отклик
        </button>
        <button className="btn btn--ghost btn--lg" onClick={() => mergeIn(demoApplications())}>
          <Sparkles size={17} /> Демо-данные
        </button>
      </div>
      <div className="welcome__features">
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <motion.div
            key={title}
            className="feature"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.45 }}
          >
            <span className="feature__icon">
              <Icon size={20} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export function NoMatches() {
  const resetFilters = useStore((s) => s.resetFilters);
  const setFilters = useStore((s) => s.setFilters);
  return (
    <div className="nomatch">
      <SearchX size={28} />
      <h3>Ничего не нашлось</h3>
      <p>Попробуйте изменить поиск или сбросить фильтры.</p>
      <button
        className="btn btn--ghost"
        onClick={() => {
          resetFilters();
          setFilters({ search: '' });
        }}
      >
        Сбросить всё
      </button>
    </div>
  );
}
