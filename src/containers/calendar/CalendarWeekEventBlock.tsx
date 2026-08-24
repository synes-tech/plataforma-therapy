import type { LayoutedWeekEvent } from './calendar-week.types';
import { durationToHeightPx, minutesToTopPx } from './calendar-week.utils';

const STATUS_STYLES: Record<string, { bg: string; bar: string; text: string; muted: string; strike?: boolean }> = {
  scheduled: { bg: 'bg-primary-50', bar: 'bg-primary', text: 'text-charcoal', muted: 'text-charcoal-muted' },
  completed: { bg: 'bg-emerald-50', bar: 'bg-mint', text: 'text-emerald-950', muted: 'text-emerald-800/70' },
  canceled: { bg: 'bg-slate-100', bar: 'bg-slate-400', text: 'text-slate-600', muted: 'text-slate-500', strike: true },
  cancelled: { bg: 'bg-slate-100', bar: 'bg-slate-400', text: 'text-slate-600', muted: 'text-slate-500', strike: true },
  no_show: { bg: 'bg-amber-50', bar: 'bg-alert', text: 'text-amber-950', muted: 'text-amber-800/70' },
};

interface CalendarWeekEventBlockProps {
  event: LayoutedWeekEvent;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function CalendarWeekEventBlock({ event, onClick }: CalendarWeekEventBlockProps) {
  const top = minutesToTopPx(event.startMinutes);
  const height = Math.max(durationToHeightPx(event.endMinutes - event.startMinutes), 22);
  const widthPct = 100 / event.totalColumns;
  const leftPct = event.column * widthPct;
  const style = STATUS_STYLES[event.status] ?? STATUS_STYLES.scheduled!;
  const compact = height < 36;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${event.patientName} · ${event.timeLabel}`}
      data-week-event=""
      className={`absolute z-10 overflow-hidden rounded-md text-left transition-colors hover:brightness-[0.97] ${style.bg}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
      }}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${style.bar}`} aria-hidden />
      <span className={`block h-full pl-2 pr-1.5 ${compact ? 'py-0.5' : 'py-1'}`}>
        <p className={`truncate text-[11px] font-semibold leading-tight ${style.text} ${style.strike ? 'line-through' : ''}`}>
          {event.patientName}
        </p>
        {height >= 32 ? (
          <p className={`truncate text-[10px] leading-tight ${style.muted}`}>{event.timeLabel}</p>
        ) : null}
      </span>
    </button>
  );
}
