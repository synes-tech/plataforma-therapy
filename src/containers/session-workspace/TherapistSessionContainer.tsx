import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { TherapistCopilotGate, type PatientContextGateCopy } from '@containers/copilot-workspace/TherapistCopilotGate';
import { TherapistCopilotHeader } from '@containers/copilot-workspace/TherapistCopilotHeader';
import type { WorkspacePatient } from '@containers/copilot-workspace/copilot-workspace.types';
import { ClinicalSessionHeaderActionsSlot, ClinicalSessionWorkspace } from '@containers/patient/session/ClinicalSessionWorkspace';
import { SessionNoteReviewPanel } from '@containers/patient/session/SessionNoteReviewPanel';
import { callFunction } from '@shared/lib/api';
import { supabase } from '@shared/lib/supabase';
import { sessionWorkspacePath } from './session-workspace.utils';

const SESSION_GATE_COPY: PatientContextGateCopy = {
  title: 'Iniciar sessão',
  bodyWithPatients:
    'Para começar, escolha o paciente. Digite o nome ou abra a lista completa. A sessão trava o contexto no prontuário dele — e só dele.',
  bodyEmpty: 'Para iniciar uma sessão é necessário cadastrar um paciente.',
  searchLabel: 'Buscar paciente',
  searchPlaceholder: 'Digite o nome do paciente...',
  listButton: 'Ver todos os pacientes',
  emptyCta: 'Cadastrar paciente',
  dataTour: 'session-gate',
  searchInputId: 'session-patient-search',
  modalEmptyMessage: 'Para iniciar uma sessão é necessário cadastrar um paciente.',
  modalSelectLabel: 'Iniciar sessão com este paciente',
  modalSelectShortLabel: 'Iniciar sessão',
};

function SessionGateHero() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    </span>
  );
}

export default function TherapistSessionContainer() {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId?: string }>();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId');
  const reviewSectionRef = useRef<HTMLElement>(null);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['workspace-patients'],
    queryFn: () => callFunction<WorkspacePatient[]>('list-patients', {}),
  });

  useEffect(() => {
    if (!scheduleId) return;
    void callFunction('start-schedule-session', { schedule_id: scheduleId }).catch((err) => {
      console.error('start-schedule-session failed:', err);
    });
  }, [scheduleId]);

  const { data: patient, isLoading: patientLoading } = useQuery({
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
    enabled: Boolean(patientId),
  });

  const handleSessionProcessed = useCallback((sessionNoteId: string) => {
    setFocusNoteId(sessionNoteId);
    reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function handleSelect(next: WorkspacePatient) {
    navigate(sessionWorkspacePath(next.id, scheduleId));
  }

  if (!patientId) {
    return (
      <TherapistCopilotGate
        patients={patients}
        isLoading={patientsLoading}
        onSelect={handleSelect}
        copy={SESSION_GATE_COPY}
        hero={<SessionGateHero />}
      />
    );
  }

  if (patientLoading && !patient) {
    return <PageLoader label="Carregando sessão..." className="min-h-[50vh]" />;
  }

  if (!patient) {
    return (
      <TherapistCopilotGate
        patients={patients}
        isLoading={patientsLoading}
        onSelect={handleSelect}
        copy={SESSION_GATE_COPY}
        hero={<SessionGateHero />}
      />
    );
  }

  const locked: WorkspacePatient = {
    id: patient.id,
    name: patient.name,
    diagnoses: patient.diagnoses,
    foto_url: patient.foto_url,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#F8FAF9]">
      <TherapistCopilotHeader
        patient={locked}
        onChangePatient={() => navigate(sessionWorkspacePath())}
        backLink={scheduleId ? { to: '/calendar', label: 'Voltar para agenda' } : undefined}
        actions={<ClinicalSessionHeaderActionsSlot />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
        <div className="w-full space-y-8 py-6 lg:py-8">
          <ClinicalSessionWorkspace
            patientId={patient.id}
            scheduleId={scheduleId ?? undefined}
            onSessionProcessed={handleSessionProcessed}
          />

          <section ref={reviewSectionRef} aria-labelledby="session-review-title">
            <SessionNoteReviewPanel
              patientId={patient.id}
              scheduleId={scheduleId ?? undefined}
              focusNoteId={focusNoteId}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
