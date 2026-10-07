import { useDraggable } from '@dnd-kit/core';
import { Banknote, Laptop, MapPin } from 'lucide-react';
import { memo } from 'react';
import { FORMATS, SOURCES } from '../lib/constants';
import { silenceDays } from '../lib/derive';
import { useStore } from '../lib/store';
import type { Application } from '../lib/types';
import { Avatar, NextStep, PriorityFlame, Silence, stVar } from './bits';

interface Props {
  app: Application;
  overlay?: boolean;
}

export function CardBody({ app }: Props) {
  const silence = useStore((s) => s.settings.silenceDays);
  const place = [app.format ? FORMATS[app.format] : '', app.location].filter(Boolean).join(' · ');
  return (
    <>
      <div className="jcard__top">
        <Avatar name={app.company} size={38} />
        <div className="jcard__titles">
          <h3 className="jcard__company">{app.company || 'Без названия'}</h3>
          <p className="jcard__position">{app.position}</p>
        </div>
        <PriorityFlame app={app} />
      </div>

      {(app.salary || place || app.source) && (
        <div className="jcard__chips">
          {app.salary && (
            <span className="tag">
              <Banknote size={13} /> {app.salary}
            </span>
          )}
          {place && (
            <span className="tag">
              {app.format === 'remote' ? <Laptop size={13} /> : <MapPin size={13} />} {place}
            </span>
          )}
          {app.source && <span className="tag tag--quiet">{SOURCES[app.source]}</span>}
        </div>
      )}

      <NextStep app={app} compact />
      <Silence days={silenceDays(app, silence)} />
    </>
  );
}

export const AppCard = memo(function AppCard({ app }: Props) {
  const openDrawer = useStore((s) => s.openDrawer);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id, data: { status: app.status } });

  return (
    <article
      ref={setNodeRef}
      className={`jcard ${isDragging ? 'is-dragging' : ''}`}
      style={stVar(app.status)}
      onClick={() => openDrawer({ id: app.id })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openDrawer({ id: app.id });
      }}
      {...attributes}
      {...listeners}
      aria-roledescription="перетаскиваемая карточка"
      aria-label={`${app.company}, ${app.position}`}
    >
      <CardBody app={app} />
    </article>
  );
});
