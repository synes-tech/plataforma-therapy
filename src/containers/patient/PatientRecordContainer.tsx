import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RecordPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { PatientSessionHistoryTab } from './sessions/PatientSessionHistoryTab';
import { FamilyDiaryModal } from './family-diary/FamilyDiaryModal';
import { PatientClinicalRecordTab } from './PatientClinicalRecordTab';
import { PatientCopilotTab } from './PatientCopilotTab';
import { PatientDocumentsTab } from './documents/PatientDocumentsTab';
import { PatientCrisisControlTab } from './PatientCrisisControlTab';
import { PatientFamilyInviteModal, usePatientFamilyInvite } from './PatientFamilyInvite';
import { PatientRecordPageHeader } from './PatientRecordPageHeader';
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
  const [familyDiaryOpen, setFamilyDiaryOpen] = useState(false);
  const familyInvite = usePatientFamilyInvite(patientId ?? '');

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['patient-record', patientId],
    queryFn: () => callFunction<PatientRecordData>('get-patient-record', { patient_id: patientId }),
    enabled: !!patientId,
  });

  useEffect(() => {
    setPatient(null);
    setClinicalForm(null);
    setSavedForm(null);
    setSaveError(null);
  }, [patientId]);

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

  const showPageLoading = !data && (isPending || isFetching);
  const showStateSyncLoading = !!data && (!patient || !clinicalForm || !savedForm);

  if (!patientId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-charcoal-muted">Paciente não encontrado</p>
      </div>
    );
  }

  if (showPageLoading || showStateSyncLoading) {
    return <RecordPageSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#F8FAF9] px-4">
        <p className="text-sm text-charcoal-muted">
          {error instanceof Error ? error.message : 'Erro ao carregar prontuário'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-sm font-medium text-primary hover:text-primary-dark disabled:opacity-50"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="text-sm font-medium text-charcoal-muted hover:text-charcoal"
          >
            Voltar para pacientes
          </button>
        </div>
      </div>
    );
  }

  if (!patient || !clinicalForm || !savedForm) {
    return <RecordPageSkeleton />;
  }

  const age = getAge(patient.birth_date);
  const isCopilotTab = activeTab === 'copilot';

  return (
    <div
      className={
        isCopilotTab
          ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white'
          : 'bg-[#F8FAF9] px-4 pb-8 sm:px-6 lg:px-8'
      }
    >
      <PatientRecordPageHeader
        patient={patient}
        age={age}
        diaryCount={data.recent_diary.length}
        onDiaryOpen={() => setFamilyDiaryOpen(true)}
        onFamilyInvite={() => familyInvite.setOpen(true)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        clinicalDirty={isDirty}
        bleed={!isCopilotTab}
      />

      <PatientFamilyInviteModal
        isOpen={familyInvite.open}
        onClose={familyInvite.close}
        patientName={patient.name}
        invite={familyInvite}
      />

      <FamilyDiaryModal
        isOpen={familyDiaryOpen}
        onClose={() => setFamilyDiaryOpen(false)}
        patientId={patientId}
        entries={data.recent_diary}
      />

      {isCopilotTab ? (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
          <PatientCopilotTab patientId={patientId} patientName={patient.name} />
        </div>
      ) : (
        <div className="mt-6 lg:mt-8">
          {isDirty && activeTab === 'overview' && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              A Ficha Clínica tem alterações não salvas. Abra a aba &quot;Ficha Clínica&quot; para concluir a edição.
            </div>
          )}

          {activeTab === 'overview' && (
            <PatientSessionHistoryTab patientId={patientId} patientName={patient.name} />
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
            <PatientDocumentsTab patientId={patientId} patientName={patient.name} />
          )}
        </div>
      )}
    </div>
  );
}
