import { FamilyDiaryAudioPlay } from './FamilyDiaryAudioPlay';

interface DiaryEntry {
  id: string;
  entry_date: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[];
  notes: string | null;
  transcricao?: string | null;
  audio_note_url?: string | null;
}

interface Props {
  entries: DiaryEntry[];
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😐',
  3: '🙂',
  4: '😊',
  5: '😁',
};

export function DiaryOverview({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center">
        <p className="text-xs text-charcoal-muted">Sem entradas de diário nos últimos 14 dias.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
        Diário Familiar
      </h3>
      <p className="mt-0.5 text-[10px] text-charcoal-muted/60">Últimos 14 dias</p>

      <div className="mt-4 space-y-2">
        {entries.slice(0, 7).map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              entry.crisis_occurred ? 'bg-error-light/30' : 'bg-slate-50/50'
            }`}
          >
            <span className="text-base">{MOOD_EMOJI[entry.mood_score] ?? '🙂'}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-charcoal">
                  {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: 'short',
                  })}
                </span>
                {entry.crisis_occurred && (
                  <span className="rounded bg-error/10 px-1.5 py-0.5 text-[9px] font-medium text-error">
                    Crise {entry.crisis_level}
                  </span>
                )}
              </div>
              {(entry.transcricao || entry.notes) && (
                <p className="mt-0.5 text-[10px] text-charcoal-muted">
                  {(entry.transcricao ?? entry.notes)!.slice(0, 80)}
                  {(entry.transcricao ?? entry.notes)!.length > 80 ? '...' : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {entry.audio_note_url && (
                <FamilyDiaryAudioPlay storagePath={entry.audio_note_url} />
              )}
              <div className="flex flex-col items-end gap-0.5 text-[10px] text-charcoal-muted">
              <span>💤 {entry.sleep_quality}/5</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
