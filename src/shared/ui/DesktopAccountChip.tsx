import { ProfileAvatar } from './ProfileAvatar';
import { getInitials } from '@shared/lib/greeting';

interface DesktopAccountChipProps {
  name: string;
  fotoUrl?: string | null;
  onLogout: () => void;
  onOpenProfile?: () => void;
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
      />
    </svg>
  );
}

export function DesktopAccountChip({
  name,
  fotoUrl,
  onLogout,
  onOpenProfile,
}: DesktopAccountChipProps) {
  const initials = getInitials(name);
  const avatar = <ProfileAvatar name={name} fotoUrl={fotoUrl} size="sm" />;

  return (
    <div className="flex items-center gap-2" aria-label={name}>
      {onOpenProfile ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Abrir perfil de ${name}`}
          title={name}
        >
          {avatar}
        </button>
      ) : (
        <span title={name}>{avatar}</span>
      )}
      <span className="text-xs font-semibold tracking-wide text-charcoal" aria-hidden>
        {initials}
      </span>
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-muted transition-colors hover:bg-slate-100 hover:text-charcoal"
        aria-label="Sair da conta"
        title="Sair"
      >
        <LogoutIcon />
      </button>
    </div>
  );
}
