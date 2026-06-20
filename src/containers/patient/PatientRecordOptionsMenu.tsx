interface PatientRecordOptionsMenuProps {
  onManageLink: () => void;
  disabled?: boolean;
}

export function PatientRecordOptionsMenu({ onManageLink, disabled }: PatientRecordOptionsMenuProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onManageLink}
      title="Gerenciar o vínculo"
      aria-label="Gerenciar o vínculo"
      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-charcoal-muted transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-charcoal disabled:opacity-50"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <span className="whitespace-nowrap">Gerenciar o vínculo</span>
    </button>
  );
}
