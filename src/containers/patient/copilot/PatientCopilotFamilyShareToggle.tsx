import { getFamilyShareStatusLabel } from './patient-copilot-family-share.utils';

interface PatientCopilotFamilyShareToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function PatientCopilotFamilyShareToggle({
  checked,
  onChange,
  disabled = false,
}: PatientCopilotFamilyShareToggleProps) {
  const statusLabel = getFamilyShareStatusLabel(checked);

  return (
    <div className="rounded-xl border border-slate-100 bg-[#F8FAF9] px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-charcoal">Compartilhar com a família no aplicativo?</p>
          <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">
            Use apenas para orientações que a família deve praticar em casa. Anotações clínicas sensíveis
            devem permanecer privadas.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label="Compartilhar com a família no aplicativo"
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${
            checked ? 'bg-mint' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p
        className={`mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
          checked ? 'bg-mint-50 text-mint-dark' : 'bg-slate-100 text-charcoal-muted'
        }`}
        aria-live="polite"
      >
        {statusLabel}
      </p>
    </div>
  );
}
