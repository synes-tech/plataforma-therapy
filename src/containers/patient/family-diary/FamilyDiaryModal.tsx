import { useNavigate } from 'react-router-dom';
import { StandardModal } from '@shared/ui/StandardModal';
import type { DiaryEntry } from '../patient-record.types';
import { buildDiaryPreview, formatDiaryDateLong } from './family-diary.format';

interface FamilyDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  entries: DiaryEntry[];
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😢',
  2: '😟',
  3: '😐',
  4: '🙂',
  5: '😄',
};

export function FamilyDiaryModal({ isOpen, onClose, patientId, entries }: FamilyDiaryModalProps) {
  const navigate = useNavigate();
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  function openCheckin(entry: DiaryEntry) {
    onClose();
    navigate(`/patients/${patientId}/checkins?date=${entry.entry_date}`);
  }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Diário familiar"
      size="xl"
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-charcoal-muted">
          Nenhum relato da família nos últimos 14 dias. Convide os responsáveis para preencher o diário de rotina.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-charcoal-muted">
            {sorted.length} relato{sorted.length !== 1 ? 's' : ''} recente{sorted.length !== 1 ? 's' : ''} enviado
            {sorted.length !== 1 ? 's' : ''} pela família.
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {sorted.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base" aria-hidden>
                      {MOOD_EMOJI[entry.mood_score] ?? '🙂'}
                    </span>
                    <p className="text-sm font-medium capitalize text-charcoal">
                      {formatDiaryDateLong(entry.entry_date)}
                    </p>
                    {entry.crisis_occurred && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        Crise {entry.crisis_level}/5
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-charcoal-muted">
                    {buildDiaryPreview(entry)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCheckin(entry)}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/5 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:w-auto"
                >
                  Ver em Check-ins
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StandardModal>
  );
}
