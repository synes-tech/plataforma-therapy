import { Link } from 'react-router-dom';
import { SkeletonBlock } from '@containers/loading';

interface DashboardKpiCardProps {
  label: string;
  value: string;
  hint: string;
  to?: string;
  ariaLabel?: string;
  tone?: 'default' | 'mint' | 'alert' | 'error';
  loading?: boolean;
}

const VALUE_TONE = {
  default: 'text-charcoal',
  mint: 'text-mint-dark',
  alert: 'text-alert',
  error: 'text-error',
} as const;

export function DashboardKpiCard({
  label,
  value,
  hint,
  to,
  ariaLabel,
  tone = 'default',
  loading,
}: DashboardKpiCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">{label}</p>
      {loading ? (
        <SkeletonBlock className="mt-2 h-8 w-16 rounded-md" />
      ) : (
        <p className={`mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight ${VALUE_TONE[tone]}`}>
          {value}
        </p>
      )}
      <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
      {to ? (
        <Link
          to={to}
          aria-label={ariaLabel ?? `Acesse os detalhes de ${label}`}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:text-xs"
        >
          Acesse os detalhes
        </Link>
      ) : null}
    </article>
  );
}
