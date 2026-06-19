import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RecordPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { ExportPdfButton } from '@features/pdf/ExportPdfButton';
import { PatientRecordTabs } from './PatientRecordTabs';
import { PatientOverviewTab } from './PatientOverviewTab';
import { PatientClinicalRecordTab } from './PatientClinicalRecordTab';
import { PatientCopilotTab } from './PatientCopilotTab';
import { PatientDocumentsTab } from './documents/PatientDocumentsTab';
import { PatientCrisisControlTab } from './PatientCrisisControlTab';
import { PatientAvatar } from './PatientAvatar';
import {
  PatientFamilyInviteButton,
  PatientFamilyInviteModal,
  usePatientFamilyInvite,
} from './PatientFamilyInvite';
import { PatientLinkManageFlow } from './PatientLinkManageFlow';
import {
  normalizePatientInfo,
  type PatientInfo,
  type PatientRecordData,
  type PatientRecordTab,
} from './patient-record.types';
import {
  isClinicalFormDirty,
  patientInfoToForm,
  formToPartialUpdatePayload,
  type PatientAnamnesisForm,
} from './patient-anamnesis.types';
import { pathFromTab, tabFromPath } from './patient-record.tabs';

function getAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

interface UpdatePatientResponse {
  patient_id: string;
  message: string;
  patient: PatientInfo;
}

export default function PatientRecordContainer() {
  const { patientId, tab: tabParam } = useParams<{ patientId: string; tab?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeTab = tabFromPath(tabParam);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [clinicalForm, setClinicalForm] = useState<PatientAnamnesisForm | null>(null);
  const [savedForm, setSavedForm] = useState<PatientAnamnesisForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const familyInvite = usePatientFamilyInvite(patientId ?? '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['patient-record', patientId],
    queryFn: () => callFunction<PatientRecordData>('get-patient-record', { patient_id: patientId }),
    enabled: !!patientId,
  });

  useEffect(() => {
    if (!patientId) return;
    if (!tabParam) {
      navigate(`/patients/${patientId}/copilot`, { replace: true });
    }
  }, [patientId, tabParam, navigate]);

  useEffect(() => {
    if (!data) return;
    const normalized = normalizePatientInfo(data.patient);
    setPatient(normalized);
    const form = patientInfoToForm(normalized);
    setClinicalForm(form);
    setSavedForm(form);
  }, [data]);

  const isDirty =
    clinicalForm && savedForm ? isClinicalFormDirty(clinicalForm, savedForm) : false;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!patientId || !clinicalForm || !savedForm) throw new Error('Dados incompletos');
      const payload = formToPartialUpdatePayload(patientId, clinicalForm, savedForm);
      if (Object.keys(payload).length <= 1) {
        throw new Error('Nenhuma alteração para salvar');
      }
      return callFunction<UpdatePatientResponse>('update-patient', payload);
    },
    onSuccess: (res) => {
      const normalized = normalizePatientInfo(res.patient);
      setPatient(normalized);
      const form = patientInfoToForm(normalized);
      setClinicalForm(form);
      setSavedForm(form);
      setSaveError(null);
      queryClient.setQueryData<PatientRecordData>(['patient-record', patientId], (old) =>
        old ? { ...old, patient: normalized } : old,
      );
    },
    onError: (err: Error) => {
      setSaveError(err.message);
    },
  });

  function handleTabChange(tab: PatientRecordTab) {
    if (!patientId || tab === activeTab) return;
    navigate(`/patients/${patientId}/${pathFromTab(tab)}`);
  }

  function handleCancelEdit() {
    if (savedForm) setClinicalForm(savedForm);
    setSaveError(null);
  }

  if (!patientId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-charcoal-muted">Paciente não encontrado</p>
      </div>
    );
  }

  if (isLoading) {
    return <RecordPageSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-charcoal-muted">Erro ao carregar prontuário</p>
        <button
          onClick={() => navigate('/patients')}
          className="text-sm font-medium text-primary hover:text-primary-dark"
        >
          Voltar para pacientes
        </button>
      </div>
    );
  }

  if (!patient || !clinicalForm || !savedForm) {
    return null;
  }

  const age = getAge(patient.birth_date);

  return (
    <div className="bg-[#F8FAF9] px-4 py-6 pb-8 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-4">
        <button
          onClick={() => navigate('/patients')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-charcoal-muted transition-colors hover:text-primary"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para pacientes
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="lg" />
            <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
              {patient.name}
            </h1>
            {patient.nome_social && (
              <p className="mt-0.5 text-sm text-charcoal-muted">Nome social: {patient.nome_social}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-charcoal-muted">{age} anos</span>
              <span className="text-charcoal-muted/30">•</span>
              {patient.diagnoses.map((d, i) => (
                <span
                  key={i}
                  className="inline-flex rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-medium text-primary-700"
                >
                  {d}
                </span>
              ))}
            </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PatientFamilyInviteButton onClick={() => familyInvite.setOpen(true)} />
            <ExportPdfButton patientId={patientId} patientName={patient.name} />
            <PatientLinkManageFlow
              patientId={patientId}
              patientName={patient.name}
              statusVinculo={patient.status_vinculo}
            />
            <button
              onClick={() => navigate(`/session/${patientId}`)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-charcoal transition-colors hover:border-charcoal/30"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Gravar sessão
            </button>
          </div>
        </div>
      </header>

      <PatientFamilyInviteModal
        isOpen={familyInvite.open}
        onClose={familyInvite.close}
        patientName={patient.name}
        invite={familyInvite}
      />

      <PatientRecordTabs
        active={activeTab}
        onChange={handleTabChange}
        clinicalDirty={isDirty}
      />

      {isDirty && activeTab === 'overview' && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          A Ficha Clínica tem alterações não salvas. Abra a aba &quot;Ficha Clínica&quot; para concluir a edição.
        </div>
      )}

      {activeTab === 'copilot' && (
        <PatientCopilotTab patientId={patientId} patientName={patient.name} />
      )}

      {activeTab === 'overview' && (
        <PatientOverviewTab
          patientId={patientId}
          patient={patient}
          sessionNotes={data.session_notes}
          recentDiary={data.recent_diary}
          evolution={data.evolution}
          upcomingSessions={data.upcoming_sessions}
          totalSessions={data.total_sessions}
        />
      )}

      {activeTab === 'checkins' && <PatientCrisisControlTab patientId={patientId} />}

      {activeTab === 'clinical' && (
        <PatientClinicalRecordTab
          patientId={patientId}
          patientName={patient.name}
          fotoUrl={patient.foto_url}
          onFotoUpdated={(fotoUrl) => {
            setPatient((p) => (p ? { ...p, foto_url: fotoUrl } : p));
            queryClient.setQueryData<PatientRecordData>(['patient-record', patientId], (old) =>
              old ? { ...old, patient: { ...old.patient, foto_url: fotoUrl } } : old,
            );
            queryClient.invalidateQueries({ queryKey: ['patient-avatar-url', fotoUrl] });
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          }}
          form={clinicalForm}
          onChange={setClinicalForm}
          onSave={() => updateMutation.mutate()}
          onCancelEdit={handleCancelEdit}
          isSaving={updateMutation.isPending}
          saveError={saveError}
          isDirty={isDirty}
        />
      )}

      {activeTab === 'documents' && (
        <PatientDocumentsTab patientId={patientId} />
      )}
    </div>
  );
}
