interface UserProfileProps {
  name: string;
  role: string;
  onLogout: () => void;
  compact?: boolean;
}

export function UserProfile({ name, role, onLogout, compact = false }: UserProfileProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onLogout}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-dark"
        aria-label={`Perfil de ${name}. Sair`}
        title={name}
      >
        {initials}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-charcoal">{name}</p>
        <p className="truncate text-xs text-charcoal-muted">{role}</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-lg p-1.5 text-charcoal-muted transition-colors hover:bg-white hover:text-charcoal"
        aria-label="Sair da conta"
        title="Sair"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
        </svg>
      </button>
    </div>
  );
}
