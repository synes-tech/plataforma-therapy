import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SkeletonBlock } from '@containers/loading';
import { callFunction } from '@shared/lib/api';

interface CrisisCalendarDay {
  date: string;
  filled: boolean;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[];
  notes: string | null;
  family_member_id: string;
}

interface CrisisCalendarSummary {
  total_entries: number;
  crisis_count: number;
  fill_rate: number;
}

interface CrisisCalendarResponse {
  patient_id: string;
  year: number;
  month: number;
  days: CrisisCalendarDay[];
  summary: CrisisCalendarSummary;
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

const SLEEP_LABELS: Record<number, string> = {
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Ótimo',
};

const CATEGORY_LABELS: Record<string, string> = {
  sono: 'Sono',
  escola: 'Escola',
  alimentacao: 'Alimentação',
  social: 'Social',
  hiperatividade: 'Agitação',
  sensorial: 'Sensorial',
};

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function DayDetail({ day }: { day: CrisisCalendarDay }) {
  const mood = MOOD_LABELS[day.mood_score];
  const sleep = SLEEP_LABELS[day.sleep_quality];
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(day.date + 'T12:00:00'));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium capitalize text-charcoal">{dateFormatted}</p>
        {day.crisis_occurred && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Crise nível {day.crisis_level}/5
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Humor</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-charcoal">
            <span>{mood?.emoji}</span> {mood?.label}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Sono</p>
          <p className="mt-1 text-sm font-medium text-charcoal">{sleep}</p>
        </div>
        {day.crisis_occurred && day.crisis_level && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Intensidade</p>
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-4 rounded-sm ${
                    i < day.crisis_level! ? 'bg-amber-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
        {day.categories.length > 0 && (
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Áreas</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {day.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {day.notes && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/70">Observações da família</p>
          <p className="mt-1 text-sm text-charcoal">{day.notes}</p>
        </div>
      )}
    </div>
  );
}

interface PatientCrisisControlTabProps {
  patientId: string;
}

export function PatientCrisisControlTab({ patientId }: PatientCrisisControlTabProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<CrisisCalendarDay | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
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

  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const summary = data?.summary;
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  return (
    <div className="space-y-6">
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

      {/* Summary row */}
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

      {/* Calendar */}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-amber-50/20 px-5 py-4">
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
          <h3 className="font-display text-base font-semibold text-charcoal">
            {MONTHS[viewMonth - 1]} {viewYear}
          </h3>
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

        <div className="p-5">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <SkeletonBlock key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-charcoal-muted">
              Calendário indisponível no momento.
            </p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted/70">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
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
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : filled
                            ? crisis
                              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:shadow-sm'
                              : 'border-mint/30 bg-mint-50 text-mint-dark hover:border-mint/50 hover:shadow-sm'
                            : isToday
                              ? 'border-primary/30 bg-primary-50/50 text-charcoal'
                              : 'border-slate-100 bg-slate-50/50 text-charcoal-muted'
                      } ${filled ? 'cursor-pointer' : 'cursor-default'}`}
                      aria-label={
                        filled
                          ? `Dia ${cell.day} - Check-in realizado${crisis ? ', crise registrada' : ''}`
                          : `Dia ${cell.day} - Sem registro`
                      }
                    >
                      <span className={`font-medium ${isToday && !isSelected ? 'text-primary' : ''}`}>
                        {cell.day}
                      </span>
                      {filled && (
                        <span className="mt-0.5 text-[9px] leading-none" aria-hidden>
                          {crisis ? '⚠️' : '✓'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-charcoal-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-mint/30 bg-mint-50" /> Preenchido
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-amber-200 bg-amber-50" /> Com crise
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-slate-100 bg-slate-50/50" /> Sem registro
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Day detail */}
      {selectedDay && <DayDetail day={selectedDay} />}

      {/* Empty state */}
      {!isLoading && (data?.days?.length ?? 0) === 0 && (
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
