import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SkeletonBlock } from '@containers/loading';
import type { DashboardQuickStatAction } from './dashboard-quick-stats.constants';

interface DashboardQuickStatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: 'primary' | 'mint' | 'alert';
  loading?: boolean;
  action?: DashboardQuickStatAction;
}

const TONE_STYLES = {
  primary: {
    card: 'dashboard-stat-surface',
    icon: 'bg-primary/10 text-primary',
    value: 'text-charcoal',
    hover: 'hover:border-primary/25 hover:shadow-md hover:shadow-primary/5',
  },
  mint: {
    card: 'dashboard-stat-surface',
    icon: 'bg-mint/10 text-mint-dark',
    value: 'text-charcoal',
    hover: 'hover:border-mint/30 hover:shadow-md hover:shadow-mint/5',
  },
  alert: {
    card: 'dashboard-stat-surface',
    icon: 'bg-alert/15 text-alert',
    value: 'text-charcoal',
    hover: 'hover:border-alert/30 hover:shadow-md hover:shadow-alert/5',
  },
  alertActive: {
    card: 'dashboard-stat-surface',
    icon: 'bg-error/10 text-error',
    value: 'text-error',
    hover: 'hover:border-error/25 hover:shadow-md hover:shadow-error/5',
  },
} as const;

const INTERACTIVE_BASE =
  'group w-full text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 active:scale-[0.98]';

function scrollToTarget(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function DashboardQuickStatCard({
  label,
  value,
  icon,
  tone = 'primary',
  loading,
  action,
}: DashboardQuickStatCardProps) {
  const hasAlerts = tone === 'alert' && Number(value) > 0;
  const styles = hasAlerts ? TONE_STYLES.alertActive : TONE_STYLES[tone];

  const content = (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${styles.icon}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">{label}</p>
        {loading ? (
          <SkeletonBlock className="mt-1.5 h-6 w-10 rounded-md" />
        ) : (
          <p className={`mt-0.5 font-display text-xl font-semibold tabular-nums ${styles.value}`}>{value}</p>
        )}
      </div>
      {action ? (
        <svg
          className="h-4 w-4 shrink-0 text-charcoal-muted/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-charcoal-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      ) : null}
    </>
  );

  const cardClassName = `flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-4 ${styles.card}`;

  if (action?.type === 'link') {
    return (
      <Link
        to={action.to}
        aria-label={action.ariaLabel}
        className={`${INTERACTIVE_BASE} cursor-pointer ${cardClassName} ${styles.hover}`}
      >
        {content}
      </Link>
    );
  }

  if (action?.type === 'scroll') {
    return (
      <button
        type="button"
        aria-label={action.ariaLabel}
        onClick={() => scrollToTarget(action.targetId)}
        className={`${INTERACTIVE_BASE} cursor-pointer ${cardClassName} ${styles.hover}`}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
