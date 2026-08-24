import { useState } from 'react';
import type { PlanControlState } from '@containers/billing/plan-control.types';
import type { BriefingData } from './dashboard.types';
import { ClinicalAlertsModal } from './ClinicalAlertsModal';
import { HomeSessionsModal } from './HomeSessionsModal';
import { HomeStatCard } from './HomeStatCard';
import {
  completedSessionItems,
  completedSessionsToday,
  completedSessionsTotal,
  quotaBarLabel,
  quotaBarPercent,
  scheduledSessionsToday,
  todaySessionsRatioLabel,
} from './home-layout.utils';
import { withSummaryDefaults } from './home.utils';
import { useAcknowledgeClinicalAlert, useClinicalAlerts } from './useClinicalAlerts';

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.947L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

interface HomeKpiRowProps {
  data?: BriefingData;
  plan?: PlanControlState;
  loading?: boolean;
}

export function HomeKpiRow({ data, plan, loading }: HomeKpiRowProps) {
  const summary = withSummaryDefaults(data?.summary);
  const { data: alertsData, error: alertsError } = useClinicalAlerts();
  const acknowledge = useAcknowledgeClinicalAlert();
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const [sessionsOpen, setSessionsOpen] = useState<'total' | 'today' | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const quota = plan?.patient_quota;
  const unlimited = Boolean(plan?.clinic.billing_exempt) || !quota || quota.total_limit <= 0;
  const activeCount = quota?.active_count ?? summary.active_patients_count;
  const totalLimit = quota?.total_limit ?? 0;
  const percent = unlimited ? 0 : quotaBarPercent(activeCount, totalLimit);

  const totalSessions = completedSessionsTotal(data);
  const todaySessions = completedSessionsToday(data);
  const todayScheduled = scheduledSessionsToday(data);
  const aiProcessed = data?.completed_sessions?.ai_processed ?? 0;
  const alerts = alertsData?.alerts ?? [];
  const alertCount = alertsData?.unread_count ?? alerts.length;

  function handleAcknowledge(alertId: string) {
    setRemovingIds((prev) => new Set(prev).add(alertId));
    window.setTimeout(() => {
      acknowledge.mutate(alertId, {
        onError: () => {
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(alertId);
            return next;
          });
        },
      });
    }, 280);
  }

  return (
    <>
    <section aria-label="Indicadores da conta" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <HomeStatCard
        label="Pacientes cadastrados"
        value={String(activeCount)}
        icon={<UsersIcon />}
        tone="mint"
        badge="Total"
        progress={
          unlimited
            ? null
            : {
                current: activeCount,
                max: totalLimit,
                label: quotaBarLabel(activeCount, totalLimit, false),
                percent,
              }
        }
        hint={unlimited ? 'Carteira sem limite neste plano' : undefined}
        actionLabel="Ver plano"
        ariaLabel="Abrir perfil e configurações para ver o plano"
        to="/settings"
        loading={loading}
      />
      <HomeStatCard
        label="Sessões realizadas"
        value={String(totalSessions)}
        icon={<ChatIcon />}
        tone="primary"
        hint={`${aiProcessed} processada${aiProcessed === 1 ? '' : 's'} pela IA`}
        actionLabel="Ver sessões"
        ariaLabel="Abrir a lista de sessões realizadas"
        onClick={() => setSessionsOpen('total')}
        loading={loading}
      />
      <HomeStatCard
        label="Sessões realizadas hoje"
        value={todaySessionsRatioLabel(todaySessions, todayScheduled)}
        icon={<CalendarIcon />}
        tone="alert"
        hint="Realizadas / agendadas para hoje"
        actionLabel="Ver sessões"
        ariaLabel="Abrir as sessões realizadas hoje"
        onClick={() => setSessionsOpen('today')}
        loading={loading}
      />
      <HomeStatCard
        label="Alertas clínicos"
        value={String(alertCount)}
        icon={<ShieldIcon />}
        tone={alertCount > 0 ? 'alert' : 'mint'}
        hint={alertCount === 0 ? 'Todos os pacientes estáveis' : `${alertCount} precisam de atenção`}
        actionLabel="Ver alertas"
        ariaLabel="Abrir os alertas clínicos"
        onClick={() => setAlertsOpen(true)}
        loading={loading}
      />
    </section>

      <HomeSessionsModal
        isOpen={sessionsOpen === 'total'}
        onClose={() => setSessionsOpen(null)}
        title="Sessões realizadas"
        items={completedSessionItems(data, 'total')}
        totalCount={totalSessions}
      />
      <HomeSessionsModal
        isOpen={sessionsOpen === 'today'}
        onClose={() => setSessionsOpen(null)}
        title="Sessões realizadas hoje"
        items={completedSessionItems(data, 'today')}
        totalCount={todaySessions}
      />
      <ClinicalAlertsModal
        isOpen={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        alerts={alerts}
        error={Boolean(alertsError)}
        onAcknowledge={handleAcknowledge}
        acknowledgingId={acknowledge.isPending ? (acknowledge.variables ?? null) : null}
        removingIds={removingIds}
      />
    </>
  );
}
