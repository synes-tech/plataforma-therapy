import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StandardModal } from '@shared/ui/StandardModal';
import { CheckinDayDetailContent } from './CheckinDayDetailContent';
import type { CrisisCalendarDay } from './checkins-calendar.types';
import { formatCheckinDateLong } from './checkins-calendar.utils';

interface CheckinDayReadModalProps {
  day: CrisisCalendarDay | null;
  onClose: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

/** Mobile: StandardModal (bottom sheet). Desktop: modal médio centralizado. */
export function CheckinDayReadModal({ day, onClose }: CheckinDayReadModalProps) {
  const isOpen = day !== null;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title={day ? `Check-in — ${formatCheckinDateLong(day.date)}` : 'Check-in'}
        size="xl"
      >
        {day ? <CheckinDayDetailContent day={day} /> : null}
      </StandardModal>
    );
  }

  return <CheckinDayReadModalDesktop day={day} isOpen={isOpen} onClose={onClose} />;
}

function CheckinDayReadModalDesktop({
  day,
  isOpen,
  onClose,
}: {
  day: CrisisCalendarDay | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen || !day) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 hidden animate-fade-in bg-slate-900/45 p-4 backdrop-blur-sm md:flex md:items-center md:justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id={titleId} className="font-serif text-lg font-medium tracking-tight text-charcoal">
            Check-in — {formatCheckinDateLong(day.date)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-charcoal-muted/70 transition-colors hover:bg-slate-100 hover:text-charcoal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <CheckinDayDetailContent day={day} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
