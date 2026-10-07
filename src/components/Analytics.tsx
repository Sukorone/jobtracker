import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUSES, STATUS_ORDER } from '../lib/constants';
import { format, parseDate, plural } from '../lib/dates';
import { bySource, funnel, medianResponseDays, pct, sentApps, weekly, type WeekBucket } from '../lib/derive';
import { useStore } from '../lib/store';
import { stVar } from './bits';

export function Analytics() {
  const apps = useStore((s) => s.apps);
  const steps = useMemo(() => funnel(apps), [apps]);
  const weeks = useMemo(() => weekly(apps, 12), [apps]);
  const sources = useMemo(() => bySource(apps), [apps]);
  const median = useMemo(() => medianResponseDays(apps), [apps]);
  const sent = steps[0].count;

  const thisWeek = weeks[weeks.length - 1].count;
  const lastWeek = weeks[weeks.length - 2].count;
  const avgWeek = Math.round((weeks.reduce((s, w) => s + w.count, 0) / weeks.length) * 10) / 10;

  const byStatus = STATUS_ORDER.map((s) => ({ s, n: apps.filter((a) => a.status === s && !a.archived).length }));
  const maxStatus = Math.max(1, ...byStatus.map((x) => x.n));

  if (!sentApps(apps).length) {
    return (
      <div className="panel stats-empty">
        <h2>Пока нечего считать</h2>
        <p>Аналитика появится, когда будет хотя бы один отправленный отклик (не из колонки «Хочу»).</p>
      </div>
    );
  }

  return (
    <div className="stats">
      <h1 className="stats__title">
        Аналитика<span className="grad-text">.</span>
      </h1>

      <div className="stat-tiles">
        <Tile label="Откликов всего" value={sent} />
        <Tile
          label="На этой неделе"
          value={thisWeek}
          delta={thisWeek - lastWeek}
          sub={`в среднем ${String(avgWeek).replace('.', ',')} в неделю`}
        />
        <Tile label="Доля ответов" value={`${pct(steps[1].count, sent)}%`} sub={`${steps[1].count} из ${sent}`} />
        <Tile
          label="До первого ответа"
          value={median == null ? '—' : `${median} ${plural(median, 'день', 'дня', 'дней')}`}
          sub="медиана"
        />
      </div>

      <div className="stats__grid">
        <section className="panel chart-card chart-card--wide">
          <ChartHead title="Отклики по неделям" sub="за последние 12 недель, по дате отклика" />
          <WeeklyChart data={weeks} />
        </section>

        <section className="panel chart-card">
          <ChartHead title="Воронка" sub="сколько откликов дошли до каждого этапа" />
          <Funnel steps={steps} />
        </section>

        <section className="panel chart-card">
          <ChartHead title="Источники" sub="где откликаетесь и откуда отвечают" />
          <div className="hbars">
            {sources.map((r) => (
              <div key={r.source || 'none'} className="hbar">
                <div className="hbar__label">{r.label}</div>
                <div className="hbar__track">
                  <div className="hbar__fill" style={{ width: `${(r.count / sources[0].count) * 100}%` }} />
                </div>
                <div className="hbar__value">
                  {r.count}
                  <span className="hbar__extra">{pct(r.responded, r.count)}% ответов</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel chart-card">
          <ChartHead title="Сейчас по статусам" sub="без архива" />
          <div className="hbars">
            {byStatus.map(({ s, n }) => (
              <div key={s} className="hbar" style={stVar(s)}>
                <div className="hbar__label">
                  <i className="dot" /> {STATUSES[s].label}
                </div>
                <div className="hbar__track">
                  <div className="hbar__fill hbar__fill--status" style={{ width: `${(n / maxStatus) * 100}%` }} />
                </div>
                <div className="hbar__value">{n}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChartHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="chart-head">
      <h2>{title}</h2>
      <p>{sub}</p>
    </header>
  );
}

function Tile({ label, value, sub, delta }: { label: string; value: number | string; sub?: string; delta?: number }) {
  return (
    <div className="panel tile">
      <div className="tile__label">{label}</div>
      <div className="tile__value">
        {value}
        {delta != null && delta !== 0 && (
          <span className={`tile__delta ${delta > 0 ? 'is-up' : 'is-down'}`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
            <span className="sr-only"> по сравнению с прошлой неделей</span>
          </span>
        )}
      </div>
      {sub && <div className="tile__sub">{sub}</div>}
    </div>
  );
}

function Funnel({ steps }: { steps: ReturnType<typeof funnel> }) {
  const top = Math.max(1, steps[0].count);
  return (
    <ol className="funnel">
      {steps.map((st, i) => (
        <li key={st.key} className="funnel__step">
          <div className="funnel__label">{st.label}</div>
          <div className="funnel__track">
            <div className="funnel__fill" style={{ width: `${Math.max(st.count ? 3 : 0, (st.count / top) * 100)}%`, opacity: 1 - i * 0.12 }} />
          </div>
          <div className="funnel__value">
            {st.count}
            {i > 0 && <span className="funnel__conv">{pct(st.count, steps[i - 1].count)}%</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Single-series column chart with hover tooltip. */
function WeeklyChart({ data }: { data: WeekBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220;
  // Label every week on wide charts, thin out on narrow ones, always keep the current week.
  const labelEvery = W < 520 ? 3 : W < 900 ? 2 : 1;
  const pad = { t: 16, r: 8, b: 28, l: 28 };
  const max = Math.max(4, ...data.map((d) => d.count));
  const nice = Math.ceil(max / 4) * 4;
  const ticks = [0, nice / 4, nice / 2, (nice * 3) / 4, nice];
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / data.length;
  const bw = Math.min(24, band * 0.56);
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const label = (d: WeekBucket) => {
    const date = parseDate(d.start);
    return date ? format(date, 'd.MM') : '';
  };

  return (
    <div className="weekly" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="weekly__svg" role="img" aria-label="Количество откликов по неделям">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={pad.l - 8} y={y(t)} className="axis-text" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + band * i + (band - bw) / 2;
          const h = y(0) - y(d.count);
          const r = Math.min(4, h);
          const current = i === data.length - 1;
          return (
            <g key={d.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              {d.count > 0 && (
                <path
                  className={`bar ${current ? 'bar--current' : ''} ${hover === i ? 'is-hover' : ''}`}
                  d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                />
              )}
              {(data.length - 1 - i) % labelEvery === 0 && (
                <text x={pad.l + band * i + band / 2} y={H - 8} className="axis-text" textAnchor="middle">
                  {current ? 'эта' : label(d)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%`, top: `${(y(data[hover].count) / H) * 100}%` }}>
          <b>
            {data[hover].count} {plural(data[hover].count, 'отклик', 'отклика', 'откликов')}
          </b>
          <span>неделя с {label(data[hover])}</span>
        </div>
      )}
    </div>
  );
}
