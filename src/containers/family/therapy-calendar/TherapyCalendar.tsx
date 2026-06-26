import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { TherapyCalendarSkeleton } from './TherapyCalendarSkeleton';
import { TherapySessionDayModal } from './TherapySessionDayModal';
import {
  THERAPY_MONTHS,
  THERAPY_WEEKDAYS,
  type ScheduledTherapiesResponse,
  type ScheduledTherapyDay,
} from './therapy-calendar.types';
import {
  buildTherapyMonthGrid,
  countTherapySessions,
  mapTherapyDaysByDate,
  summarizeTherapyMonth,
} from './therapy-calendar.utils';
import { FamilyCalendarStatCards } from '../FamilyCalendarStatCards';

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

function isPastSessionStatus(status: string): boolean {
  return status === 'completed' || status === 'not_completed';
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
  const monthSummary = useMemo(() => summarizeTherapyMonth(data?.days ?? []), [data?.days]);
  const showSkeleton = enabled && isLoading && !data;

  const statCards = [
    { value: monthSummary.total, label: 'Sessões no mês', accent: 'primary' as const },
    { value: monthSummary.upcoming, label: 'Agendadas', accent: 'primary' as const },
    { value: monthSummary.completed, label: 'Realizadas', accent: 'mint' as const },
  ] as const;

  return (
    <>
      <section
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
        aria-label="Calendário de terapias"
      >
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-primary-50/50 to-white px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-display text-base font-semibold text-charcoal sm:text-lg">
              Terapias agendadas
            </h2>
            <p className="mt-0.5 text-xs text-charcoal-muted sm:text-sm">
              Agendamentos e histórico de sessões — navegue pelos meses anteriores.
            </p>
          </div>

          {!showSkeleton ? (
            <FamilyCalendarStatCards items={statCards} />
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}

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

        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          {showSkeleton ? (
            <TherapyCalendarSkeleton />
          ) : (
            <div className="flex min-h-[17.5rem] flex-1 flex-col xl:min-h-[19rem]">
              {sessionCount === 0 ? (
                <p className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-xs text-charcoal-muted">
                  Nenhuma sessão neste mês. Use as setas acima para ver meses anteriores.
                </p>
              ) : null}

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
                  const hasSharedReport = dayData?.sessions.some((s) => s.has_shared_report);
                  const isToday = cell.dateKey === todayKey;
                  const isSelected = selectedDay?.date === cell.dateKey;
                  const isPastOnly =
                    hasSession && dayData!.sessions.every((s) => isPastSessionStatus(s.status));

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      disabled={!hasSession}
                      onClick={() => dayData && setSelectedDay(dayData)}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : hasSession
                            ? isPastOnly
                              ? 'cursor-pointer border-mint/30 bg-mint-50/50 text-mint-dark hover:border-mint/50'
                              : 'cursor-pointer border-primary/25 bg-primary-50/40 text-primary hover:border-primary/40 hover:bg-primary-50'
                            : isToday
                              ? 'cursor-default border-primary/20 bg-primary-50/20 text-charcoal'
                              : 'cursor-default border-slate-100 bg-slate-50/40 text-charcoal-muted'
                      }`}
                      aria-label={
                        hasSession
                          ? `${cell.day} — ${dayData!.sessions.length} sessão(ões)${hasSharedReport ? ', com relatório compartilhado' : ''}`
                          : `${cell.day} — sem sessão`
                      }
                    >
                      <span className={`font-medium ${isToday && !isSelected ? 'text-primary' : ''}`}>
                        {cell.day}
                      </span>
                      {hasSession && (
                        <span className="mt-1 flex items-center gap-0.5" aria-hidden>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isPastOnly ? 'bg-mint-dark' : 'bg-primary'
                            }`}
                          />
                          {hasSharedReport ? (
                            <span className="text-[8px] leading-none text-mint-dark">📄</span>
                          ) : null}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-wrap gap-3 pt-4 text-[10px] text-charcoal-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Agendada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-mint-dark" />
                  Realizada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[10px]">📄</span>
                  Relatório compartilhado
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <TherapySessionDayModal day={selectedDay} onClose={() => setSelectedDay(null)} />
    </>
  );
}
