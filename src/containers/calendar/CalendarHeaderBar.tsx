import { PageHeader } from '@containers/layout';
import { MobileActionsMenu } from '@shared/ui/MobileActionsMenu';
import { CalendarViewTabs } from './CalendarViewTabs';
import type { CalendarView } from './calendar-view.types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function calendarTitle(view: CalendarView, year: number, month0: number, weekLabel?: string): string {
  if (view === 'month') return `${MONTHS[month0]} ${year}`;
  if (view === 'week') return weekLabel ?? 'Semana';
  return 'Sua agenda';
}

function calendarSubtitle(view: CalendarView): string {
  if (view === 'month') return 'Visão mensal com sessões e agendamentos.';
  if (view === 'week') return 'Grade semanal por horário — domingo a sábado.';
  return 'Gerencie consultas e visualize sua rotina clínica.';
}

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
  const showNav = currentView === 'month' || currentView === 'week';

  const mobileActions = [
    ...(showNav
      ? [
          { id: 'today', label: 'Hoje', onClick: onToday },
          {
            id: 'prev',
            label: currentView === 'week' ? 'Semana anterior' : 'Mês anterior',
            onClick: onPrev,
          },
          {
            id: 'next',
            label: currentView === 'week' ? 'Próxima semana' : 'Próximo mês',
            onClick: onNext,
          },
        ]
      : []),
    {
      id: 'schedule',
      label: 'Realizar Agendamento',
      onClick: onNewSchedule,
      variant: 'primary' as const,
    },
  ];

  return (
    <PageHeader
      title={calendarTitle(currentView, year, month0, weekLabel)}
      subtitle={calendarSubtitle(currentView)}
      actions={
        <>
          <div className="hidden w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {showNav && (
              <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={onNewSchedule}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] sm:w-auto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Realizar Agendamento
            </button>
          </div>

          <MobileActionsMenu items={mobileActions} className="w-full sm:hidden" />
        </>
      }
      tabs={<CalendarViewTabs active={currentView} onChange={onViewChange} />}
    />
  );
}
