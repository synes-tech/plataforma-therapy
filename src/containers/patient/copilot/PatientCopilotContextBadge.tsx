import { patientFirstName } from './patient-copilot.utils';

interface PatientCopilotContextBadgeProps {
  patientName: string;
}

export function PatientCopilotContextBadge({ patientName }: PatientCopilotContextBadgeProps) {
  const firstName = patientFirstName(patientName);

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-ai/15 bg-ai-50/80 px-3 py-1.5 text-xs font-medium text-ai"
      role="status"
      aria-live="polite"
    >
      <span className="motion-safe:animate-pulse" aria-hidden>
        🧠
      </span>
      <span>
        Contexto sincronizado com o histórico de <span className="font-semibold">{firstName}</span>
      </span>
    </div>
  );
}
