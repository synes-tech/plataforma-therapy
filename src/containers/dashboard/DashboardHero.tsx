import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { formatLongDate } from './home.utils';

interface DashboardHeroProps {
  firstName: string;
  greeting: string;
  date?: string;
  /** Substitui a data no mobile (ex.: data · nome da clínica). */
  meta?: string;
  /** Barra compacta do desktop: foto pequena ao lado do cumprimento. */
  compact?: boolean;
  subtitle?: string;
}

export function DashboardHero({
  firstName,
  greeting,
  date,
  meta,
  compact = false,
  subtitle,
}: DashboardHeroProps) {
  const caption = compact ? null : (meta ?? (date != null ? formatLongDate(date) : null));

  return (
    <div className={`flex min-w-0 items-center ${compact ? 'gap-2.5' : 'gap-3.5'}`}>
      <TheryAvatar pose="profile" variant="circle" size={compact ? 'sm' : 'md'} decorative />
      <div className="min-w-0">
        {caption ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">{caption}</p>
        ) : null}
        <h1
          className={
            compact
              ? 'truncate font-display text-[20px] font-semibold leading-none tracking-tight text-charcoal'
              : 'mt-1 font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl'
          }
        >
          {greeting}, {firstName}
          {compact ? '' : '.'}
        </h1>
        {!compact && subtitle ? <p className="mt-1 text-sm text-charcoal-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}
