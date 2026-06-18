import { useState, useMemo, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';

interface Patient {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  status: string;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-filled date (YYYY-MM-DD) from the calendar click */
  defaultDate: string;
}

export function NewScheduleModal({ isOpen, onClose, defaultDate }: Props) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(50);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch patients for the dropdown
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => callFunction<Patient[]>('list-patients', {}),
    enabled: isOpen,
  });

  // Filtered list based on search
  const filtered = useMemo(() => {
    if (!patients) return [];
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, search]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Build ISO datetime in BR timezone
      const iso = `${defaultDate}T${time}:00-03:00`;
      const scheduledAt = new Date(iso).toISOString();

      return callFunction('create-schedule', {
        patient_id: patientId,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['range-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['list-sessions'] });
      resetAndClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function resetAndClose() {
    setPatientId('');
    setSearch('');
    setTime('09:00');
    setDuration(50);
    setNotes('');
    setError(null);
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError('Selecione um paciente.');
      return;
    }
    setError(null);
    createMutation.mutate();
  }

  const selectedPatient = patients?.find((p) => p.id === patientId);

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Novo agendamento"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={resetAndClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="new-schedule-form"
            disabled={createMutation.isPending || !patientId}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-charcoal px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:opacity-50"
          >
            {createMutation.isPending ? 'Salvando...' : 'Agendar'}
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error-light/50 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <form id="new-schedule-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Date display (read-only from click) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal">Data</label>
          <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-charcoal">
            {formatDateDisplay(defaultDate)}
          </div>
        </div>

        {/* Patient Search/Select */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal">Paciente *</label>

          {/* If patient already selected, show it */}
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary-50/30 px-4 py-2.5">
              <span className="text-sm font-medium text-charcoal">{selectedPatient.name}</span>
              <button
                type="button"
                onClick={() => { setPatientId(''); setSearch(''); }}
                className="text-xs text-charcoal-muted hover:text-error"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente por nome..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              {/* Dropdown results */}
              {search.trim() && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
                  {patientsLoading ? (
                    <div className="px-4 py-3 text-sm text-charcoal-muted">Carregando...</div>
                  ) : filtered.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-charcoal-muted">Nenhum paciente encontrado</div>
                  ) : (
                    filtered.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPatientId(p.id); setSearch(''); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700">
                          {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-charcoal">{p.name}</p>
                          <p className="text-[10px] text-charcoal-muted">{p.diagnoses.join(', ')}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Show all patients if search is empty but input is focused — first few */}
              {!search.trim() && patients && patients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {patients.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPatientId(p.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-charcoal-muted transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      {p.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Time + Duration row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal">Horário *</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal">Duração (min)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            >
              <option value={30}>30 min</option>
              <option value={40}>40 min</option>
              <option value={50}>50 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal">Observações (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Informações adicionais sobre o atendimento..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>
      </form>
    </StandardModal>
  );
}

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(date);
}
