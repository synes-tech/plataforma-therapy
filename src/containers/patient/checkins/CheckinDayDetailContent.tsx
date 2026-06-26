import { useId } from 'react';
import { FamilyDiaryAudioPlay } from '@features/patient-record/FamilyDiaryAudioPlay';
import {
  CATEGORY_LABELS,
  MOOD_LABELS,
  SLEEP_LABELS,
  type CrisisCalendarDay,
} from './checkins-calendar.types';
import { formatCheckinDateLong, getCheckinTextDetails } from './checkins-calendar.utils';
import { CheckinScrollableText } from './CheckinScrollableText';

interface CheckinDayDetailContentProps {
  day: CrisisCalendarDay;
  /** Oculta cabeçalho de data quando o card pai já exibe. */
  hideDateHeader?: boolean;
}

export function CheckinDayDetailContent({ day, hideDateHeader = false }: CheckinDayDetailContentProps) {
  const mood = MOOD_LABELS[day.mood_score];
  const sleep = SLEEP_LABELS[day.sleep_quality];
  const textDetails = getCheckinTextDetails(day);
  const detailsId = useId();

  return (
    <div className="space-y-5">
      {!hideDateHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium capitalize text-charcoal">{formatCheckinDateLong(day.date)}</p>
          {day.crisis_occurred && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Crise nível {day.crisis_level}/5
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">Humor</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-charcoal">
            <span>{mood?.emoji}</span> {mood?.label}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">Sono</p>
          <p className="mt-1.5 text-sm font-medium text-charcoal">{sleep}</p>
        </div>
        {day.crisis_occurred && day.crisis_level && (
          <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">Intensidade</p>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-4 rounded-sm ${
                    i < day.crisis_level! ? 'bg-amber-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
        {day.categories.length > 0 && (
          <div className="col-span-2 min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">Áreas</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {day.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div id={detailsId} className="space-y-3">
        {textDetails.length > 0 ? (
          textDetails.map((detail) => (
            <div
              key={detail.kind}
              className="min-w-0 rounded-xl border border-slate-100 bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">
                  {detail.label}
                </p>
                {detail.kind === 'transcricao' && day.audio_note_url ? (
                  <FamilyDiaryAudioPlay storagePath={day.audio_note_url} />
                ) : null}
              </div>
              <div className="mt-2">
                <CheckinScrollableText text={detail.text} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">
              Observações da família
            </p>
            <p className="mt-2 text-sm italic text-charcoal-muted">
              Nenhuma observação escrita neste check-in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
