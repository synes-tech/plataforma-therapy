import { THERY_POSES, type TheryPose } from '@shared/lib/thery-assets';

export type TheryAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | 'tour';
export type TheryAvatarVariant = 'circle' | 'figure';

interface TheryAvatarProps {
  pose?: TheryPose;
  size?: TheryAvatarSize;
  variant?: TheryAvatarVariant;
  className?: string;
  /** Quando true, o recorte circular não anuncia o nome (já há texto ao lado). */
  decorative?: boolean;
}

const CIRCLE: Record<TheryAvatarSize, string> = {
  xs: 'h-8 w-8',
  sm: 'h-9 w-9',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  hero: 'h-36 w-36',
  tour: 'h-28 w-28',
};

const FIGURE: Record<TheryAvatarSize, string> = {
  xs: 'h-16 w-auto',
  sm: 'h-24 w-auto',
  md: 'h-36 w-auto',
  lg: 'h-44 w-auto',
  hero: 'h-56 w-auto max-h-[42vh]',
  tour: 'h-52 w-auto sm:h-64 lg:h-[20rem]',
};

export function TheryAvatar({
  pose = 'profile',
  size = 'sm',
  variant = 'circle',
  className = '',
  decorative = false,
}: TheryAvatarProps) {
  const src = THERY_POSES[pose];
  const alt = decorative ? '' : 'Ivy';

  if (variant === 'figure') {
    return (
      <img
        src={src}
        alt={alt}
        className={`pointer-events-none select-none object-contain ${FIGURE[size]} ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-100 ${CIRCLE[size]} ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover object-[center_12%]"
        draggable={false}
      />
    </span>
  );
}
