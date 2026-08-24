import { formatCurrency } from '@features/billing/format';
import { DashboardKpiCard } from './DashboardKpiCard';
import type { BriefingData } from './dashboard.types';
import { inboxCount, occupancyHint, withSummaryDefaults } from './home.utils';

interface DashboardPulseProps {
  data?: BriefingData;
  loading?: boolean;
  canFinance: boolean;
}

export function DashboardPulse({ data, loading, canFinance }: DashboardPulseProps) {
  const summary = withSummaryDefaults(data?.summary);
  const pending = inboxCount(data, canFinance);
  const received = data?.finance?.received_cents ?? 0;
  const overdue = data?.finance?.overdue_cents ?? 0;

  return (
    <section aria-label="Pulso do dia" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DashboardKpiCard
        label="Sessões hoje"
        value={String(summary.sessions_today)}
        hint={
          summary.sessions_today === 0
            ? 'Nenhum atendimento na agenda'
            : `${summary.sessions_today === 1 ? '1 horário' : `${summary.sessions_today} horários`} no dia`
        }
        to="/calendar"
        ariaLabel="Abrir agenda de hoje"
        loading={loading}
      />
      <DashboardKpiCard
        label="Ocupação da semana"
        value={`${summary.occupancy_pct}%`}
        hint={occupancyHint(summary.occupancy_pct, summary.sessions_this_week)}
        to="/calendar"
        ariaLabel="Abrir agenda da semana"
        loading={loading}
      />
      <DashboardKpiCard
        label="Pendências"
        value={String(pending)}
        hint={pending === 0 ? 'Nada em aberto agora' : 'Crises, evoluções e vínculos'}
        tone={pending > 0 ? 'alert' : 'default'}
        to="/patients"
        ariaLabel="Ver pendências dos pacientes"
        loading={loading}
      />
      {canFinance ? (
        <DashboardKpiCard
          label="Recebido no mês"
          value={formatCurrency(received)}
          hint={overdue > 0 ? `${formatCurrency(overdue)} em atraso` : 'Nenhum título atrasado'}
          tone={overdue > 0 ? 'error' : 'mint'}
          to="/financeiro"
          ariaLabel="Abrir financeiro"
          loading={loading}
        />
      ) : (
        <DashboardKpiCard
          label="Pacientes ativos"
          value={String(summary.active_patients_count)}
          hint={
            summary.family_unlinked_count > 0
              ? `${summary.family_unlinked_count} sem família no app`
              : 'Carteira em acompanhamento'
          }
          to="/patients"
          ariaLabel="Ver pacientes ativos"
          loading={loading}
        />
      )}
    </section>
  );
}
