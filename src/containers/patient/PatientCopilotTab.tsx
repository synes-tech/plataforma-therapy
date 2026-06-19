import { PatientCopilotChat } from './copilot/PatientCopilotChat';
import { usePaywall } from '@containers/paywall';

interface PatientCopilotTabProps {
  patientId: string;
  patientName: string;
}

export function PatientCopilotTab({ patientId, patientName }: PatientCopilotTabProps) {
  const { interceptAiFeature, handlePaymentRequired } = usePaywall();

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
      <PatientCopilotChat
        key={patientId}
        patientId={patientId}
        patientName={patientName}
        onBeforeSend={() => {
          let allowed = false;
          interceptAiFeature(() => {
            allowed = true;
          });
          return allowed;
        }}
        onPaymentRequired={handlePaymentRequired}
      />
    </div>
  );
}
