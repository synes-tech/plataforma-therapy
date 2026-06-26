import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@containers/loading';
import { CheckinDayDetailContent } from '@containers/patient/checkins/CheckinDayDetailContent';
import { StandardModal } from '@shared/ui/StandardModal';
import { supabase } from '@shared/lib/supabase';
import {
  formatFamilyCalendarModalTitle,
  mapFamilyDiaryEntryToCheckinDay,
  type FamilyDiaryEntryRow,
} from './family-calendar.utils';
import { canRegisterEntryDate, formatRoutineEntryTime } from './routine-diary.utils';

interface FamilyCalendarDayModalProps {
  patientId: string;
  date: string | null;
  onClose: () => void;
}

export function FamilyCalendarDayModal({ patientId, date, onClose }: FamilyCalendarDayModalProps) {
  const navigate = useNavigate();
  const isOpen = date !== null;
  const canRegisterAnother = date ? canRegisterEntryDate(date) : false;

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['family-calendar-day', patientId, date],
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from('diary_entries')
        .select(
          'id, entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, categories, notes, transcricao, audio_note_url, family_member_id, created_at',
        )
        .eq('patient_id', patientId)
        .eq('entry_date', date!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return (data ?? []) as FamilyDiaryEntryRow[];
    },
    enabled: isOpen,
    staleTime: 30_000,
  });

  const hasCrisis = entries.some((entry) => entry.crisis_occurred);
  const title = date ? formatFamilyCalendarModalTitle(date, hasCrisis) : 'Registro do dia';

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="2xl"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          {canRegisterAnother ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/family/diary?date=${date}`);
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 sm:w-auto"
            >
              Registrar outro momento
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-charcoal px-5 text-sm font-semibold text-white transition-colors hover:bg-charcoal-light sm:w-auto"
          >
            Fechar
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
          <Spinner size="md" />
          <p className="text-sm text-charcoal-muted">Carregando detalhes...</p>
        </div>
      ) : error ? (
        <p className="text-sm text-error" role="alert">
          {error instanceof Error ? error.message : 'Não foi possível carregar os registros deste dia.'}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-charcoal-muted">Nenhum registro encontrado para esta data.</p>
      ) : (
        <div className="space-y-6">
          {entries.map((entry, index) => {
            const checkinDay = mapFamilyDiaryEntryToCheckinDay(entry);
            const showEntryHeader = entries.length > 1;

            return (
              <div
                key={entry.id}
                className={index > 0 ? 'border-t border-slate-100 pt-6' : undefined}
              >
                {showEntryHeader ? (
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                    {entry.crisis_occurred ? 'Registro com crise' : 'Registro'} ·{' '}
                    {formatRoutineEntryTime(entry.created_at)}
                  </p>
                ) : null}
                <CheckinDayDetailContent day={checkinDay} hideDateHeader={showEntryHeader} />
              </div>
            );
          })}
        </div>
      )}
    </StandardModal>
  );
}
