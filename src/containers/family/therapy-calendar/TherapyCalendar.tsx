import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { TherapyCalendarSkeleton } from './TherapyCalendarSkeleton';
import { TherapyDaySessionCard } from './TherapyDaySessionCard';
import {
  THERAPY_MONTHS,
  THERAPY_WEEKDAYS,
  type ScheduledTherapiesResponse,
  type ScheduledTherapyDay,
} from './therapy-calendar.types';
import {
  buildTherapyMonthGrid,
  countTherapySessions,
  formatTherapyDateLong,
  mapTherapyDaysByDate,
} from './therapy-calendar.utils';

interface TherapyCalendarProps {
  viewYear: number;
  viewMonth: number;
  todayKey: string;
  enabled: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Quando true, oculta navegação interna (controle pelo pai). */
  hideMonthNav?: boolean;
}

export function TherapyCalendar({
  viewYear,
  viewMonth,
  todayKey,
  enabled,
  onPrevMonth,
  onNextMonth,
  hideMonthNav = false,
}: TherapyCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<ScheduledTherapyDay | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['patient-scheduled-therapies', viewYear, viewMonth],
    queryFn: () =>
      callFunction<ScheduledTherapiesResponse>('get-patient-scheduled-therapies', {
        year: viewYear,
        month: viewMonth,
      }),
    staleTime: 60_000,
    enabled,
  });

  const therapyMap = useMemo(() => mapTherapyDaysByDate(data?.days ?? []), [data?.days]);
  const grid = useMemo(() => buildTherapyMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const sessionCount = countTherapySessions(data?.days ?? []);
  const showSkeleton = enabled && isLoading && !data;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
      aria-label="Calendário de terapias agendadas"
    >
      <div className="border-b border-slate-100 bg-gradient-to-r from-primary-50/50 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-charcoal sm:text-lg">
              Terapias agendadas
            </h2>
            <p className="mt-0.5 text-xs text-charcoal-muted sm:text-sm">
              Próximas sessões com o terapeuta — separado do diário de humor.
            </p>
          </div>
          {!showSkeleton && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {sessionCount} {sessionCount === 1 ? 'sessão' : 'sessões'}
            </span>
          )}
        </div>

        {!hideMonthNav && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onPrevMonth();
                setSelectedDay(null);
              }}
              disabled={isFetching}
              className="rounded-lg p-2 text-charcoal-muted transition-colors hover:bg-white/80 disabled:opacity-50"
              aria-label="Mês anterior"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="font-display text-sm font-semibold text-charcoal">
              {THERAPY_MONTHS[viewMonth - 1]} {viewYear}
            </p>
            <button
              type="button"
              onClick={() => {
                onNextMonth();
                setSelectedDay(null);
              }}
              disabled={isFetching}
              className="rounded-lg p-2 text-charcoal-muted transition-colors hover:bg-white/80 disabled:opacity-50"
              aria-label="Próximo mês"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {showSkeleton ? (
          <TherapyCalendarSkeleton />
        ) : sessionCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-charcoal">
              Nenhuma sessão agendada para este mês
            </p>
            <p className="mt-1 max-w-xs text-xs text-charcoal-muted">
              Quando o terapeuta marcar uma consulta, ela aparecerá aqui com horário e nome do profissional.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted/70">
              {THERAPY_WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {grid.map((cell, i) => {
                if (cell.day === null) {
                  return <div key={`therapy-empty-${i}`} className="aspect-square" />;
                }

                const dayData = cell.dateKey ? therapyMap.get(cell.dateKey) : undefined;
                const hasSession = !!dayData?.sessions.length;
                const isToday = cell.dateKey === todayKey;
                const isSelected = selectedDay?.date === cell.dateKey;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={!hasSession}
                    onClick={() => setSelectedDay(dayData ?? null)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : hasSession
                          ? 'cursor-pointer border-primary/25 bg-primary-50/40 text-primary hover:border-primary/40 hover:bg-primary-50'
                          : isToday
                            ? 'border-primary/20 bg-primary-50/20 text-charcoal'
                            : 'cursor-default border-slate-100 bg-slate-50/40 text-charcoal-muted'
                    }`}
                    aria-label={
                      hasSession
                        ? `${cell.day} — ${dayData!.sessions.length} sessão(ões) agendada(s)`
                        : `${cell.day} — sem sessão`
                    }
                  >
                    <span className={`font-medium ${isToday && !isSelected ? 'text-primary' : ''}`}>
                      {cell.day}
                    </span>
                    {hasSession && (
                      <span
                        className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_2px_rgba(26,134,226,0.15)]"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-charcoal-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Dia com terapia
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-primary/20 bg-primary-50/20" />
                Hoje
              </span>
            </div>
          </>
        )}
      </div>

      {selectedDay && selectedDay.sessions.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
            {formatTherapyDateLong(selectedDay.date)}
          </p>
          <ul className="space-y-3">
            {selectedDay.sessions.map((session) => (
              <li key={session.id}>
                <TherapyDaySessionCard session={session} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
