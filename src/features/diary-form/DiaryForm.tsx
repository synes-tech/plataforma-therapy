import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';

interface DiaryFormProps {
  patientId: string;
}

const MOODS = [
  { value: 1, emoji: '😢', label: 'Muito ruim' },
  { value: 2, emoji: '😟', label: 'Ruim' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Bom' },
  { value: 5, emoji: '😊', label: 'Ótimo' },
];

const SLEEP_LEVELS = [
  { value: 1, label: 'Péssimo' },
  { value: 2, label: 'Ruim' },
  { value: 3, label: 'Regular' },
  { value: 4, label: 'Bom' },
  { value: 5, label: 'Ótimo' },
];

const CATEGORIES = [
  { id: 'sono', label: '🌙 Sono', color: 'bg-indigo-500/20 text-indigo-300' },
  { id: 'escola', label: '📚 Escola', color: 'bg-blue-500/20 text-blue-300' },
  { id: 'alimentacao', label: '🍎 Alimentação', color: 'bg-green-500/20 text-green-300' },
  { id: 'social', label: '👥 Social', color: 'bg-purple-500/20 text-purple-300' },
  { id: 'hiperatividade', label: '⚡ Hiperatividade', color: 'bg-amber-500/20 text-amber-300' },
  { id: 'sensorial', label: '🎧 Sensorial', color: 'bg-pink-500/20 text-pink-300' },
];

export function DiaryForm({ patientId }: DiaryFormProps) {
  const queryClient = useQueryClient();
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [crisisOccurred, setCrisisOccurred] = useState(false);
  const [crisisLevel, setCrisisLevel] = useState(3);
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      callFunction('submit-diary', {
        patient_id: patientId,
        mood_score: mood,
        sleep_quality: sleep,
        crisis_occurred: crisisOccurred,
        crisis_level: crisisOccurred ? crisisLevel : undefined,
        categories,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['diary-entries'] });
    },
  });

  function toggleCategory(id: string) {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mood || !sleep) return;
    mutation.mutate();
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
          <span className="text-3xl">✓</span>
        </div>
        <h3 className="text-lg font-medium text-text">Registrado!</h3>
        <p className="mt-2 text-sm text-text-muted">Obrigado pelo relato de hoje.</p>
        <button
          onClick={() => {
            setSuccess(false);
            setMood(null);
            setSleep(null);
            setCrisisOccurred(false);
            setCategories([]);
            setNotes('');
          }}
          className="mt-4 text-sm text-primary hover:text-primary-light"
        >
          Registrar outro dia
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error */}
      {mutation.error && (
        <div role="alert" className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro ao enviar'}
        </div>
      )}

      {/* Mood */}
      <section>
        <h4 className="mb-3 text-sm font-medium text-text">Como foi o humor hoje?</h4>
        <div className="flex justify-between gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-3 transition-all ${
                mood === m.value
                  ? 'bg-primary/20 ring-2 ring-primary'
                  : 'bg-surface-card hover:bg-surface-light'
              }`}
              aria-label={m.label}
              aria-pressed={mood === m.value}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[10px] text-text-muted">{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Sleep */}
      <section>
        <h4 className="mb-3 text-sm font-medium text-text">Qualidade do sono</h4>
        <div className="flex gap-2">
          {SLEEP_LEVELS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSleep(s.value)}
              className={`flex-1 rounded-lg py-2 text-xs transition-all ${
                sleep === s.value
                  ? 'bg-primary/20 font-medium text-primary-light ring-2 ring-primary'
                  : 'bg-surface-card text-text-muted hover:bg-surface-light'
              }`}
              aria-pressed={sleep === s.value}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Crisis */}
      <section>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-text">Houve crise hoje?</h4>
          <button
            type="button"
            role="switch"
            aria-checked={crisisOccurred}
            onClick={() => setCrisisOccurred(!crisisOccurred)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              crisisOccurred ? 'bg-accent' : 'bg-surface-border'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                crisisOccurred ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {crisisOccurred && (
          <div className="mt-3">
            <label className="mb-2 block text-xs text-text-muted">
              Intensidade da crise: <strong className="text-accent">{crisisLevel}</strong>/5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={crisisLevel}
              onChange={(e) => setCrisisLevel(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Intensidade da crise"
            />
            <div className="mt-1 flex justify-between text-[10px] text-text-muted">
              <span>Leve</span>
              <span>Severa</span>
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section>
        <h4 className="mb-3 text-sm font-medium text-text">Categorias relevantes</h4>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`rounded-full px-3 py-1.5 text-xs transition-all ${
                categories.includes(cat.id)
                  ? `${cat.color} ring-1 ring-current`
                  : 'bg-surface-card text-text-muted hover:bg-surface-light'
              }`}
              aria-pressed={categories.includes(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section>
        <h4 className="mb-2 text-sm font-medium text-text">Observações (opcional)</h4>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Algo relevante que aconteceu hoje..."
          className="w-full rounded-lg border border-surface-border bg-surface-light px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-[10px] text-text-muted">{notes.length}/1000</p>
      </section>

      {/* Submit */}
      <button
        type="submit"
        disabled={!mood || !sleep || mutation.isPending}
        className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? 'Enviando...' : 'Registrar Dia'}
      </button>
    </form>
  );
}
