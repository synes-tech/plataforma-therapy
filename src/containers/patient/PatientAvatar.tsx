import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { getInitials } from '@shared/lib/greeting';

const AVATAR_BUCKET = 'pacientes-avatars';

interface PatientAvatarProps {
  name: string;
  fotoUrl?: string | null;
  /** URL local (blob) para preview antes do upload */
  previewUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Estilo silenciado para pacientes arquivados (cold storage) */
  muted?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
} as const;

export function PatientAvatar({
  name,
  fotoUrl,
  previewUrl,
  size = 'md',
  muted = false,
  className = '',
}: PatientAvatarProps) {
  const { data: signedUrl } = useQuery({
    queryKey: ['patient-avatar-url', fotoUrl],
    queryFn: async () => {
      if (!fotoUrl) return null;
      const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(fotoUrl, 3600);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    enabled: !!fotoUrl && !previewUrl,
    staleTime: 45 * 60 * 1000,
  });

  const displayUrl = previewUrl ?? signedUrl;
  const sizeClass = SIZE_CLASS[size];
  const mutedClass = muted ? 'grayscale opacity-60 ring-slate-200' : 'ring-white';
  const initialsMutedClass = muted ? 'bg-slate-200 text-slate-500 ring-slate-200' : 'bg-indigo-100 text-indigo-700 ring-white';

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-2 ${mutedClass} ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ${initialsMutedClass} ${sizeClass} ${className}`}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
