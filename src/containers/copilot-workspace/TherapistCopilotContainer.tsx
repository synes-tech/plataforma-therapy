import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { usePaywall } from '@containers/paywall';
import { PatientCopilotChat } from '@containers/patient/copilot/PatientCopilotChat';
import { TherapistCopilotGate } from './TherapistCopilotGate';
import { TherapistCopilotHeader } from './TherapistCopilotHeader';
import type { WorkspacePatient } from './copilot-workspace.types';

export default function TherapistCopilotContainer() {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId?: string }>();
  const { interceptAiFeature, handlePaymentRequired } = usePaywall();

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['workspace-patients'],
    queryFn: () => callFunction<WorkspacePatient[]>('list-patients', {}),
  });

  const selected = patientId ? patients.find((patient) => patient.id === patientId) ?? null : null;
  const unknownPatient = Boolean(patientId && !isLoading && patients.length > 0 && !selected);

  function handleSelect(patient: WorkspacePatient) {
    navigate(`/copilot/${patient.id}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F8FAF9]">
      {!patientId || unknownPatient || !selected ? (
        <TherapistCopilotGate
          patients={patients}
          isLoading={isLoading}
          onSelect={handleSelect}
          welcome
        />
      ) : (
        <>
          <TherapistCopilotHeader
            patient={selected}
            onChangePatient={() => navigate('/copilot')}
          />
          <PatientCopilotChat
            key={selected.id}
            patientId={selected.id}
            patientName={selected.name}
            surface="workspace"
            onBeforeSend={() => {
              let allowed = false;
              interceptAiFeature(() => {
                allowed = true;
              });
              return allowed;
            }}
            onPaymentRequired={handlePaymentRequired}
          />
        </>
      )}
    </div>
  );
}
