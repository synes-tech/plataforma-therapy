import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { getInitials } from '@shared/lib/greeting';

export const PROFESSIONAL_AVATAR_BUCKET = 'profissionais-avatars';

interface ProfileAvatarProps {
  name: string;
  fotoUrl?: string | null;
  previewUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
} as const;

export function ProfileAvatar({
  name,
  fotoUrl,
  previewUrl,
  size = 'md',
  className = '',
}: ProfileAvatarProps) {
  const { data: signedUrl } = useQuery({
    queryKey: ['professional-avatar-url', fotoUrl],
    queryFn: async () => {
      if (!fotoUrl) return null;
      const { data, error } = await supabase.storage
        .from(PROFESSIONAL_AVATAR_BUCKET)
        .createSignedUrl(fotoUrl, 3600);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    enabled: !!fotoUrl && !previewUrl,
    staleTime: 45 * 60 * 1000,
  });

  const displayUrl = previewUrl ?? signedUrl;
  const sizeClass = SIZE_CLASS[size];

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white ring-2 ring-white ${sizeClass} ${className}`}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
