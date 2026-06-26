import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CrisisCheckinsSkeleton, LoadingOverlay } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { CheckinDayReadModal } from './checkins/CheckinDayReadModal';
import { CheckinMonthHistoryList } from './checkins/CheckinMonthHistoryList';
import { CheckinsCalendarGrid } from './checkins/CheckinsCalendarGrid';
import type { CrisisCalendarDay, CrisisCalendarResponse } from './checkins/checkins-calendar.types';
import { toDateKey } from './checkins/checkins-calendar.utils';

interface PatientCrisisControlTabProps {
  patientId: string;
}

export function PatientCrisisControlTab({ patientId }: PatientCrisisControlTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusDate = searchParams.get('date');

  const today = new Date();
  const focusParts = focusDate?.split('-');
  const focusYear = focusParts?.[0] ? Number(focusParts[0]) : null;
  const focusMonth = focusParts?.[1] ? Number(focusParts[1]) : null;

  const [viewYear, setViewYear] = useState(focusYear ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusMonth ?? today.getMonth() + 1);
  const [viewingDay, setViewingDay] = useState<CrisisCalendarDay | null>(null);
  const [expandedMobileDate, setExpandedMobileDate] = useState<string | null>(null);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['patient-crisis-calendar', patientId, viewYear, viewMonth],
    queryFn: () =>
      callFunction<CrisisCalendarResponse>('get-patient-crisis-calendar', {
        patient_id: patientId,
        year: viewYear,
        month: viewMonth,
      }),
    staleTime: 60_000,
    enabled: !!patientId,
  });

  const filledMap = useMemo(() => {
    const map = new Map<string, CrisisCalendarDay>();
    for (const day of data?.days ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [data?.days]);

  useEffect(() => {
    setExpandedMobileDate(null);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (!focusDate || !focusYear || !focusMonth) return;
    setViewYear(focusYear);
    setViewMonth(focusMonth);
  }, [focusDate, focusYear, focusMonth]);

  useEffect(() => {
    if (!focusDate || !data?.days) return;
    const day = filledMap.get(focusDate);
    if (day?.filled) {
      setExpandedMobileDate(day.date);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('date');
          return next;
        },
        { replace: true },
      );
    }
  }, [focusDate, data?.days, filledMap, setSearchParams]);

  function handleViewDay(day: CrisisCalendarDay) {
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    if (isMobile) {
      setExpandedMobileDate((prev) => (prev === day.date ? null : day.date));
      return;
    }
    setViewingDay(day);
  }

  function handleToggleMobileDate(date: string) {
    setExpandedMobileDate((prev) => (prev === date ? null : date));
  }

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
  const summary = data?.summary;
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const showInitialLoad = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;

  if (showInitialLoad) {
    return <CrisisCheckinsSkeleton />;
  }

  return (
    <div className="relative space-y-6">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando check-ins..." />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          <p>{error instanceof Error ? error.message : 'Não foi possível carregar os check-ins.'}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-3 rounded-lg border border-error/20 bg-white px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-light/30 disabled:opacity-50"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-primary">{summary?.total_entries ?? 0}</p>
          <p className="mt-0.5 text-xs text-charcoal-muted">Check-ins realizados</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-amber-600">{summary?.crisis_count ?? 0}</p>
          <p className="mt-0.5 text-xs text-charcoal-muted">Dias com crise</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-charcoal-muted">
            {daysInMonth - (summary?.total_entries ?? 0)}
          </p>
          <p className="mt-0.5 text-xs text-charcoal-muted">Dias sem registro</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-mint-dark">{summary?.fill_rate ?? 0}%</p>
          <p className="mt-0.5 text-xs text-charcoal-muted">Taxa de preenchimento</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-slate-100 bg-white px-5 py-8 text-center text-sm text-charcoal-muted shadow-sm">
          Calendário indisponível no momento.
        </p>
      ) : (
        <CheckinsCalendarGrid
          viewYear={viewYear}
          viewMonth={viewMonth}
          todayKey={todayKey}
          filledMap={filledMap}
          isFetching={isFetching}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onViewDay={handleViewDay}
        />
      )}

      <CheckinMonthHistoryList
        days={data?.days ?? []}
        expandedDate={expandedMobileDate}
        onToggleDate={handleToggleMobileDate}
      />

      <CheckinDayReadModal day={viewingDay} onClose={() => setViewingDay(null)} />

      {!error && (data?.days?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <svg className="h-10 w-10 text-charcoal-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-3 text-sm text-charcoal-muted">
            Nenhum check-in registrado pela família neste mês.
          </p>
          <p className="mt-1 text-xs text-charcoal-muted/70">
            Os registros aparecem aqui conforme a família preenche o diário de rotina.
          </p>
        </div>
      )}
    </div>
  );
}
