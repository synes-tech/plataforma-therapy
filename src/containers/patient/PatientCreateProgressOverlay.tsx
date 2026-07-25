import { Spinner } from '@containers/loading';

export const PATIENT_CREATE_PROGRESS_STEPS = [
  'Salvando informações…',
  'Atualizando…',
  'Transcrevendo documentos…',
  'Armazenando no banco…',
  'Quase lá…',
] as const;

const COMPLETE_LABEL = 'Cadastro concluído!';

interface PatientCreateProgressOverlayProps {
  open: boolean;
  stepIndex: number;
  complete?: boolean;
}

export function PatientCreateProgressOverlay({
  open,
  stepIndex,
  complete = false,
}: PatientCreateProgressOverlayProps) {
  if (!open) return null;

  const label = complete
    ? COMPLETE_LABEL
    : PATIENT_CREATE_PROGRESS_STEPS[Math.min(stepIndex, PATIENT_CREATE_PROGRESS_STEPS.length - 1)];

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/92 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy={!complete}
      aria-label={label}
    >
      <div className="w-full max-w-sm text-center">
        {complete ? (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="mx-auto flex h-14 w-14 items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}

        <p className="mt-4 font-display text-base font-semibold text-charcoal">{label}</p>

        {!complete && (
          <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
            {PATIENT_CREATE_PROGRESS_STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index <= stepIndex ? 'w-8 bg-primary/70' : 'w-4 bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
