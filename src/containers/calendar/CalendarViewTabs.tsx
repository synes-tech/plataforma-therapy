import type { CalendarView } from './calendar-view.types';

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'month', label: 'Mês' },
  { id: 'week', label: 'Semana' },
  { id: 'list', label: 'Lista' },
];

interface CalendarViewTabsProps {
  active: CalendarView;
  onChange: (view: CalendarView) => void;
}

export function CalendarViewTabs({ active, onChange }: CalendarViewTabsProps) {
  return (
    <nav className="w-full sm:w-auto" aria-label="Visualização da agenda">
      <div
        className="inline-flex w-full min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto"
        role="tablist"
      >
        {VIEWS.map((view) => {
          const isActive = active === view.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(view.id)}
              className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-initial sm:min-w-[4.5rem] ${
                isActive
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              {view.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
