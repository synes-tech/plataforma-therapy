import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { AudioRecorder } from '@features/audio-recorder/AudioRecorder';
import { SessionNoteReview } from '@features/audio-recorder/SessionNoteReview';
import { SessionHistoryPanel } from './session/SessionHistoryPanel';

export default function SessionContainer() {
  const { patientId } = useParams<{ patientId: string }>();

  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`ai-jobs-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_jobs',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          if (payload.new.status === 'completed') {
            window.dispatchEvent(new CustomEvent('ai-job-complete', { detail: payload.new }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  const { data: patient } = useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, diagnoses')
        .eq('id', patientId!)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; diagnoses: string[] };
    },
    enabled: !!patientId,
  });

  if (!patientId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-text-muted">Paciente não encontrado</p>
      </div>
    );
  }

  const patientName = patient?.name ?? 'Paciente';

  return (
    <div className="min-h-dvh bg-surface p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="font-display text-xl font-semibold text-charcoal">
          Central de Sessão — {patientName}
        </h1>
        {patient?.diagnoses && patient.diagnoses.length > 0 && (
          <p className="mt-1 text-xs text-charcoal-muted">
            {patient.diagnoses.join(' • ')}
          </p>
        )}
        <p className="mt-2 max-w-2xl text-sm text-charcoal-muted">
          Grave o ditado pós-consulta, revise relatórios pendentes e consulte o histórico completo.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <AudioRecorder
            patientId={patientId}
            recordingType="post_session"
            onComplete={() => {
              /* realtime + SessionHistoryPanel refetch */
            }}
          />
        </section>

        <section>
          <SessionNoteReview patientId={patientId} />
        </section>
      </div>

      <div className="mt-8 border-t border-slate-200/80 pt-8">
        <SessionHistoryPanel patientId={patientId} patientName={patientName} />
      </div>
    </div>
  );
}
