import type { CalendarView } from './calendar-view.types';

const LABELS: Record<Exclude<CalendarView, 'month'>, string> = {
  week: 'Semana',
  list: 'Lista',
};

interface CalendarViewPlaceholderProps {
  view: Exclude<CalendarView, 'month'>;
}

export function CalendarViewPlaceholder({ view }: CalendarViewPlaceholderProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
        <svg className="h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-charcoal-muted">
        Visão {LABELS[view]} em construção...
      </p>
      <p className="mt-2 max-w-sm text-sm text-charcoal-muted/70">
        Em breve você poderá consultar e gerenciar sua agenda neste formato.
      </p>
    </div>
  );
}
