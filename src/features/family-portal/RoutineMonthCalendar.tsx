import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';

interface CalendarDay {
  date: string;
  filled: boolean;
  mood_score?: number;
  crisis_occurred?: boolean;
}

interface CalendarResponse {
  patient_id: string;
  year: number;
  month: number;
  days: CalendarDay[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function RoutineMonthCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ['family-calendar', viewYear, viewMonth],
    queryFn: () =>
      callFunction<CalendarResponse>('get-family-calendar-status', {
        year: viewYear,
        month: viewMonth,
      }),
    staleTime: 60_000,
  });

  const filledMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of data?.days ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [data?.days]);

  const grid = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{ day: number | null; dateKey?: string }> = [];

    for (let i = 0; i < firstDow; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateKey: toDateKey(viewYear, viewMonth, d) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const filledCount = data?.days?.length ?? 0;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-primary-50/40 to-mint-50/30 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-charcoal">Calendário de Rotina</h2>
            <p className="mt-0.5 text-xs text-charcoal-muted">
              {filledCount} dia{filledCount !== 1 ? 's' : ''} preenchido{filledCount !== 1 ? 's' : ''} este mês
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-2 text-charcoal-muted hover:bg-white/80"
              aria-label="Mês anterior"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[7rem] text-center text-sm font-medium text-charcoal">
              {MONTHS[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-2 text-charcoal-muted hover:bg-white/80"
              aria-label="Próximo mês"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted/70">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {grid.map((cell, i) => {
                if (cell.day === null) {
                  return <div key={`empty-${i}`} className="aspect-square" />;
                }
                const status = cell.dateKey ? filledMap.get(cell.dateKey) : undefined;
                const isToday = cell.dateKey === todayKey;
                const filled = !!status?.filled;
                const crisis = status?.crisis_occurred;

                return (
                  <div
                    key={cell.dateKey}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition-colors ${
                      filled
                        ? crisis
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-mint/30 bg-mint-50 text-mint-dark'
                        : isToday
                          ? 'border-primary/30 bg-primary-50/50 text-charcoal'
                          : 'border-slate-100 bg-slate-50/50 text-charcoal-muted'
                    }`}
                    title={
                      filled
                        ? `Diário preenchido${crisis ? ' — crise registrada' : ''}`
                        : 'Sem registro neste dia'
                    }
                  >
                    <span className={`font-medium ${isToday ? 'text-primary' : ''}`}>{cell.day}</span>
                    {filled && (
                      <span className="mt-0.5 text-[10px] leading-none" aria-hidden>
                        {crisis ? '⚠️' : '✓'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-charcoal-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded border border-mint/30 bg-mint-50" /> Preenchido
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" /> Com crise
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded border border-slate-100 bg-slate-50/50" /> Vazio
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
