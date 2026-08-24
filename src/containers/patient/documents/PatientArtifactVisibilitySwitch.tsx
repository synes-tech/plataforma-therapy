import { getArtifactVisibilityBadge } from './patient-artifacts.constants';

interface PatientArtifactVisibilitySwitchProps {
  shared: boolean;
  disabled?: boolean;
  onChange?: (shared: boolean) => void;
}

export function PatientArtifactVisibilitySwitch({
  shared,
  disabled = false,
  onChange,
}: PatientArtifactVisibilitySwitchProps) {
  const badge = getArtifactVisibilityBadge(shared);
  const labelClass = shared ? 'text-mint-dark' : 'text-charcoal-muted';

  if (!onChange) {
    return (
      <span className={`text-xs font-medium ${labelClass}`} aria-live="polite">
        {badge.label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={shared}
        aria-label={badge.label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onChange(!shared);
        }}
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          shared ? 'bg-mint' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            shared ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`min-w-0 text-xs font-medium leading-snug ${labelClass}`} aria-live="polite">
        {badge.label}
      </span>
    </div>
  );
}
