interface FamilyDiaryAlertButtonProps {
  count: number;
  onClick: () => void;
}

export function FamilyDiaryAlertButton({ count, onClick }: FamilyDiaryAlertButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100"
      aria-label={
        count > 0
          ? `${count} relato${count !== 1 ? 's' : ''} no diário familiar`
          : 'Diário familiar — sem relatos recentes'
      }
      title="Diário familiar"
    >
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold leading-none text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
