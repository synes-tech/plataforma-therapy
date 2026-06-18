import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDayTitle } from './calendar-month.utils';
import { computePopoverPosition } from './calendar-day-action.utils';
import type { DayActionMenuState } from './calendar-day-action.types';

interface CalendarDayActionPopoverProps {
  menu: DayActionMenuState | null;
  onClose: () => void;
  onViewPatients: (dateISO: string) => void;
  onNewSchedule: (dateISO: string) => void;
}

export function CalendarDayActionPopover({
  menu,
  onClose,
  onViewPatients,
  onNewSchedule,
}: CalendarDayActionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!menu) return;
    const height = panelRef.current?.offsetHeight ?? 108;
    const width = panelRef.current?.offsetWidth ?? 224;
    setPosition(computePopoverPosition(menu.anchor, width, height));
  }, [menu]);

  useEffect(() => {
    if (!menu) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menu, onClose]);

  if (!menu) return null;

  const title = formatDayTitle(menu.dateISO);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        className="fixed inset-0 z-40 bg-charcoal/10 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="menu"
        aria-label={`Ações para ${title}`}
        className="fixed z-50 min-w-[14rem] rounded-xl border border-white/60 bg-white/95 p-2 shadow-lg backdrop-blur-md"
        style={{ top: position.top, left: position.left }}
      >
        <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-charcoal-muted">
          {title}
        </p>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onViewPatients(menu.dateISO);
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-charcoal-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
            </svg>
          </span>
          Ver pacientes do dia
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onNewSchedule(menu.dateISO);
            onClose();
          }}
          className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-charcoal transition-colors hover:bg-primary-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Novo agendamento
        </button>
      </div>
    </>,
    document.body,
  );
}
