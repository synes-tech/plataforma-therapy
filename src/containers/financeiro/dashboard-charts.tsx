import type { ReactNode } from 'react';
import { formatCurrency } from '@features/billing/format';
import {
  CHART_PALETTE,
  donutSegments,
  formatCompactCurrency,
  trendMax,
  type DonutSlice,
  type NamedCents,
  type TrendPoint,
} from './dashboard.utils';

export function ChartCard({
  title,
  hint,
  children,
  className = '',
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <header className="mb-4 shrink-0">
        <h2 className="font-display text-sm font-semibold text-charcoal">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-charcoal-muted">{hint}</p> : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  emptyLabel = 'Sem dados neste recorte',
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  emptyLabel?: string;
}) {
  const segments = donutSegments(slices);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label={centerLabel}>
          <circle cx="80" cy="80" r="62" fill="none" stroke="#F1F5F9" strokeWidth="22" />
          {segments.length === 0 ? (
            <circle cx="80" cy="80" r="51" fill="#F8FAF9" />
          ) : (
            segments.map((segment) => (
              <path key={segment.id} d={segment.d} fill={segment.color}>
                <title>
                  {segment.label}: {formatCurrency(segment.value)}
                </title>
              </path>
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-charcoal-muted">{centerLabel}</span>
          <span className="font-display text-sm font-bold tabular-nums tracking-tight text-charcoal">{centerValue}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {slices.length === 0 ? (
          <li className="text-xs text-charcoal-muted">{emptyLabel}</li>
        ) : (
          slices.map((slice) => {
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return (
              <li key={slice.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="truncate text-charcoal">{slice.label}</span>
                </span>
                <span className="shrink-0 font-display font-bold tabular-nums tracking-tight text-charcoal">
                  {formatCompactCurrency(slice.value)} · {pct}%
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

export function TrendBars({ points }: { points: TrendPoint[] }) {
  const max = trendMax(points);
  const height = 168;
  const width = 560;
  const pad = { top: 12, right: 8, bottom: 28, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const groupW = points.length > 0 ? innerW / points.length : innerW;
  const barW = Math.max(6, groupW * 0.22);

  const y = (value: number) => pad.top + innerH - (value / max) * innerH;
  const linePoints = points
    .map((point, index) => {
      const x = pad.left + groupW * index + groupW / 2;
      return `${x},${y(Math.max(0, point.lucro))}`;
    })
    .join(' ');

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-charcoal-muted">Ainda não há histórico de 6 meses.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Tendência de 6 meses">
        {[0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1={pad.left}
            x2={width - pad.right}
            y1={y(max * tick)}
            y2={y(max * tick)}
            stroke="#E2E8F0"
            strokeDasharray="3 4"
          />
        ))}
        {points.map((point, index) => {
          const cx = pad.left + groupW * index + groupW / 2;
          return (
            <g key={point.month}>
              <rect
                x={cx - barW - 2}
                y={y(point.receita)}
                width={barW}
                height={Math.max(2, (point.receita / max) * innerH)}
                rx="4"
                fill={CHART_PALETTE.primary}
              >
                <title>Entradas {point.label}: {formatCurrency(point.receita)}</title>
              </rect>
              <rect
                x={cx + 2}
                y={y(point.despesa)}
                width={barW}
                height={Math.max(2, (point.despesa / max) * innerH)}
                rx="4"
                fill="#CBD5E1"
              >
                <title>Saídas {point.label}: {formatCurrency(point.despesa)}</title>
              </rect>
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize="11"
              >
                {point.label}
              </text>
            </g>
          );
        })}
        {points.some((point) => point.lucro > 0) ? (
          <>
            <polyline
              points={linePoints}
              fill="none"
              stroke={CHART_PALETTE.mint}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {points.map((point, index) => {
              const cx = pad.left + groupW * index + groupW / 2;
              return (
                <circle key={`l-${point.month}`} cx={cx} cy={y(Math.max(0, point.lucro))} r="3.5" fill={CHART_PALETTE.mint}>
                  <title>Lucro {point.label}: {formatCurrency(point.lucro)}</title>
                </circle>
              );
            })}
          </>
        ) : null}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-4 text-[11px] text-charcoal-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary" /> Entradas
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-slate-300" /> Saídas
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-mint" /> Lucro
        </li>
      </ul>
    </div>
  );
}

export function HorizontalBars({
  rows,
  emptyLabel,
  color = CHART_PALETTE.primary,
}: {
  rows: NamedCents[];
  emptyLabel: string;
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.cents));
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-charcoal-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-charcoal">{row.label}</span>
            <span className="shrink-0 font-display font-bold tabular-nums tracking-tight text-charcoal">{formatCurrency(row.cents)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${(row.cents / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MeterBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-charcoal-muted">{label}</span>
        <span className="font-display font-bold tabular-nums tracking-tight text-charcoal">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function DeltaChip({ cents, pct }: { cents: number; pct: number | null }) {
  if (cents === 0 && pct === 0) {
    return <span className="text-[11px] text-charcoal-muted">estável vs mês anterior</span>;
  }
  const up = cents > 0;
  const tone = up ? 'text-mint-dark bg-emerald-50' : 'text-red-700 bg-red-50';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-display text-[11px] font-bold tabular-nums tracking-tight ${tone}`}>
      {up ? '↑' : '↓'} {pct === null ? formatCompactCurrency(Math.abs(cents)) : `${Math.abs(pct)}%`} vs mês anterior
    </span>
  );
}
