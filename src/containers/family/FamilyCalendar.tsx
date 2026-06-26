import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { CardGridSkeleton, PageLoader } from '@containers/loading';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { callFunction } from '@shared/lib/api';
import { TherapyCalendar } from './therapy-calendar/TherapyCalendar';
import { THERAPY_MONTHS } from './therapy-calendar/therapy-calendar.types';
import { toTherapyDateKey } from './therapy-calendar/therapy-calendar.utils';
import { canRegisterEntryDate, pluralizeRegistros } from './routine-diary.utils';
import { FamilyCalendarDayModal } from './FamilyCalendarDayModal';
import { FamilyCalendarStatCards } from './FamilyCalendarStatCards';

interface CalendarDay {
  date: string;
  filled: boolean;
  entry_count?: number;
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

export default function FamilyCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: link, isLoading: linkLoading } = useQuery({
    queryKey: ['family-link', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('patient_family_links')
        .select('patient_id, patients(name)')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      return data as unknown as { patient_id: string; patients: { name: string } } | null;
    },
    enabled: !!user,
  });

  const { data, isLoading: routineLoading } = useQuery({
    queryKey: ['family-calendar', viewYear, viewMonth],
    queryFn: () =>
      callFunction<CalendarResponse>('get-family-calendar-status', {
        year: viewYear,
        month: viewMonth,
      }),
    staleTime: 60_000,
    enabled: !!link,
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
      cells.push({ day: d, dateKey: toTherapyDateKey(viewYear, viewMonth, d) });
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
    setSelectedDate(null);
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  }

  const filledDaysCount = data?.days?.length ?? 0;
  const crisisDaysCount = data?.days?.filter((d) => d.crisis_occurred).length ?? 0;
  const totalCheckins = useMemo(
    () => (data?.days ?? []).reduce((acc, day) => acc + (day.entry_count ?? 1), 0),
    [data?.days],
  );

  if (linkLoading) {
    return <PageLoader label="Carregando calendário..." />;
  }

  if (!link) {
    return <Navigate to="/family/link" replace />;
  }

  const todayKey = toTherapyDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const diaryStatCards = [
    { value: filledDaysCount, label: 'Dias com registro', accent: 'primary' as const },
    { value: crisisDaysCount, label: 'Dias com crise', accent: 'amber' as const },
    { value: totalCheckins, label: 'Check-ins no mês', accent: 'mint' as const },
  ] as const;

  return (
    <div className="animate-fade-in w-full space-y-6">
      <header>
        <h1 className="font-serif text-2xl tracking-tight text-charcoal lg:text-3xl">
          Calendário de Rotina
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Acompanhe as terapias e os registros diários de{' '}
          <span className="font-medium text-charcoal">{link.patients?.name}</span>
        </p>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-2 text-charcoal-muted hover:bg-slate-50"
          aria-label="Mês anterior"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-display text-base font-semibold text-charcoal">
          {THERAPY_MONTHS[viewMonth - 1]} {viewYear}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-2 text-charcoal-muted hover:bg-slate-50"
          aria-label="Próximo mês"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch xl:gap-8">
        <div className="flex min-h-0 flex-col">
          <TherapyCalendar
            viewYear={viewYear}
            viewMonth={viewMonth}
            todayKey={todayKey}
            enabled={!!link}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            hideMonthNav
          />
        </div>

        <section
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
          aria-label="Calendário de check-ins diários"
        >
          <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-mint-50/40 to-white px-4 py-4 sm:px-5">
            <h2 className="font-display text-base font-semibold text-charcoal sm:text-lg">
              Diário de humor e rotina
            </h2>
            <p className="mt-0.5 text-xs text-charcoal-muted sm:text-sm">
              Registros diários preenchidos pela família — vários momentos no mesmo dia.
            </p>

            {routineLoading ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <FamilyCalendarStatCards items={diaryStatCards} />
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
            {routineLoading ? (
              <CardGridSkeleton count={35} className="grid-cols-7 gap-1.5" />
            ) : (
              <div className="flex min-h-[17.5rem] flex-1 flex-col xl:min-h-[19rem]">
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
                    const isSelected = selectedDate === cell.dateKey;
                    const canRegister = cell.dateKey ? canRegisterEntryDate(cell.dateKey) : false;
                    const isClickable = filled || canRegister;

                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => {
                          if (!cell.dateKey) return;
                          if (filled) {
                            setSelectedDate(cell.dateKey);
                            return;
                          }
                          if (canRegister) {
                            navigate(`/family/diary?date=${cell.dateKey}`);
                          }
                        }}
                        disabled={!isClickable}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                            : filled
                              ? crisis
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300'
                                : 'border-mint/30 bg-mint-50 text-mint-dark hover:border-mint/50'
                              : canRegister
                                ? isToday
                                  ? 'border-primary/30 bg-primary-50/50 text-charcoal hover:border-primary/50'
                                  : 'border-slate-200 bg-white text-charcoal-muted hover:border-primary/30 hover:bg-primary-50/30'
                                : isToday
                                  ? 'border-primary/30 bg-primary-50/50 text-charcoal'
                                  : 'border-slate-100 bg-slate-50/50 text-charcoal-muted'
                        } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                        aria-label={
                          filled
                            ? `${cell.day} - ${status?.entry_count && status.entry_count > 1 ? pluralizeRegistros(status.entry_count) : 'Diário preenchido'}${crisis ? ', crise registrada' : ''}`
                            : canRegister
                              ? `${cell.day} - Sem registro, toque para registrar`
                              : `${cell.day} - Sem registro`
                        }
                      >
                        <span className={`font-medium ${isToday && !isSelected ? 'text-primary' : ''}`}>
                          {cell.day}
                        </span>
                        {filled && (
                          <span className="mt-0.5 text-[10px] leading-none" aria-hidden>
                            {status?.entry_count && status.entry_count > 1
                              ? status.entry_count
                              : crisis
                                ? '⚠️'
                                : '✓'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-auto flex flex-wrap gap-3 pt-4 text-[10px] text-charcoal-muted">
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
              </div>
            )}
          </div>
        </section>
      </div>

      <FamilyCalendarDayModal
        patientId={link.patient_id}
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
