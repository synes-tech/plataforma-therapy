import { forwardRef, useId } from 'react';
import { MOOD_LABELS, type CrisisCalendarDay } from './checkins-calendar.types';
import { buildCheckinPreview, formatCheckinDateLong } from './checkins-calendar.utils';
import { CheckinDayDetailContent } from './CheckinDayDetailContent';

interface CheckinDayAccordionCardProps {
  day: CrisisCalendarDay;
  expanded: boolean;
  onToggle: () => void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-charcoal-muted transition-transform duration-200 ${
        expanded ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export const CheckinDayAccordionCard = forwardRef<HTMLDivElement, CheckinDayAccordionCardProps>(
  function CheckinDayAccordionCard({ day, expanded, onToggle }, ref) {
  const panelId = useId();
  const mood = MOOD_LABELS[day.mood_score];
  const preview = buildCheckinPreview(day);
  const dateLabel = formatCheckinDateLong(day.date);

  return (
    <article
      ref={ref}
      className={`min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        day.crisis_occurred ? 'border-amber-200' : 'border-slate-100'
      } ${expanded ? 'ring-2 ring-primary/15' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl"
          aria-hidden
        >
          {mood?.emoji ?? '📝'}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold capitalize text-charcoal">{dateLabel}</span>
            {day.crisis_occurred && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Crise
              </span>
            )}
          </span>
          <span className="mt-1 block break-words text-xs leading-relaxed text-charcoal-muted line-clamp-2">
            {preview}
          </span>
        </span>

        <ChevronIcon expanded={expanded} />
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain border-t border-slate-100 px-4 py-4 scrollbar-thin">
            <CheckinDayDetailContent day={day} hideDateHeader />
          </div>
        </div>
      </div>
    </article>
  );
},
);
