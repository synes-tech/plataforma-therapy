interface PlanQuotaIncreaseButtonProps {
  onClick: () => void;
  label?: string;
}

export function PlanQuotaIncreaseButton({ onClick, label = 'AUMENTAR' }: PlanQuotaIncreaseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal shadow-sm transition-all hover:border-primary/30 hover:bg-primary-50 hover:text-primary active:scale-[0.98]"
    >
      {label}
    </button>
  );
}
