import { useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@containers/layout';
import { PageLoader } from '@containers/loading';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { supabase } from '@shared/lib/supabase';
import { callFunction } from '@shared/lib/api';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { AudioRecorder } from '@features/audio-recorder/AudioRecorder';
import { SessionNoteReview } from '@features/audio-recorder/SessionNoteReview';

export default function SessionContainer() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  const navigate = useNavigate();
  const reviewSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!scheduleId) return;
    void callFunction('start-schedule-session', { schedule_id: scheduleId }).catch((err) => {
      console.error('start-schedule-session failed:', err);
    });
  }, [scheduleId]);

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, diagnoses, foto_url')
        .eq('id', patientId!)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; diagnoses: string[]; foto_url: string | null };
    },
    enabled: !!patientId,
  });

  if (!patientId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F8FAF9] px-4">
        <p className="text-sm text-charcoal-muted">Paciente não encontrado.</p>
      </div>
    );
  }

  if (isLoading) {
    return <PageLoader label="Carregando sessão..." className="min-h-[50vh]" />;
  }

  const patientName = patient?.name ?? 'Paciente';

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        backButton={{
          onClick: () => (scheduleId ? navigate('/calendar') : navigate(`/patients/${patientId}`)),
          label: scheduleId ? 'Voltar para agenda' : `Voltar para ${patientName}`,
        }}
        title={
          <div className="flex items-center gap-3 sm:gap-4">
            <PatientAvatar name={patientName} fotoUrl={patient?.foto_url} size="md" />
            <div className="min-w-0">
              <h1 className="font-serif text-xl font-medium tracking-tight text-charcoal sm:text-2xl md:text-3xl">
                Gravar sessão
              </h1>
              <p className="mt-0.5 truncate text-sm text-charcoal-muted">{patientName}</p>
            </div>
          </div>
        }
        subtitle={
          <div className="space-y-2">
            <p className="max-w-2xl text-sm leading-relaxed text-charcoal-muted">
              Dite suas observações pós-consulta. A IA transcreve e gera o relatório estruturado para sua revisão.
            </p>
            {patient?.diagnoses && patient.diagnoses.length > 0 && (
              <DiagnosisChips diagnoses={patient.diagnoses} max={4} />
            )}
          </div>
        }
      />

      <div className="mt-6 space-y-8 pb-8 lg:mt-8 lg:pb-10">
        <section aria-labelledby="session-recorder-title">
          <AudioRecorder
            patientId={patientId}
            scheduleId={scheduleId ?? undefined}
            recordingType="post_session"
            onComplete={() => {
              reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </section>

        <section ref={reviewSectionRef} aria-labelledby="session-review-title">
          <SessionNoteReview patientId={patientId} />
        </section>
      </div>
    </div>
  );
}
