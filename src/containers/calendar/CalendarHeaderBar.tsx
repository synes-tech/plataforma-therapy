import { CalendarViewTabs } from './CalendarViewTabs';
import type { CalendarView } from './calendar-view.types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface CalendarHeaderBarProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  year: number;
  month0: number;
  weekLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewSchedule: () => void;
}

export function CalendarHeaderBar({
  currentView,
  onViewChange,
  year,
  month0,
  weekLabel,
  onPrev,
  onNext,
  onToday,
  onNewSchedule,
}: CalendarHeaderBarProps) {
  return (
    <header className="mb-6 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-charcoal-muted/80">Agenda</p>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
            {currentView === 'month' && `${MONTHS[month0]} ${year}`}
            {currentView === 'week' && (weekLabel ?? 'Semana')}
            {currentView === 'list' && 'Sua agenda'}
          </h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {currentView === 'month' && 'Visão mensal com sessões e agendamentos.'}
            {currentView === 'week' && 'Grade semanal por horário — domingo a sábado.'}
            {currentView === 'list' && 'Gerencie consultas e visualize sua rotina clínica.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onNewSchedule}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] lg:w-auto"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Realizar Agendamento
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <CalendarViewTabs active={currentView} onChange={onViewChange} />

        {(currentView === 'month' || currentView === 'week') && (
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onToday}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
            >
              Hoje
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrev}
                aria-label={currentView === 'week' ? 'Semana anterior' : 'Mês anterior'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label={currentView === 'week' ? 'Próxima semana' : 'Próximo mês'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
