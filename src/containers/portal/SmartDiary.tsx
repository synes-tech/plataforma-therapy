import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton, PageLoader } from '@containers/loading';
import { supabase } from '@shared/lib/supabase';
import { callFunction } from '@shared/lib/api';
import { usePortalContext } from '@shared/lib/portal-context';
import {
  MOOD_EMOJIS,
  SLEEP_LEVELS,
  buildDiarySubmission,
  canSubmitDiary,
  chipsForContext,
  type DiaryFormState,
  type SelfDiaryDraft,
} from '@shared/lib/portal-diary';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { FamilyDiaryAudioRecorder } from './FamilyDiaryAudioRecorder';
import { FamilyAudioCheckinModal } from './FamilyAudioCheckinModal';
import type { FamilyAudioCheckinDraft } from './family-audio-checkin.types';
import { ManualCheckinDivider } from './ManualCheckinDivider';
import { RoutineDiaryEntryDateField } from './RoutineDiaryEntryDateField';
import { RoutineDiaryTodayList } from './RoutineDiaryTodayList';
import { SelfReportFields } from './diary/SelfReportFields';
import {
  formatEntryDateLong,
  isTodayEntryDate,
  isValidEntryDateKey,
  todayEntryDateKey,
  type RoutineDiaryEntry,
} from './routine-diary.utils';

const EMPTY_SELF_DRAFT: SelfDiaryDraft = { mood10: 5, anxiety10: 5, triggers: '' };

function resolveInitialEntryDate(dateParam: string | null): string {
  if (dateParam && isValidEntryDateKey(dateParam)) return dateParam;
  return todayEntryDateKey();
}

export default function SmartDiary() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: portal, isLoading } = usePortalContext();

  const mode = portal?.access.level ?? 'CAREGIVER';
  const selfMode = mode === 'SELF';

  const [selectedEntryDate, setSelectedEntryDate] = useState(() =>
    resolveInitialEntryDate(searchParams.get('date')),
  );
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [crisisOccurred, setCrisisOccurred] = useState(false);
  const [crisisLevel, setCrisisLevel] = useState(3);
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [selfDraft, setSelfDraft] = useState<SelfDiaryDraft>(EMPTY_SELF_DRAFT);
  const [audioCheckinDraft, setAudioCheckinDraft] = useState<FamilyAudioCheckinDraft | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formState: DiaryFormState = {
    mode,
    mood,
    sleep,
    crisisOccurred,
    crisisLevel,
    categories,
    notes,
    self: selfDraft,
  };

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && isValidEntryDateKey(dateParam) && dateParam !== selectedEntryDate) {
      setSelectedEntryDate(dateParam);
    }
  }, [searchParams, selectedEntryDate]);

  function handleEntryDateChange(nextDate: string) {
    setSelectedEntryDate(nextDate);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (nextDate === todayEntryDateKey()) {
          params.delete('date');
        } else {
          params.set('date', nextDate);
        }
        return params;
      },
      { replace: true },
    );
  }

  const patientId = portal?.patient.id;

  const { data: dayEntries = [], isLoading: dayEntriesLoading } = useQuery({
    queryKey: ['diary-entries-by-date', patientId, selectedEntryDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('id, mood_score, sleep_quality, crisis_occurred, crisis_level, notes, created_at')
        .eq('patient_id', patientId!)
        .eq('entry_date', selectedEntryDate)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as RoutineDiaryEntry[];
    },
    enabled: Boolean(patientId),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const submission = buildDiarySubmission(formState);
      if (!submission) throw new Error('Preencha os campos obrigatórios antes de registrar.');
      return callFunction('submit-diary', {
        patient_id: patientId!,
        entry_date: selectedEntryDate,
        ...submission,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diary-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['diary-entries-by-date'] });
      void queryClient.invalidateQueries({ queryKey: ['family-calendar'] });
      clearFormFields();
      setSuccessMessage('Check-in registrado com sucesso!');
      window.setTimeout(() => setSuccessMessage(null), 3500);
    },
  });

  const headerDateLabel = useMemo(
    () => (isTodayEntryDate(selectedEntryDate) ? 'Hoje' : formatEntryDateLong(selectedEntryDate)),
    [selectedEntryDate],
  );

  if (isLoading) {
    return <PageLoader minHeight="screen" label="Carregando diário..." />;
  }

  if (!portal) {
    return <Navigate to="/portal/link" replace />;
  }

  function toggleCategory(id: string) {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmitDiary(formState)) return;
    mutation.mutate();
  }

  function clearFormFields() {
    setMood(null);
    setSleep(null);
    setCrisisOccurred(false);
    setCrisisLevel(3);
    setCategories([]);
    setNotes('');
    setSelfDraft(EMPTY_SELF_DRAFT);
    setAudioCheckinDraft(null);
  }

  function handleAudioCheckinSuccess() {
    setAudioCheckinDraft(null);
    clearFormFields();
    void queryClient.invalidateQueries({ queryKey: ['diary-entries'] });
    void queryClient.invalidateQueries({ queryKey: ['diary-entries-by-date'] });
    void queryClient.invalidateQueries({ queryKey: ['family-calendar'] });
    setSuccessMessage('Check-in registrado com sucesso!');
    window.setTimeout(() => setSuccessMessage(null), 3500);
  }

  return (
    <div className="animate-fade-in w-full">
      <PushNotificationPrompt />

      {successMessage ? (
        <div
          className="mb-5 flex items-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-medium text-mint-dark"
          role="status"
          aria-live="polite"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      ) : null}

      <header className="mb-6 lg:mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-primary capitalize">{headerDateLabel}</p>
        <h1 className="mt-1 font-serif text-2xl tracking-tight text-charcoal lg:text-3xl">
          {selfMode ? 'Meu dia' : 'Diário de Rotina'}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-charcoal-muted lg:text-base">
          {selfMode ? (
            <>
              Registre como você está agora. Pode registrar quantas vezes quiser no mesmo dia —
              um dia raramente cabe em um só momento.
            </>
          ) : (
            <>
              Registre momentos do dia de{' '}
              <span className="font-medium text-charcoal">{portal.patient.first_name}</span>. Vários
              check-ins no mesmo dia são permitidos — inclusive mais de uma crise.
            </>
          )}
        </p>
      </header>

      <RoutineDiaryEntryDateField
        value={selectedEntryDate}
        onChange={handleEntryDateChange}
        disabled={mutation.isPending || audioCheckinDraft !== null}
      />

      <div className="mt-5">
        <RoutineDiaryTodayList
          entryDate={selectedEntryDate}
          entries={dayEntries}
          isLoading={dayEntriesLoading}
        />
      </div>

      {/* O áudio é o caminho de menor fricção nos dois modos e não muda com o perfil. */}
      <div className="mt-5">
        <FamilyDiaryAudioRecorder
          patientId={portal.patient.id}
          disabled={mutation.isPending || audioCheckinDraft !== null}
          prominent
          onTranscriptionReady={({ transcricao, audioUrl, durationSeconds }) => {
            setAudioCheckinDraft({
              entryDate: selectedEntryDate,
              transcricao,
              audioUrl,
              durationSeconds,
            });
          }}
        />
      </div>

      <FamilyAudioCheckinModal
        patientId={portal.patient.id}
        draft={audioCheckinDraft}
        onClose={() => setAudioCheckinDraft(null)}
        onSuccess={handleAudioCheckinSuccess}
      />

      <ManualCheckinDivider />

      <form onSubmit={handleSubmit} className="mt-5 w-full space-y-5 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6 lg:space-y-0">
        {mutation.error && (
          <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error lg:col-span-2 xl:col-span-3">
            {mutation.error instanceof Error ? mutation.error.message : 'Erro ao enviar'}
          </div>
        )}

        {selfMode ? (
          <SelfReportFields
            value={selfDraft}
            onChange={(patch) => setSelfDraft((current) => ({ ...current, ...patch }))}
            disabled={mutation.isPending}
          />
        ) : (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
            <h4 className="mb-3 text-sm font-medium text-charcoal">Humor neste momento</h4>
            <div className="flex justify-between gap-1.5">
              {MOOD_EMOJIS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-all ${
                    mood === m.value ? 'bg-primary/10 ring-2 ring-primary' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                  aria-label={m.label}
                  aria-pressed={mood === m.value}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-charcoal-muted">{m.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <h4 className="mb-3 text-sm font-medium text-charcoal">
            {selfMode ? 'Como você dormiu?' : 'Qualidade do sono'}
          </h4>
          <div className="flex gap-1.5">
            {SLEEP_LEVELS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSleep(s.value)}
                className={`flex-1 rounded-lg py-2 text-xs transition-all ${
                  sleep === s.value
                    ? 'bg-primary/10 font-medium text-primary ring-2 ring-primary'
                    : 'bg-slate-50 text-charcoal-muted hover:bg-slate-100'
                }`}
                aria-pressed={sleep === s.value}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-charcoal">
              {selfMode ? 'Passou por uma crise?' : 'Houve crise neste momento?'}
            </h4>
            <button
              type="button"
              role="switch"
              aria-checked={crisisOccurred}
              onClick={() => setCrisisOccurred(!crisisOccurred)}
              className={`relative h-6 w-11 rounded-full transition-colors ${crisisOccurred ? 'bg-alert' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  crisisOccurred ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
          {crisisOccurred && (
            <div className="mt-4">
              <label className="mb-2 block text-xs text-charcoal-muted">
                Intensidade: <strong className="text-alert">{crisisLevel}</strong>/5
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={crisisLevel}
                onChange={(e) => setCrisisLevel(Number(e.target.value))}
                className="w-full accent-alert"
                aria-label="Intensidade da crise"
              />
              <div className="mt-1 flex justify-between text-[10px] text-charcoal-muted/70">
                <span>Leve</span>
                <span>Severa</span>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <h4 className="mb-3 text-sm font-medium text-charcoal">
            {selfMode ? 'O que pesou hoje?' : 'Áreas relevantes'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {chipsForContext(mode, portal.patient.profile_type).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-all ${
                  categories.includes(cat.id)
                    ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/40'
                    : 'bg-slate-50 text-charcoal-muted hover:bg-slate-100'
                }`}
                aria-pressed={categories.includes(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft lg:col-span-2 xl:col-span-3">
          <h4 className="mb-2 text-sm font-medium text-charcoal">Observações (opcional)</h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={
              selfMode
                ? 'Se quiser, escreva com suas palavras como foi...'
                : 'Descreva o que aconteceu neste momento...'
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
          <p className="mt-1 text-right text-[10px] text-charcoal-muted/60">{notes.length}/1000</p>
        </section>

        <LoadingButton
          type="submit"
          variant="dark"
          fullWidth
          loading={mutation.isPending}
          loadingLabel="Salvando..."
          disabled={!canSubmitDiary(formState)}
          className="h-12 lg:col-span-2 xl:col-span-3 lg:max-w-xs"
        >
          {selfMode ? 'Registrar como estou' : 'Registrar momento'}
        </LoadingButton>
      </form>
    </div>
  );
}
