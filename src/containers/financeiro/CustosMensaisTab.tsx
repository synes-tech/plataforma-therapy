import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import type { FinanceCustoRecorrente, FinanceCustoTitulo, FinanceExpenseKind } from './financeiro.types';
import {
  EXPENSE_KIND_LABEL,
  EXPENSE_STATUS_LABEL,
  STATUS_BADGE,
  centsToInputReais,
} from './financeiro.types';
import { PayExpenseModal } from './PayExpenseModal';
import { ExpenseFormModal, EMPTY_EXPENSE_FORM } from './ExpenseFormModal';
import type { ExpenseFormValues } from './expense-form.schema';
import { useExpenses } from './useExpenses';
import { EXPENSE_FILTERS, installmentProgress, type ExpenseFilter } from './expenses.utils';
import { formatFinanceDate } from './receivables.utils';
import { invalidateFinanceQueries } from './invalidate-finance';

interface CustosMensaisTabProps {
  month: string;
}

export function CustosMensaisTab({ month }: CustosMensaisTabProps) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ExpenseFilter>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<ExpenseFormValues>(EMPTY_EXPENSE_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [payItem, setPayItem] = useState<FinanceCustoTitulo | null>(null);

  const {
    items,
    summary,
    totalCents,
    paidCents,
    openCents,
    fixas,
    parceladas,
    isLoading,
    isError,
    error,
    refetch,
  } = useExpenses(month, filter, query);

  const paidRatio = totalCents > 0 ? Math.min(100, Math.round((paidCents / totalCents) * 100)) : 0;

  const toggleCusto = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      callFunction('financeiro-upsert-transacao', {
        action: 'toggle_custo',
        id,
        ativo,
      }),
    onSuccess: () => invalidateFinanceQueries(qc),
  });

  const openCreate = (kind: FinanceExpenseKind = 'FIXA') => {
    setForm({
      ...EMPTY_EXPENSE_FORM,
      kind,
      categoria: kind === 'FIXA' ? 'CUSTO_FIXO' : kind === 'VARIAVEL_PARCELADA' ? 'DESPESA_PARCELADA' : 'DESPESA_PONTUAL',
    });
    setModalOpen(true);
  };

  const openEdit = (item: FinanceCustoRecorrente) => {
    setForm({
      ...EMPTY_EXPENSE_FORM,
      id: item.id,
      kind: item.kind ?? 'FIXA',
      descricao: item.descricao,
      valor: centsToInputReais(item.valor_cents),
      dia_vencimento: String(item.dia_vencimento),
      starts_on: item.starts_on ? item.starts_on.slice(0, 7) : EMPTY_EXPENSE_FORM.starts_on,
      months_total: item.months_total ? String(item.months_total) : '12',
      categoria: item.categoria,
      observacoes: item.observacoes ?? '',
    });
    setModalOpen(true);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">Despesas</h2>
          <p className="mt-0.5 text-sm text-charcoal-muted">
            Fixa todo mês, parcelada no cartão ou pontual. O lucro do mês usa o que você baixar aqui.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate('FIXA')}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
        >
          Nova despesa
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total no mês"
          hint={`${(summary?.count_a_pagar ?? 0) + (summary?.count_atrasado ?? 0) + (summary?.count_pago ?? 0)} contas`}
          value={formatCurrency(totalCents)}
          tone="slate"
        />
        <SummaryCard
          label="Pago"
          hint={`${summary?.count_pago ?? 0} baixadas · ${paidRatio}%`}
          value={formatCurrency(paidCents)}
          tone="mint"
          active={filter === 'PAGO'}
          onClick={() => setFilter((current) => (current === 'PAGO' ? 'all' : 'PAGO'))}
        />
        <SummaryCard
          label="A pagar"
          hint={`${summary?.count_a_pagar ?? 0} em aberto`}
          value={formatCurrency(summary?.a_pagar_cents ?? 0)}
          tone="amber"
          active={filter === 'PENDENTE'}
          onClick={() => setFilter((current) => (current === 'PENDENTE' ? 'all' : 'PENDENTE'))}
        />
        <SummaryCard
          label="Atrasado"
          hint={`${summary?.count_atrasado ?? 0} vencidas`}
          value={formatCurrency(summary?.atrasado_cents ?? 0)}
          tone="red"
          active={filter === 'ATRASADO'}
          onClick={() => setFilter((current) => (current === 'ATRASADO' ? 'all' : 'ATRASADO'))}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-charcoal-muted">
          <span>Quanto do mês já saiu do caixa</span>
          <span className="font-medium text-charcoal">
            {formatCurrency(paidCents)} de {formatCurrency(totalCents)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${paidRatio}%` }}
          />
        </div>
        {openCents > 0 && (
          <p className="mt-2 text-[11px] text-charcoal-muted">
            Ainda falta pagar {formatCurrency(openCents)}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`h-9 rounded-full px-3 text-xs font-medium ${
                filter === chip.id
                  ? 'bg-primary text-white'
                  : 'border border-slate-200 bg-white text-charcoal hover:border-primary/30'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <input
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 sm:max-w-xs"
          placeholder="Buscar descrição"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        {isLoading && (
          <div className="space-y-3 px-4 py-4" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {isError && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-error">{(error as Error).message || 'Não foi possível carregar as despesas.'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 text-xs font-medium text-primary hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const canPay = item.status === 'PENDENTE' || item.status === 'ATRASADO';
              const parcela = installmentProgress(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-charcoal">{item.descricao}</p>
                      {parcela && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-charcoal-muted">
                          {parcela.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-charcoal-muted">
                      Vence {formatFinanceDate(item.data_vencimento)}
                      {item.categoria ? ` · ${item.categoria.replace(/_/g, ' ').toLowerCase()}` : ''}
                    </p>
                    {parcela && (
                      <div className="mt-2 h-1.5 max-w-[160px] overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.min(100, (parcela.current / parcela.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_BADGE[item.status]}`}>
                      {EXPENSE_STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    <p className="text-sm font-semibold text-charcoal">{formatCurrency(item.valor_cents)}</p>
                    {canPay && (
                      <button
                        type="button"
                        onClick={() => setPayItem(item)}
                        className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-white hover:bg-primary-dark"
                      >
                        Confirmar pagamento
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-charcoal-muted">
                {filter === 'all'
                  ? 'Nenhuma despesa neste mês.'
                  : `Nenhuma conta ${EXPENSE_FILTERS.find((chip) => chip.id === filter)?.label.toLowerCase()}.`}
              </li>
            )}
          </ul>
        )}
      </div>

      <TemplateList
        title="Custos fixos"
        empty="Nenhum aluguel, internet ou custo mensal cadastrado."
        items={fixas}
        onEdit={openEdit}
        onToggle={(id, ativo) => toggleCusto.mutate({ id, ativo })}
        toggling={toggleCusto.isPending}
      />

      <TemplateList
        title="Parcelamentos"
        empty="Nenhuma compra ou empréstimo parcelado."
        items={parceladas}
        onEdit={openEdit}
        onToggle={(id, ativo) => toggleCusto.mutate({ id, ativo })}
        toggling={toggleCusto.isPending}
      />

      <ExpenseFormModal
        isOpen={modalOpen}
        value={form}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onClose={() => {
          setModalOpen(false);
          setForm(EMPTY_EXPENSE_FORM);
        }}
      />

      <PayExpenseModal item={payItem} onClose={() => setPayItem(null)} onDone={() => setPayItem(null)} />
    </section>
  );
}

function TemplateList({
  title,
  empty,
  items,
  onEdit,
  onToggle,
  toggling,
}: {
  title: string;
  empty: string;
  items: FinanceCustoRecorrente[];
  onEdit: (item: FinanceCustoRecorrente) => void;
  onToggle: (id: string, ativo: boolean) => void;
  toggling: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-charcoal">{title}</h3>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        {items.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-charcoal-muted">{empty}</li>
        )}
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-charcoal">
                {item.descricao}
                {!item.ativo && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    Pausado
                  </span>
                )}
              </p>
              <p className="text-xs text-charcoal-muted">
                {item.kind === 'VARIAVEL_PARCELADA'
                  ? `${item.months_total}× ${formatCurrency(item.valor_cents)} · até ${item.ends_on ?? '—'}`
                  : `Todo dia ${item.dia_vencimento} · ${formatCurrency(item.valor_cents)}`}
                {item.kind ? ` · ${EXPENSE_KIND_LABEL[item.kind]}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-slate-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onToggle(item.id, !item.ativo)}
                disabled={toggling}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal-muted hover:bg-slate-50"
              >
                {item.ativo ? 'Pausar' : 'Reativar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({
  label,
  hint,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  value: string;
  tone: 'amber' | 'red' | 'mint' | 'slate';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50/70',
    red: 'border-red-200 bg-red-50/70',
    mint: 'border-emerald-200 bg-emerald-50/70',
    slate: 'border-slate-100 bg-white',
  };
  const className = `rounded-2xl border p-4 text-left ${tones[tone]} ${
    active ? 'ring-2 ring-primary/30' : ''
  }`;

  if (!onClick) {
    return (
      <div className={className}>
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">{label}</p>
        <p className="mt-1 font-serif text-xl text-charcoal">{value}</p>
        <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">{label}</p>
      <p className="mt-1 font-serif text-xl text-charcoal">{value}</p>
      <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
    </button>
  );
}
