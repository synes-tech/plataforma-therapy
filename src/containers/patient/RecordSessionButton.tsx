function MicIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

const styles = {
  header:
    'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-gradient-to-b from-primary-50 to-white px-3.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/10 transition-all hover:border-primary/45 hover:from-primary-50 hover:to-primary-50/60 hover:shadow-md active:scale-[0.98] sm:px-4',
  headerMobile:
    'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-gradient-to-b from-primary-50 to-white px-3 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/10 transition-all hover:border-primary/45 hover:shadow-md active:scale-[0.98] sm:hidden',
  empty:
    'inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md active:scale-[0.98]',
} as const;

interface RecordSessionButtonProps {
  onClick: () => void;
  variant?: keyof typeof styles;
  className?: string;
}

export function RecordSessionButton({
  onClick,
  variant = 'header',
  className = '',
}: RecordSessionButtonProps) {
  const isEmpty = variant === 'empty';
  const label = variant === 'headerMobile' ? 'Gravar' : 'Gravar sessão';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Gravar sessão"
      title="Gravar sessão"
      className={`${styles[variant]} ${className}`.trim()}
    >
      <span
        className={
          isEmpty
            ? 'flex h-5 w-5 items-center justify-center'
            : 'flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20'
        }
        aria-hidden
      >
        <MicIcon className={isEmpty ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5 text-primary'} />
      </span>
      {label}
    </button>
  );
}
