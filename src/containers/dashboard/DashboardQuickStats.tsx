import type { BriefingSummary } from './dashboard.types';
import { DASHBOARD_QUICK_STATS } from './dashboard-quick-stats.constants';
import { DashboardQuickStatCard } from './DashboardQuickStatCard';

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

const STAT_ICONS = {
  active_patients: <UsersIcon />,
  sessions_week: <CalendarIcon />,
  pending_alerts: <BellIcon />,
} as const;

interface DashboardQuickStatsProps {
  summary?: BriefingSummary;
  loading?: boolean;
}

export function DashboardQuickStats({ summary, loading }: DashboardQuickStatsProps) {
  return (
    <section aria-label="Métricas rápidas" className="mb-6 md:mb-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {DASHBOARD_QUICK_STATS.map((stat) => (
          <DashboardQuickStatCard
            key={stat.id}
            label={stat.label}
            value={stat.getValue(summary)}
            icon={STAT_ICONS[stat.id]}
            tone={stat.tone}
            loading={loading}
            action={stat.action}
          />
        ))}
      </div>
    </section>
  );
}
