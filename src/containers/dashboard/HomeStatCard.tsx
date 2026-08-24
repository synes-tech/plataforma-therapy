import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SkeletonBlock } from '@containers/loading';

type HomeStatTone = 'mint' | 'primary' | 'alert' | 'ai';

interface HomeStatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: HomeStatTone;
  badge?: string;
  hint?: string;
  progress?: { current: number; max: number; label: string; percent: number } | null;
  actionLabel: string;
  ariaLabel: string;
  to?: string;
  onClick?: () => void;
  loading?: boolean;
}

const TONE = {
  mint: { icon: 'bg-mint/15 text-mint-dark', bar: 'bg-mint' },
  primary: { icon: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  alert: { icon: 'bg-alert/15 text-alert', bar: 'bg-alert' },
  ai: { icon: 'bg-ai/10 text-ai', bar: 'bg-ai' },
} as const;

const ACTION_CLASS =
  'mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-3 text-center text-xs font-semibold uppercase tracking-wide text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export function HomeStatCard({
  label,
  value,
  icon,
  tone = 'primary',
  badge,
  hint,
  progress,
  actionLabel,
  ariaLabel,
  to,
  onClick,
  loading,
}: HomeStatCardProps) {
  const styles = TONE[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>{icon}</div>
        {badge ? (
          <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint-dark">
            {badge}
          </span>
        ) : null}
      </div>
      {loading ? (
        <SkeletonBlock className="mt-4 h-9 w-16 rounded-md" />
      ) : (
        <p className="mt-4 font-display text-3xl font-bold tabular-nums leading-none tracking-tight text-charcoal">
          {value}
        </p>
      )}
      <p className="mt-2 text-sm font-medium text-charcoal">{label}</p>
      {progress ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-display text-[11px] font-bold tabular-nums tracking-tight text-charcoal-muted">
            <span>{progress.label}</span>
            <span>{progress.percent}%</span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-charcoal-muted">{hint}</p>
      )}
    </>
  );

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      {body}
      {to ? (
        <Link to={to} aria-label={ariaLabel} className={ACTION_CLASS}>
          {actionLabel}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={ACTION_CLASS}>
          {actionLabel}
        </button>
      )}
    </article>
  );
}
