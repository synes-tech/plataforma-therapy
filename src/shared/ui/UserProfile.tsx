import { ProfileAvatar } from './ProfileAvatar';

interface UserProfileProps {
  name: string;
  role: string;
  fotoUrl?: string | null;
  onLogout: () => void;
  onOpenProfile?: () => void;
  compact?: boolean;
}

export function UserProfile({
  name,
  role,
  fotoUrl,
  onLogout,
  onOpenProfile,
  compact = false,
}: UserProfileProps) {
  const profileInteractive = !!onOpenProfile;

  if (compact) {
    if (profileInteractive) {
      return (
        <button
          type="button"
          onClick={onOpenProfile}
          className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Abrir perfil de ${name}`}
          title={name}
        >
          <ProfileAvatar name={name} fotoUrl={fotoUrl} size="sm" />
        </button>
      );
    }

    return (
      <div className="flex h-9 w-9 items-center justify-center" title={name}>
        <ProfileAvatar name={name} fotoUrl={fotoUrl} size="sm" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
      {profileInteractive ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={`Abrir Controle Geral de ${name}`}
        >
          <ProfileAvatar name={name} fotoUrl={fotoUrl} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-charcoal">{name}</p>
            <p className="truncate text-xs text-charcoal-muted">{role}</p>
          </div>
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ProfileAvatar name={name} fotoUrl={fotoUrl} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-charcoal">{name}</p>
            <p className="truncate text-xs text-charcoal-muted">{role}</p>
          </div>
        </div>
      )}

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
