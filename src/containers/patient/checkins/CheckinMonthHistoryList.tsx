import { useEffect, useRef } from 'react';
import { CheckinDayAccordionCard } from './CheckinDayAccordionCard';
import type { CrisisCalendarDay } from './checkins-calendar.types';
import { sortFilledCheckinDays } from './checkins-calendar.utils';

interface CheckinMonthHistoryListProps {
  days: CrisisCalendarDay[];
  expandedDate: string | null;
  onToggleDate: (date: string) => void;
}

export function CheckinMonthHistoryList({
  days,
  expandedDate,
  onToggleDate,
}: CheckinMonthHistoryListProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const filledDays = sortFilledCheckinDays(days);

  useEffect(() => {
    if (!expandedDate) return;
    const el = cardRefs.current.get(expandedDate);
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [expandedDate]);

  if (filledDays.length === 0) return null;

  return (
    <section className="space-y-3 sm:hidden" aria-label="Histórico de check-ins do mês">
      <div>
        <h3 className="font-display text-sm font-semibold text-charcoal">Histórico do mês</h3>
        <p className="mt-0.5 text-xs text-charcoal-muted">
          Toque em um dia para ver o detalhamento completo do check-in.
        </p>
      </div>

      <ul className="space-y-3">
        {filledDays.map((day) => (
          <li key={day.date}>
            <CheckinDayAccordionCard
              ref={(el) => {
                if (el) cardRefs.current.set(day.date, el);
                else cardRefs.current.delete(day.date);
              }}
              day={day}
              expanded={expandedDate === day.date}
              onToggle={() => onToggleDate(day.date)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
