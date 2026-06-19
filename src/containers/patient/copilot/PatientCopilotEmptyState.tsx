import { PATIENT_COPILOT_QUICK_PROMPTS } from './patient-copilot.constants';
import { patientFirstName } from './patient-copilot.utils';

interface PatientCopilotEmptyStateProps {
  patientName: string;
  onQuickPrompt: (text: string) => void;
  disabled?: boolean;
}

function SparkIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z" />
    </svg>
  );
}

export function PatientCopilotEmptyState({
  patientName,
  onQuickPrompt,
  disabled = false,
}: PatientCopilotEmptyStateProps) {
  const firstName = patientFirstName(patientName);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6 text-center lg:px-6">
      <h2 className="font-serif text-xl font-medium text-charcoal md:text-2xl">
        Como vamos planejar a sessão de {firstName} hoje?
      </h2>
      <p className="mt-2 max-w-md text-sm text-charcoal-muted">
        O contexto está travado no histórico de {firstName}. Escolha um atalho ou escreva sua pergunta.
      </p>

      <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {PATIENT_COPILOT_QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onQuickPrompt(prompt)}
            className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-sm text-charcoal shadow-sm transition-all hover:border-primary/30 hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparkIcon className="mt-0.5 h-4 w-4 text-primary/70" />
            <span className="min-w-0 flex-1 leading-snug">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
