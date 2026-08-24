import { donutSegments } from '@containers/financeiro/dashboard.utils';
import type { WeekDayPoint } from './dashboard.types';
import { denseBarLabelStep } from './home-layout.utils';
import { weekBarMax, weekBarTicks } from './home.utils';

export function WeekBars({
  points,
  ariaLabel = 'Sessões nos últimos 7 dias',
  emptyLabel = 'Ainda não há sessões nesta semana.',
}: {
  points: WeekDayPoint[];
  ariaLabel?: string;
  emptyLabel?: string;
}) {
  const max = weekBarMax(points);
  const ticks = weekBarTicks(max);
  const labelStep = denseBarLabelStep(points.length);
  const showValues = points.length <= 12;

  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-charcoal-muted">{emptyLabel}</p>;
  }

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <div className="flex w-full gap-2">
        <div
          className="flex h-52 shrink-0 flex-col-reverse justify-between py-0.5 text-right font-display text-[10px] font-bold tabular-nums leading-none tracking-tight text-slate-500"
          aria-hidden
        >
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-52 w-full">
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute inset-x-0 border-t border-dashed border-slate-200"
                style={{ bottom: `${(tick / max) * 100}%` }}
                aria-hidden
              />
            ))}

            <div className="relative z-[1] flex h-full items-end">
              {points.map((point) => {
                const heightPct = (point.count / max) * 100;
                return (
                  <div
                    key={point.date}
                    className="relative h-full min-w-0 flex-1"
                    title={`${point.label}: ${point.count} sessão${point.count === 1 ? '' : 'ões'}`}
                  >
                    <div
                      className="absolute bottom-0 left-0.5 right-0.5 rounded-t-md bg-primary sm:left-1 sm:right-1"
                      style={{ height: point.count > 0 ? `${Math.max(heightPct, 3)}%` : '0%' }}
                    />
                    {showValues && point.count > 0 ? (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 font-display text-[10px] font-bold tabular-nums tracking-tight text-charcoal"
                        style={{ bottom: `calc(${Math.max(heightPct, 3)}% + 2px)` }}
                      >
                        {point.count}
                      </span>
                    ) : null}
                    <span className="sr-only">
                      {point.label}: {point.count} sessão{point.count === 1 ? '' : 'ões'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-1.5 flex w-full" aria-hidden>
            {points.map((point, index) => {
              const showLabel = index % labelStep === 0 || index === points.length - 1;
              return (
                <span
                  key={point.date}
                  className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500 sm:text-[11px]"
                >
                  {showLabel ? point.label : ''}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CountDonut({
  slices,
  centerLabel,
  centerValue,
  emptyLabel,
}: {
  slices: Array<{ id: string; label: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string;
  emptyLabel: string;
}) {
  const segments = donutSegments(slices);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="relative mx-auto h-40 w-40 shrink-0 xl:h-36 xl:w-36 2xl:h-40 2xl:w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label={centerLabel}>
          <circle cx="80" cy="80" r="62" fill="none" stroke="#F1F5F9" strokeWidth="22" />
          {segments.map((segment) => (
            <path key={segment.id} d={segment.d} fill={segment.color}>
              <title>
                {segment.label}: {segment.value}
              </title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-charcoal-muted">{centerLabel}</span>
          <span className="font-display text-xl font-bold tabular-nums tracking-tight text-charcoal xl:text-lg 2xl:text-xl">
            {centerValue}
          </span>
        </div>
      </div>
      <ul className="mt-3 w-full space-y-1.5">
        {slices.length === 0 ? (
          <li className="text-center text-xs text-charcoal-muted">{emptyLabel}</li>
        ) : (
          slices.map((slice) => {
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return (
              <li key={slice.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-charcoal">{slice.label}</span>
                </span>
                <span className="shrink-0 font-display font-bold tabular-nums tracking-tight text-charcoal">
                  {slice.value} · {pct}%
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
