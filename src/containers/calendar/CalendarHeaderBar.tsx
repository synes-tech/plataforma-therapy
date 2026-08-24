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
  if (view === 'month') return 'Mês completo com as sessões de cada dia.';
  if (view === 'week') return 'Semana inteira visível — clique no dia ou no horário para agendar.';
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
  const periodLabel = calendarTitle(currentView, year, month0, weekLabel);

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
      title={periodLabel}
      desktopTitle="Agenda"
      subtitle={calendarSubtitle(currentView)}
      tabs={<CalendarViewTabs active={currentView} onChange={onViewChange} />}
      actions={
        <>
          <div className="hidden items-center gap-2 sm:flex lg:flex-nowrap">
            {showNav ? (
              <>
                <p className="hidden text-sm font-medium text-charcoal lg:block">{periodLabel}</p>
                <button
                  type="button"
                  onClick={onToday}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50"
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
              </>
            ) : null}
            <button
              type="button"
              onClick={onNewSchedule}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
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
    />
  );
}
