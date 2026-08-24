import { useState } from 'react';
import type { BriefingData } from './dashboard.types';
import { WeekBars } from './home-charts';
import {
  ATTENDANCE_RANGE_OPTIONS,
  attendanceAxisCaption,
  attendanceLegendLabel,
  attendancePeriodTotalLabel,
  attendanceRangeDescription,
  attendanceRangeHint,
  attendanceSeries,
  type AttendanceRange,
} from './home-layout.utils';

interface HomeAttendanceChartProps {
  data?: BriefingData;
}

export function HomeAttendanceChart({ data }: HomeAttendanceChartProps) {
  const [range, setRange] = useState<AttendanceRange>('week');
  const points = attendanceSeries(
    {
      week_days: data?.week_days,
      month_days: data?.month_days,
      year_months: data?.year_months,
    },
    range,
  );
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const axis = attendanceAxisCaption(range);

  return (
    <section aria-labelledby="home-attendance-title" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id="home-attendance-title" className="font-display text-sm font-semibold text-charcoal">
            Atendimentos
          </h2>
          <p className="mt-0.5 text-xs text-charcoal-muted">{attendanceRangeHint(range)}</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Filtro de atendimentos">
          {ATTENDANCE_RANGE_OPTIONS.map((option) => {
            const active = option.id === range;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(option.id)}
                className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition-colors ${
                  active ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5">
        <p className="max-w-3xl text-xs leading-relaxed text-charcoal-muted">{attendanceRangeDescription(range)}</p>
        <p className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 font-display text-[11px] font-bold tabular-nums tracking-tight text-primary">
          {attendancePeriodTotalLabel(total)}
        </p>
      </div>

      <div className="px-3 pb-1 pt-4 sm:px-4">
        <WeekBars
          points={points}
          ariaLabel={`${attendancePeriodTotalLabel(total)}. ${attendanceRangeDescription(range)}`}
          emptyLabel="Ainda não há atendimentos neste recorte."
        />
      </div>

      <footer className="mt-2 flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-charcoal">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-primary" aria-hidden />
          <span>{attendanceLegendLabel()}</span>
        </div>
        <p className="text-[11px] text-charcoal-muted">
          {axis.x} · {axis.y}
        </p>
      </footer>
    </section>
  );
}
