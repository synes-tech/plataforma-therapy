import {
  buildRoutineEntrySummary,
  formatRoutineEntryTime,
  moodEmoji,
  pluralizeRegistros,
  type RoutineDiaryEntry,
} from './routine-diary.utils';

interface RoutineDiaryTodayListProps {
  entries: RoutineDiaryEntry[];
  isLoading?: boolean;
}

export function RoutineDiaryTodayList({ entries, isLoading }: RoutineDiaryTodayListProps) {
  if (isLoading) {
    return (
      <section className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </section>
    );
  }

  if (entries.length === 0) return null;

  return (
    <section
      className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft"
      aria-label="Registros de hoje"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-charcoal">Registros de hoje</h4>
        <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint-dark">
          {pluralizeRegistros(entries.length)}
        </span>
      </div>

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-slate-100 bg-[#F8FAF9] px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-charcoal">
                  <span aria-hidden>{moodEmoji(entry.mood_score)}</span>
                  <span>{formatRoutineEntryTime(entry.created_at)}</span>
                </p>
                <p className="mt-0.5 text-xs text-charcoal-muted">{buildRoutineEntrySummary(entry)}</p>
                {entry.notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-charcoal-muted/90">{entry.notes}</p>
                ) : null}
              </div>
              {entry.crisis_occurred ? (
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                  Crise
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
