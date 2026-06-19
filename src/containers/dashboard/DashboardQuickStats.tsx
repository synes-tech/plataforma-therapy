import type { ReactNode } from 'react';
import { SkeletonBlock } from '@containers/loading';
import type { BriefingSummary } from './dashboard.types';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: 'default' | 'alert';
  loading?: boolean;
}

function StatCard({ label, value, icon, accent = 'default', loading }: StatCardProps) {
  const valueClass =
    accent === 'alert' && Number(value) > 0 ? 'text-error' : 'text-charcoal';

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          accent === 'alert' && Number(value) > 0 ? 'bg-error-light/80 text-error' : 'bg-primary-50 text-primary'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">{label}</p>
        {loading ? (
          <SkeletonBlock className="mt-1.5 h-6 w-10 rounded-md" />
        ) : (
          <p className={`mt-0.5 font-display text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

interface DashboardQuickStatsProps {
  summary?: BriefingSummary;
  loading?: boolean;
}

export function DashboardQuickStats({ summary, loading }: DashboardQuickStatsProps) {
  return (
    <section aria-label="Métricas rápidas" className="mb-6 md:mb-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Pacientes ativos"
          value={summary?.active_patients_count ?? 0}
          icon={<UsersIcon />}
          loading={loading}
        />
        <StatCard
          label="Sessões na semana"
          value={summary?.sessions_this_week ?? 0}
          icon={<CalendarIcon />}
          loading={loading}
        />
        <StatCard
          label="Alertas pendentes"
          value={summary?.alerts_count ?? 0}
          icon={<BellIcon />}
          accent="alert"
          loading={loading}
        />
      </div>
    </section>
  );
}
