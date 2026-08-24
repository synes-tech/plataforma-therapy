import { formatCurrency } from '@features/billing/format';
import { formatFinanceDate } from './receivables.utils';
import type {
  FinanceCustoTitulo,
  FinanceDashboard,
  FinancePatientPlanRow,
  FinanceReceivableItem,
} from './financeiro.types';
import {
  ChartCard,
  DeltaChip,
  DonutChart,
  HorizontalBars,
  MeterBar,
  TrendBars,
} from './dashboard-charts';
import {
  CHART_PALETTE,
  buildTrendView,
  clampRate,
  contractMix,
  formatCompactCurrency,
  groupExpensesByCategoria,
  groupReceivablesByCategoria,
  previousMonthKey,
  signedDelta,
  statusSlices,
  toDonutSlices,
  topPatients,
} from './dashboard.utils';

interface FinanceiroDashboardProps {
  month: string;
  dash?: FinanceDashboard;
  loading?: boolean;
  receivables: FinanceReceivableItem[];
  receivableSummary?: {
    a_receber_cents: number;
    atrasado_cents: number;
    pago_cents: number;
    count_a_receber: number;
    count_atrasado: number;
    count_pago: number;
  };
  expenses: FinanceCustoTitulo[];
  expenseSummary?: {
    a_pagar_cents: number;
    atrasado_cents: number;
    pago_cents: number;
    count_a_pagar: number;
    count_atrasado: number;
    count_pago: number;
  };
  plans: FinancePatientPlanRow[];
  onGoReceitas: () => void;
  onGoClassificar: () => void;
  onGoDespesas: () => void;
  onGoPlanos: () => void;
}

export function FinanceiroDashboard({
  month,
  dash,
  loading,
  receivables,
  receivableSummary,
  expenses,
  expenseSummary,
  plans,
  onGoReceitas,
  onGoClassificar,
  onGoDespesas,
  onGoPlanos,
}: FinanceiroDashboardProps) {
  const realizada = receivableSummary?.pago_cents ?? dash?.receita_realizada_cents ?? 0;
  const aReceber = receivableSummary?.a_receber_cents ?? 0;
  const atrasado = receivableSummary?.atrasado_cents ?? dash?.alertas.inadimplentes_total_cents ?? 0;
  const previstoReceita = realizada + aReceber + atrasado;
  const projetada = dash?.receita_projetada_cents ?? 0;

  const despesasPagas = expenseSummary?.pago_cents ?? dash?.despesas_cents ?? 0;
  const aPagar = expenseSummary?.a_pagar_cents ?? 0;
  const despesasAtrasadas = expenseSummary?.atrasado_cents ?? 0;
  const previstoDespesa = despesasPagas + aPagar + despesasAtrasadas;
  const lucro = realizada - despesasPagas;
  const margem = clampRate(Math.max(0, lucro), realizada);

  const trend = buildTrendView(dash?.tendencia ?? []);
  const previous = trend.find((point) => point.month === previousMonthKey(month));
  const receitaDelta = signedDelta(realizada, previous?.receita ?? 0);
  const despesaDelta = signedDelta(despesasPagas, previous?.despesa ?? 0);
  const lucroDelta = signedDelta(lucro, previous?.lucro ?? 0);

  const receitaSlices = statusSlices(realizada, aReceber, atrasado, {
    paid: 'Recebido',
    open: 'A receber',
    overdue: 'Atrasado',
  });
  const despesaSlices = statusSlices(despesasPagas, aPagar, despesasAtrasadas, {
    paid: 'Pago',
    open: 'A pagar',
    overdue: 'Atrasado',
  });
  const origemSlices = toDonutSlices(groupReceivablesByCategoria(receivables));
  const contratoSlices = toDonutSlices(contractMix(plans), [
    CHART_PALETTE.primary,
    CHART_PALETTE.ai,
    CHART_PALETTE.mint,
    CHART_PALETTE.alert,
    CHART_PALETTE.slate,
  ]);

  const overdueReceivables = receivables
    .filter((item) => item.status === 'ATRASADO')
    .sort((a, b) => (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? ''))
    .slice(0, 5);
  const upcomingPayables = expenses
    .filter((item) => item.status === 'PENDENTE' || item.status === 'ATRASADO')
    .sort((a, b) => (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? ''))
    .slice(0, 5);

  if (loading && !dash) {
    return <DashboardSkeleton />;
  }

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receita realizada"
          value={formatCurrency(realizada)}
          hint={`${receivableSummary?.count_pago ?? 0} entradas pagas`}
          delta={receitaDelta}
          tone="mint"
        />
        <KpiCard
          label="Receita projetada"
          value={formatCurrency(projetada)}
          hint="Agenda × valores de contrato"
        />
        <KpiCard
          label="Despesas pagas"
          value={formatCurrency(despesasPagas)}
          hint={`${expenseSummary?.count_pago ?? 0} saídas baixadas`}
          delta={despesaDelta}
        />
        <KpiCard
          label="Lucro líquido"
          value={formatCurrency(lucro)}
          hint={`Margem ${margem}% sobre o recebido`}
          delta={lucroDelta}
          emphasize
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Saúde do caixa no mês"
          hint="Quanto já entrou, o que ainda falta e o que já saiu."
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <MeterBar
              label={`Realizado da agenda (${formatCompactCurrency(realizada)} de ${formatCompactCurrency(projetada || previstoReceita)})`}
              value={realizada}
              max={projetada || previstoReceita}
              color={CHART_PALETTE.primary}
            />
            <MeterBar
              label={`Recebido do previsto em receitas (${formatCompactCurrency(realizada)} de ${formatCompactCurrency(previstoReceita)})`}
              value={realizada}
              max={previstoReceita}
              color={CHART_PALETTE.mint}
            />
            <MeterBar
              label={`Despesas já pagas (${formatCompactCurrency(despesasPagas)} de ${formatCompactCurrency(previstoDespesa)})`}
              value={despesasPagas}
              max={previstoDespesa}
              color={CHART_PALETTE.slate}
            />
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F8FAF9] p-3 text-center">
              <MiniStat label="A receber" value={formatCompactCurrency(aReceber)} tone="alert" />
              <MiniStat label="Inadimplente" value={formatCompactCurrency(atrasado)} tone="error" />
              <MiniStat label="A pagar" value={formatCompactCurrency(aPagar + despesasAtrasadas)} tone="slate" />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Resultado" hint="Recebido menos saídas pagas.">
          <div className="flex h-full min-h-0 flex-col justify-between gap-4">
            <div className="shrink-0">
              <p className="font-display text-3xl font-bold tabular-nums tracking-tight text-charcoal">{formatCurrency(lucro)}</p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {lucro >= 0 ? 'O mês fecha positivo no realizado.' : 'As saídas pagas superam o recebido.'}
              </p>
            </div>
            <div className="shrink-0 space-y-3">
              <CompositionRow label="Entradas" value={realizada} max={Math.max(realizada, despesasPagas, 1)} color={CHART_PALETTE.mint} />
              <CompositionRow label="Saídas" value={despesasPagas} max={Math.max(realizada, despesasPagas, 1)} color="#CBD5E1" />
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Receitas do mês" hint="Pago, em aberto e atrasado.">
          <DonutChart slices={receitaSlices} centerLabel="Previsto" centerValue={formatCompactCurrency(previstoReceita)} />
        </ChartCard>
        <ChartCard title="Despesas do mês" hint="O que já saiu e o que ainda vence.">
          <DonutChart slices={despesaSlices} centerLabel="Previsto" centerValue={formatCompactCurrency(previstoDespesa)} />
        </ChartCard>
        <ChartCard title="Origem das receitas" hint="Por categoria de lançamento.">
          <DonutChart
            slices={origemSlices}
            centerLabel="Mix"
            centerValue={`${origemSlices.length} tipos`}
            emptyLabel="Nenhuma receita lançada neste mês."
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Tendência dos últimos 6 meses"
        hint="Barras de entradas e saídas pagas. A linha verde é o lucro de cada mês."
      >
        <TrendBars points={trend} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Despesas por categoria" hint="Onde o consultório mais gasta.">
          <HorizontalBars
            rows={groupExpensesByCategoria(expenses)}
            emptyLabel="Nenhuma despesa neste mês."
            color={CHART_PALETTE.slate}
          />
        </ChartCard>
        <ChartCard title="Maiores receitas por paciente" hint="Quem mais contribui no mês.">
          <HorizontalBars
            rows={topPatients(receivables)}
            emptyLabel="Ainda não há receitas vinculadas a pacientes."
            color={CHART_PALETTE.primary}
          />
        </ChartCard>
        <ChartCard title="Carteira de contratos" hint="Como os pacientes estão contratados.">
          <DonutChart
            slices={contratoSlices}
            centerLabel="Pacientes"
            centerValue={String(plans.length)}
            emptyLabel="Nenhum paciente na carteira."
          />
          <button
            type="button"
            onClick={onGoPlanos}
            className="mt-4 text-xs font-medium text-primary hover:underline"
          >
            Ver pacientes e planos
          </button>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <button
          type="button"
          onClick={onGoClassificar}
          className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-primary/30"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">Sessões a classificar</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight text-charcoal">{dash?.alertas.sessoes_sem_status ?? 0}</p>
          <p className="mt-1 text-xs text-charcoal-muted">
            {formatCurrency(dash?.alertas.sessoes_sem_status_total_cents ?? 0)} ainda sem status de cobrança
          </p>
        </button>
        <button
          type="button"
          onClick={onGoReceitas}
          className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-red-200"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">Inadimplência</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight text-charcoal">{dash?.alertas.inadimplentes ?? 0}</p>
          <p className="mt-1 text-xs text-charcoal-muted">
            {formatCurrency(dash?.alertas.inadimplentes_total_cents ?? 0)} em títulos atrasados
          </p>
        </button>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">A pagar em 7 dias</p>
          <ul className="mt-3 space-y-2">
            {(dash?.alertas.vencimentos_7d ?? []).length === 0 ? (
              <li className="text-xs text-charcoal-muted">Nenhum vencimento próximo.</li>
            ) : (
              (dash?.alertas.vencimentos_7d ?? []).slice(0, 4).map((item) => (
                <li key={item.id} className="flex justify-between gap-2 text-xs text-charcoal">
                  <span className="truncate">{item.descricao || 'Despesa'}</span>
                  <span className="shrink-0 font-display text-xs font-bold tabular-nums tracking-tight">{formatCurrency(item.valor_cents)}</span>
                </li>
              ))
            )}
          </ul>
          <button type="button" onClick={onGoDespesas} className="mt-3 text-xs font-medium text-primary hover:underline">
            Ir para despesas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Títulos atrasados" hint="Receitas vencidas que ainda não entraram.">
          {overdueReceivables.length === 0 ? (
            <p className="py-6 text-sm text-charcoal-muted">Nenhum título atrasado neste mês.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdueReceivables.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">{item.paciente_nome || item.descricao}</p>
                    <p className="text-[11px] text-charcoal-muted">Venceu {formatFinanceDate(item.data_vencimento)}</p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold tabular-nums tracking-tight text-red-700">{formatCurrency(item.valor_cents)}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onGoReceitas} className="mt-3 text-xs font-medium text-primary hover:underline">
            Abrir receitas
          </button>
        </ChartCard>
        <ChartCard title="Próximas saídas" hint="Despesas em aberto, da mais urgente.">
          {upcomingPayables.length === 0 ? (
            <p className="py-6 text-sm text-charcoal-muted">Nenhuma despesa em aberto neste mês.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingPayables.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">{item.descricao || 'Despesa'}</p>
                    <p className="text-[11px] text-charcoal-muted">
                      {item.status === 'ATRASADO' ? 'Atrasada · ' : ''}
                      {formatFinanceDate(item.data_vencimento)}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold tabular-nums tracking-tight text-charcoal">{formatCurrency(item.valor_cents)}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onGoDespesas} className="mt-3 text-xs font-medium text-primary hover:underline">
            Abrir despesas
          </button>
        </ChartCard>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  delta,
  tone,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: { cents: number; pct: number | null };
  tone?: 'mint';
  emphasize?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        emphasize ? 'border-primary/20 bg-primary-50/50' : 'border-slate-100 bg-white'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight ${tone === 'mint' ? 'text-mint-dark' : 'text-charcoal'}`}>{value}</p>
      <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
      {delta ? <div className="mt-2"><DeltaChip cents={delta.cents} pct={delta.pct} /></div> : null}
    </article>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'alert' | 'error' | 'slate';
}) {
  const color =
    tone === 'alert' ? 'text-amber-800' : tone === 'error' ? 'text-red-700' : 'text-charcoal';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-charcoal-muted">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-bold tabular-nums tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function CompositionRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-charcoal-muted">{label}</span>
        <span className="font-display text-xs font-bold tabular-nums tracking-tight text-charcoal">{formatCompactCurrency(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando visão financeira">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-56 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
        <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
