import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayDetail } from '@features/calendar/DayDetail';
import { formatDayTitle } from './calendar-month.utils';

interface CalendarDayPatientsDrawerProps {
  dateISO: string | null;
  onClose: () => void;
  onNewSchedule: (dateISO: string) => void;
  onRescheduled?: () => void;
}

export function CalendarDayPatientsDrawer({
  dateISO,
  onClose,
  onNewSchedule,
  onRescheduled,
}: CalendarDayPatientsDrawerProps) {
  const isOpen = !!dateISO;

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !dateISO) return null;

  const title = formatDayTitle(dateISO);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar painel"
        className="fixed inset-0 z-40 bg-charcoal/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-charcoal-muted">Pacientes do dia</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-charcoal">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-charcoal-muted hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DayDetail date={dateISO} onRescheduled={onRescheduled} />
        </div>

        <footer className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={() => {
              onNewSchedule(dateISO);
              onClose();
            }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo agendamento
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
