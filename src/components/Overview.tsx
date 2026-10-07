import { CalendarPlus, Check, ChevronDown, Copy, Target } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CLOSED_STATUSES } from '../lib/constants';
import { plural } from '../lib/dates';
import { useMediaQuery } from '../lib/hooks';
import { focusItems, funnel, pct, type FocusItem } from '../lib/derive';
import { TEMPLATES, canExportEvent, downloadICS } from '../lib/io';
import { useStore } from '../lib/store';
import { Avatar } from './bits';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function Overview() {
  const apps = useStore((s) => s.apps);
  const silence = useStore((s) => s.settings.silenceDays);
  const collapsed = useStore((s) => s.settings.focusCollapsed);
  const setSettings = useStore((s) => s.setSettings);

  const live = useMemo(() => apps.filter((a) => !a.archived), [apps]);
  const items = useMemo(() => focusItems(live, silence), [live, silence]);
  const steps = useMemo(() => funnel(apps), [apps]);

  const active = live.filter((a) => a.status !== 'wishlist' && !CLOSED_STATUSES.includes(a.status)).length;
  const inInterviews = live.filter((a) => ['interview', 'test', 'final'].includes(a.status)).length;
  const offers = live.filter((a) => a.status === 'offer').length;
  const responseRate = pct(steps[1].count, steps[0].count);

  const overdue = items.filter((i) => i.kind === 'overdue').length;
  const today = items.filter((i) => i.kind === 'today').length;
  const silent = items.filter((i) => i.kind === 'silent').length;

  const summary = [
    overdue && `${overdue} ${plural(overdue, 'просроченный шаг', 'просроченных шага', 'просроченных шагов')}`,
    today && `${today} ${plural(today, 'дело', 'дела', 'дел')} на сегодня`,
    silent && `${silent} ${plural(silent, 'отклик ждёт', 'отклика ждут', 'откликов ждут')} напоминания`,
  ].filter(Boolean);

  return (
    <section className="overview">
      <div className="hello">
        <h1 className="hello__title">
          {greeting()}
          <span className="grad-text">.</span>
        </h1>
        <p className="hello__text">
          {summary.length ? summary.join(', ') + '.' : 'Срочного ничего нет — хороший момент отправить пару новых откликов.'}
        </p>
      </div>

      <div className="kpis">
        <Kpi value={active} label="в работе" />
        <Kpi value={`${responseRate}%`} label="ответили" sub={`${steps[1].count} из ${steps[0].count}`} />
        <Kpi value={inInterviews} label="на интервью" />
        <Kpi value={offers} label={plural(offers, 'оффер', 'оффера', 'офферов')} accent={offers > 0} />
      </div>

      <div className={`panel focus ${collapsed ? 'is-collapsed' : ''}`}>
        <button
          className="focus__head"
          onClick={() => setSettings({ focusCollapsed: !collapsed })}
          aria-expanded={!collapsed}
        >
          <span className="focus__icon">
            <Target size={16} />
          </span>
          <span className="focus__title">Фокус</span>
          <span className="focus__count">{items.length}</span>
          <ChevronDown size={18} className="focus__chev" />
        </button>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <FocusList items={items} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Kpi({ value, label, sub, accent }: { value: number | string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`kpi ${accent ? 'kpi--accent' : ''}`}>
      <div className="kpi__value">{value}</div>
      <div className="kpi__label">{label}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  );
}

const KIND_LABEL: Record<FocusItem['kind'], (d: number) => string> = {
  overdue: (d) => `просрочено ${d} дн.`,
  today: () => 'сегодня',
  week: (d) => (d === 1 ? 'завтра' : `через ${d} дн.`),
  silent: (d) => `тишина ${d} дн.`,
};

function FocusList({ items }: { items: FocusItem[] }) {
  const [all, setAll] = useState(false);
  const { openDrawer, completeStep, addNote, toast } = useStore.getState();
  const LIMIT = useMediaQuery('(max-width: 720px)') ? 3 : 6;
  const shown = all ? items : items.slice(0, LIMIT);

  if (!items.length) {
    return (
      <div className="focus__empty">
        Всё под контролем: нет просроченных шагов и откликов без ответа. Запланируйте следующий шаг в карточке — он появится здесь.
      </div>
    );
  }

  const copyFollowup = async (item: FocusItem) => {
    try {
      await navigator.clipboard.writeText(TEMPLATES[0].build(item.app));
      addNote(item.app.id, 'Отправлено напоминание');
      toast('Текст напоминания скопирован, событие записано в историю');
    } catch {
      toast('Не удалось скопировать — откройте карточку', { tone: 'error' });
    }
  };

  return (
    <div className="focus__body">
      <ul className="focus__list">
        <AnimatePresence initial={false}>
          {shown.map((item) => (
            <motion.li
              key={item.app.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              className={`fitem fitem--${item.kind}`}
            >
              <button className="fitem__main" onClick={() => openDrawer({ id: item.app.id })}>
                <Avatar name={item.app.company} size={34} />
                <span className="fitem__text">
                  <span className="fitem__when">
                    {KIND_LABEL[item.kind](item.days)}
                    {item.app.nextTime && item.kind !== 'silent' ? ` · ${item.app.nextTime}` : ''}
                  </span>
                  <span className="fitem__what">
                    {item.kind === 'silent' ? 'Напомнить о себе' : item.app.nextAction || 'Следующий шаг'}
                  </span>
                  <span className="fitem__who">
                    {item.app.company}
                    {item.app.position ? ` · ${item.app.position}` : ''}
                  </span>
                </span>
              </button>
              <span className="fitem__actions">
                {item.kind === 'silent' ? (
                  <button className="mini-btn" onClick={() => copyFollowup(item)} title="Скопировать текст напоминания">
                    <Copy size={15} />
                  </button>
                ) : (
                  <>
                    {canExportEvent(item.app) && (
                      <button className="mini-btn" onClick={() => downloadICS(item.app)} title="Добавить в календарь (.ics)">
                        <CalendarPlus size={15} />
                      </button>
                    )}
                    <button
                      className="mini-btn mini-btn--ok"
                      onClick={() => {
                        completeStep(item.app.id);
                        toast('Шаг выполнен');
                      }}
                      title="Готово"
                    >
                      <Check size={16} strokeWidth={2.6} />
                    </button>
                  </>
                )}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length > LIMIT && (
        <button className="link-btn focus__more" onClick={() => setAll(!all)}>
          {all ? 'Свернуть' : `Показать ещё ${items.length - LIMIT}`}
        </button>
      )}
    </div>
  );
}
