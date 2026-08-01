import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import type {
  FinanceDashboard,
  FinancePatientPlanRow,
  FinanceTransacao,
  PendingSessionItem,
} from './financeiro.types';
import { MODELO_LABEL, reaisInputToCents } from './financeiro.types';
import { SessionPaymentModal } from './SessionPaymentModal';
import { CustosMensaisTab } from './CustosMensaisTab';
import type { PaymentPrompt } from './financeiro.types';

type TabKey = 'executivo' | 'extrato' | 'recebimentos' | 'custos' | 'planos';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinanceiroContainer() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('executivo');
  const [month, setMonth] = useState(currentMonth());
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentPrompt, setPaymentPrompt] = useState<PaymentPrompt | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    tipo: 'SAIDA' as 'ENTRADA' | 'SAIDA',
    categoria: 'CUSTO_FIXO',
    descricao: '',
    valor: '',
    status: 'PAGO' as const,
  });

  const dashboardQuery = useQuery({
    queryKey: ['financeiro-dashboard', month, tab === 'recebimentos'],
    queryFn: () =>
      callFunction<FinanceDashboard & { pending_items?: PendingSessionItem[] }>(
        'financeiro-get-dashboard',
        { month, include_pending_items: tab === 'recebimentos' || tab === 'executivo' },
      ),
  });

  const txsQuery = useQuery({
    queryKey: ['financeiro-transacoes', month, tipoFilter, statusFilter],
    queryFn: () =>
      callFunction<{ items: FinanceTransacao[] }>('financeiro-list-transacoes', {
        month,
        tipo: tipoFilter || undefined,
        status: statusFilter || undefined,
      }),
    enabled: tab === 'extrato' || tab === 'executivo',
  });

  const pendingItems = dashboardQuery.data?.pending_items ?? [];

  const plansQuery = useQuery({
    queryKey: ['financeiro-plans'],
    queryFn: () => callFunction<{ items: FinancePatientPlanRow[] }>('financeiro-list-patient-plans', {}),
    enabled: tab === 'planos',
  });

  const upsertTx = useMutation({
    mutationFn: () =>
      callFunction('financeiro-upsert-transacao', {
        tipo: txForm.tipo,
        categoria: txForm.categoria,
        descricao: txForm.descricao,
        valor_cents: reaisInputToCents(txForm.valor),
        status: txForm.status,
      }),
    onSuccess: () => {
      setTxModalOpen(false);
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
      qc.invalidateQueries({ queryKey: ['financeiro-transacoes'] });
    },
  });

  const dash = dashboardQuery.data;
  const maxTrend = useMemo(() => {
    const vals = (dash?.tendencia ?? []).flatMap((t) => [t.receita, t.despesa]);
    return Math.max(1, ...vals);
  }, [dash]);

  const tabs: { id: TabKey; label: string }[] = [
    { id: 'executivo', label: 'Visão geral' },
    { id: 'extrato', label: 'Extrato' },
    { id: 'recebimentos', label: 'Recebimentos' },
    { id: 'custos', label: 'Custos' },
    { id: 'planos', label: 'Pacientes & planos' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium text-charcoal">Financeiro</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Controle de receitas, despesas e recebimentos de sessões.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-charcoal-muted">
            Mês
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => setTxModalOpen(true)}
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
          >
            Nova lançamento
          </button>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/80 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {(tab === 'executivo') && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Receita projetada"
              value={formatCurrency(dash?.receita_projetada_cents ?? 0)}
              hint="Agenda × valores"
            />
            <MetricCard
              label="Receita realizada"
              value={formatCurrency(dash?.receita_realizada_cents ?? 0)}
              hint="Entradas pagas"
            />
            <MetricCard
              label="Despesas"
              value={formatCurrency(dash?.despesas_cents ?? 0)}
              hint="Saídas pagas"
            />
            <MetricCard
              label="Lucro líquido"
              value={formatCurrency(dash?.lucro_liquido_cents ?? 0)}
              hint="Realizada − despesas"
              emphasize
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 lg:col-span-2">
              <h2 className="text-sm font-medium text-charcoal">Tendência (6 meses)</h2>
              <div className="mt-4 flex h-40 items-end gap-2">
                {(dash?.tendencia ?? []).map((t) => (
                  <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-28 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-2 rounded-t bg-primary/80"
                        style={{ height: `${(t.receita / maxTrend) * 100}%` }}
                        title={`Receita ${formatCurrency(t.receita)}`}
                      />
                      <div
                        className="w-2 rounded-t bg-slate-300"
                        style={{ height: `${(t.despesa / maxTrend) * 100}%` }}
                        title={`Despesa ${formatCurrency(t.despesa)}`}
                      />
                    </div>
                    <span className="text-[10px] text-charcoal-muted">{t.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-100 bg-[#F8FAF9] p-4">
              <h2 className="text-sm font-medium text-charcoal">Alertas</h2>
              <AlertRow
                title="Sessões sem status"
                body={`${dash?.alertas.sessoes_sem_status ?? 0} sessões · ${formatCurrency(dash?.alertas.sessoes_sem_status_total_cents ?? 0)}`}
                onClick={() => setTab('recebimentos')}
              />
              <AlertRow
                title="Inadimplência"
                body={`${dash?.alertas.inadimplentes ?? 0} títulos · ${formatCurrency(dash?.alertas.inadimplentes_total_cents ?? 0)}`}
                onClick={() => {
                  setStatusFilter('ATRASADO');
                  setTab('extrato');
                }}
              />
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-medium text-charcoal">A pagar (7 dias)</p>
                <ul className="mt-2 space-y-1.5">
                  {(dash?.alertas.vencimentos_7d ?? []).length === 0 && (
                    <li className="text-xs text-charcoal-muted">Nenhum vencimento próximo.</li>
                  )}
                  {(dash?.alertas.vencimentos_7d ?? []).map((v) => (
                    <li key={v.id} className="flex justify-between gap-2 text-xs text-charcoal">
                      <span className="truncate">{v.descricao || 'Despesa'}</span>
                      <span className="shrink-0 font-medium">{formatCurrency(v.valor_cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'extrato' && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <SelectChip
              value={tipoFilter}
              onChange={setTipoFilter}
              options={[
                { value: '', label: 'Todos tipos' },
                { value: 'ENTRADA', label: 'Entradas' },
                { value: 'SAIDA', label: 'Saídas' },
              ]}
            />
            <SelectChip
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'Todos status' },
                { value: 'PAGO', label: 'Pago' },
                { value: 'PENDENTE', label: 'Pendente' },
                { value: 'ATRASADO', label: 'Atrasado' },
              ]}
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <ul className="divide-y divide-slate-100">
              {(txsQuery.data?.items ?? []).map((t) => (
                <li key={t.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">
                      {t.descricao || t.categoria}
                    </p>
                    <p className="text-xs text-charcoal-muted">
                      {t.tipo} · {t.status}
                      {t.paciente_nome ? ` · ${t.paciente_nome}` : ''}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-charcoal'
                    }`}
                  >
                    {t.tipo === 'ENTRADA' ? '+' : '-'}
                    {formatCurrency(t.valor_cents)}
                  </p>
                </li>
              ))}
              {(txsQuery.data?.items ?? []).length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-charcoal-muted">
                  Nenhuma transação neste filtro.
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {tab === 'recebimentos' && (
        <section className="space-y-3">
          <p className="text-sm text-charcoal-muted">
            Sessões que passaram do horário sem confirmação de realização/pagamento.
          </p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {pendingItems.map((item) => (
              <li key={item.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{item.patient_name}</p>
                    <p className="text-xs text-charcoal-muted">
                      {item.schedule?.scheduled_at
                        ? new Date(item.schedule.scheduled_at).toLocaleString('pt-BR')
                        : 'Horário não informado'}
                      {' · '}
                      {MODELO_LABEL[(item.modelo as keyof typeof MODELO_LABEL) ?? 'avulso'] ?? item.modelo}
                      {item.sessoes_disponiveis > 0
                        ? ` · saldo pacote: ${item.sessoes_disponiveis}`
                        : ''}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-charcoal">
                    {formatCurrency(item.valor_previsto_cents)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentPrompt({
                        schedule_id: item.schedule_id,
                        patient_id: item.patient_id,
                        patient_name: item.patient_name,
                        modelo: item.modelo,
                        saldo_sessoes: item.sessoes_disponiveis,
                        valor_sugerido_cents: item.valor_previsto_cents,
                        pode_consumir_pacote: item.sessoes_disponiveis > 0,
                      })
                    }
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Confirmar pagamento
                  </button>
                </div>
              </li>
            ))}
            {pendingItems.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-charcoal-muted">
                Nenhuma sessão pendente. Tudo em dia.
              </li>
            )}
          </ul>
        </section>
      )}

      {tab === 'custos' && <CustosMensaisTab month={month} />}

      {tab === 'planos' && (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <ul className="divide-y divide-slate-100">
            {(plansQuery.data?.items ?? []).map((row) => (
              <li key={row.patient_id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-charcoal">{row.patient_name}</p>
                  <p className="text-xs text-charcoal-muted">
                    {row.plan
                      ? `${MODELO_LABEL[row.plan.modelo]} · sessão ${formatCurrency(row.plan.valor_sessao_cents)}${
                          row.plan.modelo === 'pacote' && row.plan.pacote_valor_cents != null
                            ? ` · pacote ${formatCurrency(row.plan.pacote_valor_cents)} (${row.plan.pacote_qtd_sessoes}x)`
                            : ''
                        }`
                      : 'Sem plano comercial definido'}
                  </p>
                </div>
                <p className="text-xs font-medium text-primary">
                  Saldo: {row.sessoes_disponiveis} sessão(ões)
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <StandardModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="Novo lançamento"
        footer={
          <>
            <button
              type="button"
              onClick={() => setTxModalOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              loading={upsertTx.isPending}
              onClick={() => upsertTx.mutate()}
            >
              Salvar
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tipo">
            <select
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={txForm.tipo}
              onChange={(e) =>
                setTxForm((f) => ({
                  ...f,
                  tipo: e.target.value as 'ENTRADA' | 'SAIDA',
                  categoria: e.target.value === 'ENTRADA' ? 'RENDIMENTO_EXTRA' : 'CUSTO_FIXO',
                }))
              }
            >
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
          </Field>
          <Field label="Categoria">
            <select
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={txForm.categoria}
              onChange={(e) => setTxForm((f) => ({ ...f, categoria: e.target.value }))}
            >
              {txForm.tipo === 'ENTRADA' ? (
                <>
                  <option value="RENDIMENTO_EXTRA">Rendimento extra</option>
                  <option value="SESSAO_AVULSA">Sessão avulsa</option>
                  <option value="PACOTE">Pacote</option>
                  <option value="OUTROS">Outros</option>
                </>
              ) : (
                <>
                  <option value="CUSTO_FIXO">Custo fixo</option>
                  <option value="CUSTO_VARIAVEL">Custo variável</option>
                  <option value="IMPOSTO">Impostos</option>
                  <option value="REPASSE_PROFISSIONAL">Repasse profissional</option>
                  <option value="OUTROS">Outros</option>
                </>
              )}
            </select>
          </Field>
          <Field label="Descrição">
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={txForm.descricao}
              onChange={(e) => setTxForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: Aluguel do consultório"
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={txForm.valor}
              onChange={(e) => setTxForm((f) => ({ ...f, valor: e.target.value }))}
              placeholder="150,00"
              inputMode="decimal"
            />
          </Field>
        </div>
      </StandardModal>

      <SessionPaymentModal
        prompt={paymentPrompt}
        onClose={() => setPaymentPrompt(null)}
        onDone={() => {
          setPaymentPrompt(null);
          qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
          qc.invalidateQueries({ queryKey: ['financeiro-transacoes'] });
        }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        emphasize ? 'border-primary/20 bg-primary-50/60' : 'border-slate-100 bg-white'
      }`}
    >
      <p className="text-xs font-medium text-charcoal-muted">{label}</p>
      <p className="mt-1 font-serif text-xl text-charcoal">{value}</p>
      <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
    </div>
  );
}

function AlertRow({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-primary/30"
    >
      <p className="text-xs font-medium text-charcoal">{title}</p>
      <p className="mt-0.5 text-xs text-charcoal-muted">{body}</p>
    </button>
  );
}

function SelectChip({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs text-charcoal"
    >
      {options.map((o) => (
        <option key={o.value || 'all'} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      {children}
    </div>
  );
}
