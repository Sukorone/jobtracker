import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { STATUSES, STATUS_ORDER } from '../lib/constants';
import { confetti } from '../lib/confetti';
import { boardSort, matchesFilters } from '../lib/derive';
import { useStore } from '../lib/store';
import type { Application, Status } from '../lib/types';
import { AppCard, CardBody } from './AppCard';
import { stVar } from './bits';
import { NoMatches } from './EmptyState';

export function Board() {
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);
  const setStatus = useStore((s) => s.setStatus);
  const toast = useStore((s) => s.toast);
  const [activeId, setActiveId] = useState<string | null>(null);

  const visible = useMemo(() => apps.filter((a) => matchesFilters(a, filters)), [apps, filters]);
  const columns = useMemo(() => {
    const map = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Application[]])) as Record<Status, Application[]>;
    for (const a of visible) map[a.status].push(a);
    for (const s of STATUS_ORDER) map[s].sort(boardSort);
    return map;
  }, [visible]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  );

  const active = activeId ? apps.find((a) => a.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    navigator.vibrate?.(8);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as Status | undefined;
    const app = apps.find((a) => a.id === e.active.id);
    if (!to || !app || app.status === to) return;
    setStatus(app.id, to);
    if (to === 'offer') {
      const r = e.over?.rect;
      confetti(r ? r.left + r.width / 2 : undefined, r ? r.top + 80 : undefined);
      toast(`Оффер от ${app.company}! Поздравляем 🎉`);
    } else {
      toast(`${app.company} → ${STATUSES[to].label}`);
    }
  };

  if (!visible.length) return <NoMatches />;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Нажмите пробел, чтобы взять карточку, стрелками выберите колонку, пробел — отпустить.',
        },
      }}
    >
      <div className="board">
        {STATUS_ORDER.map((s) => (
          <Column key={s} status={s} apps={columns[s]} dragging={!!activeId} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {active ? (
          <article className="jcard jcard--overlay" style={stVar(active.status)}>
            <CardBody app={active} />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, apps, dragging }: { status: Status; apps: Application[]; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const openDrawer = useStore((s) => s.openDrawer);
  const closed = status === 'rejected';

  return (
    <section
      ref={setNodeRef}
      className={`col ${isOver ? 'is-over' : ''} ${dragging ? 'is-dragging' : ''} ${closed ? 'col--closed' : ''}`}
      style={stVar(status)}
      aria-label={STATUSES[status].label}
    >
      <header className="col__head" title={STATUSES[status].hint}>
        <i className="col__dot" />
        <h2 className="col__title">{STATUSES[status].label}</h2>
        <span className="col__count">{apps.length}</span>
        {!closed && (
          <button
            className="col__add"
            onClick={() => openDrawer({ draft: { status } })}
            aria-label={`Добавить в «${STATUSES[status].label}»`}
            title="Добавить сюда"
          >
            <Plus size={15} />
          </button>
        )}
      </header>
      <div className="col__body">
        {apps.map((a) => (
          <AppCard key={a.id} app={a} />
        ))}
        {!apps.length && <div className="col__empty">{dragging ? 'Отпустите здесь' : 'Пусто'}</div>}
      </div>
    </section>
  );
}
