import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { CardGridSkeleton, PageLoader } from '@containers/loading';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
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

const MOOD_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😢', label: 'Difícil' },
  2: { emoji: '😟', label: 'Abaixo' },
  3: { emoji: '😐', label: 'Neutro' },
  4: { emoji: '🙂', label: 'Bom' },
  5: { emoji: '😄', label: 'Ótimo' },
};

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function DayDetailPanel({ day }: { day: CalendarDay }) {
  const mood = day.mood_score ? MOOD_LABELS[day.mood_score] : null;
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(day.date + 'T12:00:00'));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted/70">
        {dateFormatted}
      </p>
      <div className="mt-3 flex items-center gap-3">
        {mood && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">{mood.emoji}</span>
            <span className="text-sm font-medium text-charcoal">{mood.label}</span>
          </div>
        )}
        {day.crisis_occurred && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Crise registrada
          </span>
        )}
      </div>
    </div>
  );
}

export default function FamilyCalendar() {
  const { user } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

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

  const { data, isLoading } = useQuery({
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
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }

  if (linkLoading) {
    return <PageLoader label="Carregando calendário..." />;
  }

  if (!link) {
    return <Navigate to="/family/link" replace />;
  }

  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const filledCount = data?.days?.filter((d) => d.filled).length ?? 0;
  const crisisCount = data?.days?.filter((d) => d.crisis_occurred).length ?? 0;
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="font-serif text-2xl tracking-tight text-charcoal lg:text-3xl">
          Calendário de Rotina
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Acompanhe os registros diários de{' '}
          <span className="font-medium text-charcoal">{link.patients?.name}</span>
        </p>
      </header>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
          <p className="text-lg font-semibold text-primary">{filledCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Preenchidos</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
          <p className="text-lg font-semibold text-amber-600">{crisisCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Com crise</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
          <p className="text-lg font-semibold text-charcoal-muted">
            {daysInMonth - filledCount}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Vazios</p>
        </div>
      </div>

      {/* Calendar */}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-primary-50/40 to-mint-50/30 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-2 text-charcoal-muted hover:bg-white/80"
              aria-label="Mês anterior"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-display text-base font-semibold text-charcoal">
              {MONTHS[viewMonth - 1]} {viewYear}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-2 text-charcoal-muted hover:bg-white/80"
              aria-label="Próximo mês"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {isLoading ? (
            <CardGridSkeleton count={35} className="grid-cols-7 gap-1.5" />
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
                  const isSelected = selectedDay?.date === cell.dateKey;

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => setSelectedDay(status ?? null)}
                      disabled={!filled}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : filled
                            ? crisis
                              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300'
                              : 'border-mint/30 bg-mint-50 text-mint-dark hover:border-mint/50'
                            : isToday
                              ? 'border-primary/30 bg-primary-50/50 text-charcoal'
                              : 'border-slate-100 bg-slate-50/50 text-charcoal-muted'
                      } ${filled ? 'cursor-pointer' : 'cursor-default'}`}
                      aria-label={
                        filled
                          ? `${cell.day} - Diário preenchido${crisis ? ', crise registrada' : ''}`
                          : `${cell.day} - Sem registro`
                      }
                    >
                      <span className={`font-medium ${isToday && !isSelected ? 'text-primary' : ''}`}>
                        {cell.day}
                      </span>
                      {filled && (
                        <span className="mt-0.5 text-[10px] leading-none" aria-hidden>
                          {crisis ? '⚠️' : '✓'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
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

      {/* Day detail */}
      {selectedDay && (
        <div className="mt-4">
          <DayDetailPanel day={selectedDay} />
        </div>
      )}
    </div>
  );
}
