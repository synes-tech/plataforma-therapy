import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { callFunction } from '@shared/lib/api';
import { RoutineMonthCalendar } from '@features/family-portal/RoutineMonthCalendar';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { FamilyDiaryAudioRecorder } from './FamilyDiaryAudioRecorder';

const MOODS = [
  { value: 1, emoji: '😢', label: 'Difícil' },
  { value: 2, emoji: '😟', label: 'Abaixo' },
  { value: 3, emoji: '😐', label: 'Neutro' },
  { value: 4, emoji: '🙂', label: 'Bom' },
  { value: 5, emoji: '😄', label: 'Ótimo' },
];

const SLEEP_LEVELS = [
  { value: 1, label: 'Péssimo' },
  { value: 2, label: 'Ruim' },
  { value: 3, label: 'Regular' },
  { value: 4, label: 'Bom' },
  { value: 5, label: 'Ótimo' },
];

const CATEGORIES = [
  { id: 'sono', label: 'Sono' },
  { id: 'escola', label: 'Escola' },
  { id: 'alimentacao', label: 'Alimentação' },
  { id: 'social', label: 'Social' },
  { id: 'hiperatividade', label: 'Agitação' },
  { id: 'sensorial', label: 'Sensorial' },
];

export default function RoutineDiary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: link, isLoading } = useQuery({
    queryKey: ['family-link', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('patient_family_links')
        .select('patient_id, patients(name)')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      return data as unknown as { patient_id: string; patients: { name: string } } | null;
    },
    enabled: !!user,
  });

  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [crisisOccurred, setCrisisOccurred] = useState(false);
  const [crisisLevel, setCrisisLevel] = useState(3);
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      callFunction('submit-diary', {
        patient_id: link!.patient_id,
        mood_score: mood,
        sleep_quality: sleep,
        crisis_occurred: crisisOccurred,
        crisis_level: crisisOccurred ? crisisLevel : undefined,
        categories,
        notes: notes || undefined,
        audio_note_url: audioUrl ?? undefined,
        transcricao: transcricao ?? undefined,
      }),
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['diary-entries'] });
      queryClient.invalidateQueries({ queryKey: ['family-calendar'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!link) {
    return <Navigate to="/family/link" replace />;
  }

  function toggleCategory(id: string) {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mood || !sleep) return;
    mutation.mutate();
  }

  function reset() {
    setSuccess(false);
    setMood(null);
    setSleep(null);
    setCrisisOccurred(false);
    setCrisisLevel(3);
    setCategories([]);
    setNotes('');
    setAudioUrl(null);
    setTranscricao(null);
  }

  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center lg:min-h-[50vh] lg:py-24">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-mint/15">
          <svg className="h-8 w-8 text-mint-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-serif text-xl text-charcoal">Registrado, obrigado!</h3>
        <p className="mt-2 max-w-xs text-sm text-charcoal-muted">
          Esse relato ajuda o terapeuta a entender melhor a rotina de {link.patients?.name?.split(' ')[0]}.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-charcoal shadow-soft transition-colors hover:bg-slate-50"
        >
          Registrar outro momento
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PushNotificationPrompt />
      <RoutineMonthCalendar />

      <header className="mb-6 lg:mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{today}</p>
        <h1 className="mt-1 font-serif text-2xl tracking-tight text-charcoal lg:text-3xl">Diário de Rotina</h1>
        <p className="mt-1 text-sm text-charcoal-muted lg:text-base">
          Como foi o dia de <span className="font-medium text-charcoal">{link.patients?.name}</span>?
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        {mutation.error && (
          <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error lg:col-span-2">
            {mutation.error instanceof Error ? mutation.error.message : 'Erro ao enviar'}
          </div>
        )}

        {/* Mood */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <h4 className="mb-3 text-sm font-medium text-charcoal">Humor predominante</h4>
          <div className="flex justify-between gap-1.5">
            {MOODS.map((m) => (
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

        {/* Sleep */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <h4 className="mb-3 text-sm font-medium text-charcoal">Qualidade do sono</h4>
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

        {/* Crisis */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-charcoal">Houve uma crise hoje?</h4>
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

        {/* Categories */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <h4 className="mb-3 text-sm font-medium text-charcoal">Áreas relevantes</h4>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
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

        <FamilyDiaryAudioRecorder
          patientId={link.patient_id}
          disabled={mutation.isPending}
          onTranscription={({ transcricao: text, audioUrl: url }) => {
            setTranscricao(text);
            setAudioUrl(url);
            setNotes(text.slice(0, 1000));
          }}
        />

        {/* Notes */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft lg:col-span-2">
          <h4 className="mb-2 text-sm font-medium text-charcoal">
            Observações {transcricao ? '(revise a transcrição)' : '(opcional)'}
          </h4>
          {transcricao && (
            <p className="mb-2 rounded-lg bg-mint/10 px-3 py-2 text-xs text-mint-dark">
              Áudio transcrito com sucesso. Ajuste o texto se necessário antes de registrar.
            </p>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Algo marcante que aconteceu hoje..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
          <p className="mt-1 text-right text-[10px] text-charcoal-muted/60">{notes.length}/1000</p>
        </section>

        <button
          type="submit"
          disabled={!mood || !sleep || mutation.isPending}
          className="h-12 w-full rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 lg:col-span-2 lg:max-w-sm"
        >
          {mutation.isPending ? 'Enviando...' : 'Registrar dia'}
        </button>
      </form>
    </div>
  );
}
