import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { AudioRecorder } from '@features/audio-recorder/AudioRecorder';
import { SessionNoteReview } from '@features/audio-recorder/SessionNoteReview';

export default function SessionContainer() {
  const { patientId } = useParams<{ patientId: string }>();

  // Subscribe to ai_jobs Realtime to know when processing completes
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
            // Trigger refetch of session notes
            window.dispatchEvent(new CustomEvent('ai-job-complete', { detail: payload.new }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  // Get patient name
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

  return (
    <div className="min-h-dvh bg-surface p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text">
          Sessão — {patient?.name ?? 'Carregando...'}
        </h1>
        {patient?.diagnoses && (
          <p className="mt-1 text-xs text-text-muted">
            {patient.diagnoses.join(' • ')}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Audio Recorder */}
        <section>
          <AudioRecorder
            patientId={patientId}
            recordingType="post_session"
            onComplete={(jobId) => {
              console.log('Job initiated:', jobId);
            }}
          />
        </section>

        {/* Right: Session Notes Review */}
        <section>
          <SessionNoteReview patientId={patientId} />
        </section>
      </div>
    </div>
  );
}
