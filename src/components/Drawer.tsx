import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Send,
  Trash,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FORMATS, PRIORITIES, SOURCES, STATUSES, STATUS_ORDER, detectSource } from '../lib/constants';
import { confetti } from '../lib/confetti';
import { confirm } from '../lib/confirm';
import { dateTime, todayISO } from '../lib/dates';
import { useMediaQuery } from '../lib/hooks';
import { TEMPLATES, canExportEvent, downloadICS } from '../lib/io';
import { emptyDraft, useStore } from '../lib/store';
import type { Application, Draft, Priority, Status, TimelineEvent } from '../lib/types';
import { Avatar, stVar } from './bits';

export function Drawer() {
  const target = useStore((s) => s.drawer);
  const key = target ? ('id' in target ? target.id : 'new') : 'none';
  return (
    <AnimatePresence>
      {target && <Sheet key={key}>{'id' in target ? <ExistingEditor id={target.id} /> : <NewEditor seed={target.draft} />}</Sheet>}
    </AnimatePresence>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  const mobile = useMediaQuery('(max-width: 720px)');
  const hidden = mobile ? { y: '100%', opacity: 1 } : { x: '100%', opacity: 0.6 };
  const close = () => useStore.getState().openDrawer(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-modal-open]')) close();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Отклик">
      <motion.div
        className="sheet__backdrop"
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="sheet__panel"
        initial={hidden}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={hidden}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ─── Existing application: edits save immediately ─── */

function ExistingEditor({ id }: { id: string }) {
  const app = useStore((s) => s.apps.find((a) => a.id === id));
  const { update, setStatus, setArchived, remove, completeStep, openDrawer, toast } = useStore.getState();

  if (!app) return null;

  const changeStatus = (s: Status) => {
    if (s === app.status) return;
    setStatus(app.id, s);
    if (s === 'offer') confetti();
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Удалить отклик?',
      text: `«${app.company}» исчезнет вместе с историей. Если процесс просто закончился — лучше отправить в архив.`,
      ok: 'Удалить',
      danger: true,
    });
    if (ok) {
      openDrawer(null);
      remove(app.id);
    }
  };

  return (
    <>
      <Header value={app} onChange={(p) => update(app.id, p)} onStatus={changeStatus} />
      <div className="sheet__body">
        <NextStepBlock
          value={app}
          onChange={(p) => update(app.id, p)}
          actions={
            (app.nextAction || app.nextDate) && (
              <>
                {canExportEvent(app) && (
                  <button className="btn btn--ghost btn--sm" onClick={() => downloadICS(app)}>
                    <CalendarPlus size={15} /> В календарь
                  </button>
                )}
                <button
                  className="btn btn--ok btn--sm"
                  onClick={() => {
                    completeStep(app.id);
                    toast('Шаг выполнен и записан в историю');
                  }}
                >
                  <Check size={15} strokeWidth={2.6} /> Готово
                </button>
              </>
            )
          }
        />
        <Details value={app} onChange={(p) => update(app.id, p)} />
        <Templates app={app} />
        <History app={app} />
      </div>
      <footer className="sheet__foot">
        <button className="btn btn--ghost btn--sm" onClick={() => setArchived(app.id, !app.archived)}>
          {app.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          {app.archived ? 'Вернуть из архива' : 'В архив'}
        </button>
        <button className="btn btn--danger btn--sm" onClick={onDelete}>
          <Trash size={15} /> Удалить
        </button>
        <span className="sheet__saved">Сохраняется автоматически</span>
      </footer>
    </>
  );
}

/* ─── New application: local draft until "Добавить" ─── */

function NewEditor({ seed }: { seed: Partial<Draft> }) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(seed));
  const [error, setError] = useState(false);
  const { add, openDrawer, toast } = useStore.getState();
  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    if (p.company) setError(false);
  };

  const submit = () => {
    if (!draft.company.trim()) {
      setError(true);
      document.querySelector<HTMLInputElement>('.sheet .head__company')?.focus();
      return;
    }
    const d = { ...draft, company: draft.company.trim(), position: draft.position.trim() };
    if (d.status === 'wishlist') d.dateApplied = '';
    const id = add(d);
    openDrawer(null);
    toast(`«${d.company}» добавлено`, { action: { label: 'Открыть', run: () => openDrawer({ id }) } });
  };

  return (
    <form
      className="sheet__form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
      }}
    >
      <Header value={draft} onChange={patch} onStatus={(s) => patch({ status: s })} isNew error={error} />
      <div className="sheet__body">
        <QuickLink value={draft} onChange={patch} />
        <NextStepBlock value={draft} onChange={patch} />
        <Details value={draft} onChange={patch} hideLink />
      </div>
      <footer className="sheet__foot">
        <span className="sheet__saved">
          <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd>
          <kbd>Enter</kbd> — сохранить
        </span>
        <button type="button" className="btn btn--ghost" onClick={() => openDrawer(null)}>
          Отмена
        </button>
        <button type="submit" className="btn btn--primary">
          Добавить
        </button>
      </footer>
    </form>
  );
}

/* ─── Pieces ─── */

type FieldsProps = { value: Draft | Application; onChange(p: Partial<Draft>): void };

function Header({
  value,
  onChange,
  onStatus,
  isNew,
  error,
}: FieldsProps & { onStatus(s: Status): void; isNew?: boolean; error?: boolean }) {
  const close = () => useStore.getState().openDrawer(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isNew) setTimeout(() => ref.current?.focus(), 120);
  }, [isNew]);

  return (
    <header className="head" style={stVar(value.status)}>
      <div className="head__glow" />
      <div className="head__row">
        <Avatar name={value.company || '?'} size={52} />
        <div className="head__titles">
          <input
            ref={ref}
            className={`head__company ${error ? 'is-error' : ''}`}
            value={value.company}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="Компания"
            aria-label="Компания"
            aria-invalid={error}
          />
          <input
            className="head__position"
            value={value.position}
            onChange={(e) => onChange({ position: e.target.value })}
            placeholder="Вакансия, например Senior Frontend"
            aria-label="Вакансия"
          />
          {error && <div className="head__error">Укажите компанию</div>}
        </div>
        <button type="button" className="icon-btn head__close" onClick={close} aria-label="Закрыть">
          <X size={18} />
        </button>
      </div>
      <div className="pills" role="radiogroup" aria-label="Статус">
        {STATUS_ORDER.map((s) => (
          <button
            type="button"
            key={s}
            role="radio"
            aria-checked={value.status === s}
            className={`pill ${value.status === s ? 'is-active' : ''}`}
            style={stVar(s)}
            onClick={() => onStatus(s)}
            title={STATUSES[s].hint}
          >
            <i className="pill__dot" />
            {STATUSES[s].label}
          </button>
        ))}
      </div>
    </header>
  );
}

function Section({ title, icon, children, aside }: { title: string; icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="sect">
      <div className="sect__head">
        <h3 className="sect__title">
          {icon}
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

function QuickLink({ value, onChange }: FieldsProps) {
  return (
    <div className="quicklink">
      <Field label="Ссылка на вакансию" wide>
        <input
          type="url"
          inputMode="url"
          value={value.link}
          placeholder="Вставьте ссылку — источник определится сам"
          onChange={(e) => {
            const link = e.target.value;
            onChange({ link, ...(link && !value.source ? { source: detectSource(link) } : {}) });
          }}
        />
      </Field>
    </div>
  );
}

function NextStepBlock({ value, onChange, actions }: FieldsProps & { actions?: ReactNode }) {
  const due = value.nextDate && value.nextDate < todayISO() ? 'overdue' : '';
  return (
    <section className={`nextblock ${due ? 'is-overdue' : ''}`}>
      <div className="nextblock__head">
        <span className="nextblock__title">Следующий шаг</span>
        {due && <span className="nextblock__badge">просрочен</span>}
      </div>
      <input
        className="nextblock__action"
        value={value.nextAction}
        onChange={(e) => onChange({ nextAction: e.target.value })}
        placeholder="Что сделать? Например: сдать тестовое"
        aria-label="Следующий шаг"
      />
      <div className="nextblock__row">
        <input type="date" value={value.nextDate} onChange={(e) => onChange({ nextDate: e.target.value })} aria-label="Дата" />
        <input
          type="time"
          value={value.nextTime}
          onChange={(e) => onChange({ nextTime: e.target.value })}
          aria-label="Время"
          disabled={!value.nextDate}
        />
        <div className="nextblock__actions">{actions}</div>
      </div>
    </section>
  );
}

function Details({ value, onChange, hideLink }: FieldsProps & { hideLink?: boolean }) {
  return (
    <Section title="Детали">
      <div className="grid">
        {!hideLink && (
          <Field label="Ссылка на вакансию" wide>
            <div className="input-with-btn">
              <input
                type="url"
                inputMode="url"
                value={value.link}
                placeholder="https://"
                onChange={(e) => {
                  const link = e.target.value;
                  onChange({ link, ...(link && !value.source ? { source: detectSource(link) } : {}) });
                }}
              />
              {value.link && (
                <a
                  className="icon-btn"
                  href={/^https?:\/\//i.test(value.link) ? value.link : `https://${value.link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть вакансию"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </Field>
        )}
        <Field label="Источник">
          <select value={value.source} onChange={(e) => onChange({ source: e.target.value as Draft['source'] })}>
            <option value="">—</option>
            {Object.entries(SOURCES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Формат">
          <select value={value.format} onChange={(e) => onChange({ format: e.target.value as Draft['format'] })}>
            <option value="">—</option>
            {Object.entries(FORMATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Зарплата">
          <input value={value.salary} onChange={(e) => onChange({ salary: e.target.value })} placeholder="300 тыс. ₽ / $4k" />
        </Field>
        <Field label="Город">
          <input value={value.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="Москва" />
        </Field>
        <Field label="Контакт" wide>
          <input
            value={value.contact}
            onChange={(e) => onChange({ contact: e.target.value })}
            placeholder="Имя, @telegram или почта рекрутера"
          />
        </Field>
        <Field label="Дата отклика">
          <input type="date" value={value.dateApplied} onChange={(e) => onChange({ dateApplied: e.target.value })} />
        </Field>
        <Field label="Приоритет">
          <div className="segmented" role="radiogroup" aria-label="Приоритет">
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
              <button
                type="button"
                key={p}
                role="radio"
                aria-checked={value.priority === p}
                className={`segmented__btn segmented__btn--${p} ${value.priority === p ? 'is-active' : ''}`}
                onClick={() => onChange({ priority: p })}
              >
                {PRIORITIES[p].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Заметки" wide>
          <textarea
            value={value.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
            placeholder="Стек, впечатления, о чём договорились…"
          />
        </Field>
      </div>
    </Section>
  );
}

function Templates({ app }: { app: Application }) {
  const toast = useStore((s) => s.toast);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Текст скопирован — вставьте в чат или письмо');
    } catch {
      toast('Не удалось скопировать', { tone: 'error' });
    }
  };
  return (
    <Section title="Письма" icon={<MessageSquare size={15} />}>
      <div className="templates">
        {TEMPLATES.map((t) => (
          <button key={t.key} type="button" className="template" onClick={() => copy(t.build(app))} title={t.build(app)}>
            <Copy size={14} />
            {t.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function History({ app }: { app: Application }) {
  const [note, setNote] = useState('');
  const addNote = useStore((s) => s.addNote);
  const events = [...app.timeline].sort((a, b) => b.at - a.at);
  const send = () => {
    if (!note.trim()) return;
    addNote(app.id, note);
    setNote('');
  };

  return (
    <Section title="История">
      <div className="composer">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Добавить запись: созвонились, обсудили вилку…"
          aria-label="Новая запись в истории"
        />
        <button type="button" className="icon-btn icon-btn--accent" onClick={send} disabled={!note.trim()} aria-label="Добавить запись">
          <Send size={16} />
        </button>
      </div>
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id} className={`tl tl--${e.kind}`} style={e.to ? stVar(e.to) : undefined}>
            <i className="tl__dot" />
            <div className="tl__body">
              <div className="tl__text">
                <EventText e={e} />
              </div>
              <time className="tl__time">{dateTime(e.at)}</time>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function EventText({ e }: { e: TimelineEvent }) {
  switch (e.kind) {
    case 'created':
      return (
        <>
          Добавлено в <b>{e.to ? STATUSES[e.to].label : 'трекер'}</b>
        </>
      );
    case 'status':
      return (
        <>
          {e.from ? STATUSES[e.from].label : '—'} → <b>{e.to ? STATUSES[e.to].label : '—'}</b>
        </>
      );
    case 'step':
      return (
        <>
          <Check size={13} className="tl__check" /> {e.text}
        </>
      );
    default:
      return <>{e.text}</>;
  }
}
