import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { PageHeader } from '@containers/layout';
import { StandardModal } from '@shared/ui/StandardModal';
import type {
  FinanceDashboard,
  FinancePatientPlanRow,
  FinanceReceivableItem,
  FinanceTransacao,
  PendingSessionItem,
  PaymentPrompt,
} from './financeiro.types';
import {
  BILLING_TYPE_LABEL,
  CATEGORIA_LABEL,
  MODEL_TYPE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from './financeiro.types';
import { invalidateFinanceQueries } from './invalidate-finance';
import { SessionPaymentModal } from './SessionPaymentModal';
import { CustosMensaisTab } from './CustosMensaisTab';
import { ReceivablesTab } from './ReceivablesTab';
import { SessionsToClassifyTab } from './SessionsToClassifyTab';
import { AvulsoSessionModal } from './AvulsoSessionModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ExpenseFormModal, EMPTY_EXPENSE_FORM } from './ExpenseFormModal';
import type { ExpenseFormValues } from './expense-form.schema';
import { IncomeFormModal } from './IncomeFormModal';
import { PatientFinancialSetupModal } from '@containers/patient/PatientFinancialSetupModal';
import { FinanceiroDashboard } from './FinanceiroDashboard';
import { FinanceiroTabs, type FinanceiroTabKey } from './FinanceiroTabs';
import { financeiroPageTitle } from './dashboard.utils';
import { useReceivables } from './useReceivables';
import { useExpenses } from './useExpenses';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinanceiroContainer() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<FinanceiroTabKey>('executivo');
  const [month, setMonth] = useState(currentMonth());
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentPrompt, setPaymentPrompt] = useState<PaymentPrompt | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormValues>(EMPTY_EXPENSE_FORM);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [contractModal, setContractModal] = useState<{
    patientId: string;
    patientName: string;
  } | null>(null);
  const [avulsoModal, setAvulsoModal] = useState<{
    patientId: string;
    patientName: string;
    suggestedCents: number;
    monthly: boolean;
  } | null>(null);
  const [payItem, setPayItem] = useState<FinanceReceivableItem | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['financeiro-dashboard', month, tab === 'classificar'],
    queryFn: () =>
      callFunction<FinanceDashboard & { pending_items?: PendingSessionItem[] }>(
        'financeiro-get-dashboard',
        { month, include_pending_items: tab === 'classificar' },
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
    enabled: tab === 'extrato',
  });

  const receivablesOverview = useReceivables(month, 'all', '');
  const expensesOverview = useExpenses(month, 'all', '');

  const pendingItems = dashboardQuery.data?.pending_items ?? [];

  const plansQuery = useQuery({
    queryKey: ['financeiro-plans'],
    queryFn: () => callFunction<{ items: FinancePatientPlanRow[] }>('financeiro-list-patient-plans', {}),
    enabled: tab === 'planos' || tab === 'executivo',
  });

  const dash = dashboardQuery.data;

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title={financeiroPageTitle(tab, month)}
        subtitle="Caixa, receitas, despesas e contratos do consultório."
        actions={
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <label className="flex items-center gap-2 text-xs text-charcoal-muted">
              <span className="lg:hidden">Mês</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Mês"
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => setChooserOpen(true)}
              className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 lg:h-9 lg:text-xs lg:font-semibold"
            >
              Novo lançamento
            </button>
          </div>
        }
      />

      <div className="mt-4 space-y-6 pb-6 sm:mt-6 lg:mt-8 lg:pb-8">
      <FinanceiroTabs
        active={tab}
        onChange={setTab}
        pendingCount={dash?.alertas.sessoes_sem_status ?? 0}
      />

      {tab === 'executivo' && (
        <FinanceiroDashboard
          month={month}
          dash={dash}
          loading={dashboardQuery.isLoading || receivablesOverview.isLoading || expensesOverview.isLoading}
          receivables={receivablesOverview.items}
          receivableSummary={receivablesOverview.summary}
          expenses={expensesOverview.items}
          expenseSummary={expensesOverview.summary}
          plans={plansQuery.data?.items ?? []}
          onGoReceitas={() => setTab('recebimentos')}
          onGoClassificar={() => setTab('classificar')}
          onGoDespesas={() => setTab('custos')}
          onGoPlanos={() => setTab('planos')}
        />
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
                { value: 'PENDENTE', label: 'A receber' },
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
                      {t.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} · {STATUS_LABEL[t.status] ?? t.status}
                      {t.paciente_nome ? ` · ${t.paciente_nome}` : ''}
                      {t.categoria ? ` · ${CATEGORIA_LABEL[t.categoria] ?? t.categoria}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[t.status]}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <p
                      className={`font-display text-sm font-bold tabular-nums tracking-tight ${
                        t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-charcoal'
                      }`}
                    >
                      {t.tipo === 'ENTRADA' ? '+' : '-'}
                      {formatCurrency(t.valor_cents)}
                    </p>
                    {t.tipo === 'ENTRADA' && (t.status === 'PENDENTE' || t.status === 'ATRASADO') && (
                      <button
                        type="button"
                        onClick={() => setPayItem(t)}
                        className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Dar baixa
                      </button>
                    )}
                  </div>
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
        <ReceivablesTab month={month} />
      )}

      {tab === 'classificar' && (
        <SessionsToClassifyTab
          items={pendingItems}
          loading={dashboardQuery.isLoading}
          onConfirmSession={setPaymentPrompt}
        />
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
                      ? `${MODEL_TYPE_LABEL[row.plan.model_type ?? 'PARTICULAR']} · ${
                          BILLING_TYPE_LABEL[row.plan.billing_type ?? (row.plan.modelo === 'pacote' ? 'PACOTE' : 'AVULSO')]
                        } · ${formatCurrency(row.plan.valor_acordado_cents ?? row.plan.valor_sessao_cents)}`
                      : 'Sem contrato financeiro'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-medium text-primary">
                    Saldo: {row.sessoes_disponiveis} sessão(ões)
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setAvulsoModal({
                        patientId: row.patient_id,
                        patientName: row.patient_name,
                        suggestedCents: row.plan?.valor_sessao_cents ?? row.plan?.valor_acordado_cents ?? 0,
                        monthly: row.plan?.billing_type === 'MENSAL_RECORRENTE',
                      })
                    }
                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-charcoal hover:bg-slate-50"
                  >
                    Sessão extra
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContractModal({ patientId: row.patient_id, patientName: row.patient_name });
                    }}
                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-charcoal hover:bg-slate-50"
                  >
                    Editar dados financeiros
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>

      <StandardModal
        isOpen={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Novo lançamento"
      >
        <div className="space-y-3">
          <p className="text-sm text-charcoal-muted">
            Escolha o tipo. O formulário é o mesmo das abas Receitas e Despesas.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setChooserOpen(false);
                setIncomeOpen(true);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left hover:border-primary/30"
            >
              <span className="block text-sm font-medium text-charcoal">Receita</span>
              <span className="mt-0.5 block text-xs text-charcoal-muted">
                Rendimento extra ou outro valor a receber, com ou sem paciente.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setChooserOpen(false);
                setExpenseForm({
                  ...EMPTY_EXPENSE_FORM,
                  kind: 'FIXA',
                  categoria: 'CUSTO_FIXO',
                });
                setExpenseOpen(true);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left hover:border-primary/30"
            >
              <span className="block text-sm font-medium text-charcoal">Despesa</span>
              <span className="mt-0.5 block text-xs text-charcoal-muted">
                Fixa, parcelada ou pontual — o mesmo fluxo de Nova despesa.
              </span>
            </button>
          </div>
        </div>
      </StandardModal>

      <ExpenseFormModal
        isOpen={expenseOpen}
        value={expenseForm}
        onChange={(patch) => setExpenseForm((current) => ({ ...current, ...patch }))}
        onClose={() => setExpenseOpen(false)}
      />

      <IncomeFormModal isOpen={incomeOpen} onClose={() => setIncomeOpen(false)} />

      <PatientFinancialSetupModal
        isOpen={Boolean(contractModal)}
        patientId={contractModal?.patientId ?? null}
        patientName={contractModal?.patientName}
        onClose={() => setContractModal(null)}
      />

      <AvulsoSessionModal
        isOpen={Boolean(avulsoModal)}
        patientId={avulsoModal?.patientId ?? ''}
        patientName={avulsoModal?.patientName}
        suggestedCents={avulsoModal?.suggestedCents ?? 0}
        monthlyContract={avulsoModal?.monthly}
        onClose={() => setAvulsoModal(null)}
        onDone={() => setAvulsoModal(null)}
      />

      <RecordPaymentModal
        item={payItem}
        onClose={() => setPayItem(null)}
        onDone={() => {
          setPayItem(null);
          invalidateFinanceQueries(qc);
        }}
      />

      <SessionPaymentModal
        prompt={paymentPrompt}
        onClose={() => setPaymentPrompt(null)}
        onDone={() => {
          setPaymentPrompt(null);
          invalidateFinanceQueries(qc);
        }}
      />
    </div>
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

