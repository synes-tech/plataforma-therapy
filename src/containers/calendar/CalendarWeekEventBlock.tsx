import type { LayoutedWeekEvent } from './calendar-week.types';
import { durationToHeightPx, minutesToTopPx } from './calendar-week.utils';

const STATUS_STYLES: Record<string, { bg: string; border: string }> = {
  scheduled: { bg: 'bg-blue-100/90', border: 'border-blue-500' },
  completed: { bg: 'bg-emerald-100/90', border: 'border-emerald-500' },
  canceled: { bg: 'bg-slate-100/90', border: 'border-slate-400' },
  cancelled: { bg: 'bg-slate-100/90', border: 'border-slate-400' },
  no_show: { bg: 'bg-amber-100/90', border: 'border-amber-500' },
};

interface CalendarWeekEventBlockProps {
  event: LayoutedWeekEvent;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function CalendarWeekEventBlock({ event, onClick }: CalendarWeekEventBlockProps) {
  const top = minutesToTopPx(event.startMinutes);
  const height = Math.max(durationToHeightPx(event.endMinutes - event.startMinutes), 28);
  const widthPct = 100 / event.totalColumns;
  const leftPct = event.column * widthPct;
  const style = STATUS_STYLES[event.status] ?? STATUS_STYLES.scheduled!;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute z-10 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left shadow-sm transition-shadow hover:shadow-md ${style.bg} ${style.border}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      <p className="truncate text-xs font-semibold text-charcoal">{event.patientName}</p>
      <p className="truncate text-[10px] text-charcoal-muted">{event.timeLabel}</p>
    </button>
  );
}
