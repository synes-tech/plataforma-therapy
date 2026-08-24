import { useState } from 'react';
import { formatCurrency } from '@features/billing/format';
import {
  CATEGORIA_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  type FinanceReceivableItem,
} from './financeiro.types';
import { RecordPaymentModal } from './RecordPaymentModal';
import { useReceivables } from './useReceivables';
import {
  RECEIVABLE_FILTERS,
  formatFinanceDate,
  type ReceivableFilter,
} from './receivables.utils';

interface ReceivablesTabProps {
  month: string;
}

export function ReceivablesTab({ month }: ReceivablesTabProps) {
  const [filter, setFilter] = useState<ReceivableFilter>('all');
  const [query, setQuery] = useState('');
  const [payItem, setPayItem] = useState<FinanceReceivableItem | null>(null);
  const { items, summary, previstoCents, receivedCents, openCents, isLoading, isError, error, refetch } =
    useReceivables(month, filter, query);

  const receivedRatio = previstoCents > 0 ? Math.min(100, Math.round((receivedCents / previstoCents) * 100)) : 0;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Previsto no mês"
          hint={`${(summary?.count_a_receber ?? 0) + (summary?.count_atrasado ?? 0) + (summary?.count_pago ?? 0)} títulos`}
          value={formatCurrency(previstoCents)}
          tone="slate"
        />
        <SummaryCard
          label="Recebido"
          hint={`${summary?.count_pago ?? 0} pagos · ${receivedRatio}%`}
          value={formatCurrency(receivedCents)}
          tone="mint"
          active={filter === 'PAGO'}
          onClick={() => setFilter((current) => (current === 'PAGO' ? 'all' : 'PAGO'))}
        />
        <SummaryCard
          label="A receber"
          hint={`${summary?.count_a_receber ?? 0} em aberto`}
          value={formatCurrency(summary?.a_receber_cents ?? 0)}
          tone="amber"
          active={filter === 'PENDENTE'}
          onClick={() => setFilter((current) => (current === 'PENDENTE' ? 'all' : 'PENDENTE'))}
        />
        <SummaryCard
          label="Atrasado"
          hint={`${summary?.count_atrasado ?? 0} vencidos`}
          value={formatCurrency(summary?.atrasado_cents ?? 0)}
          tone="red"
          active={filter === 'ATRASADO'}
          onClick={() => setFilter((current) => (current === 'ATRASADO' ? 'all' : 'ATRASADO'))}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-charcoal-muted">
          <span>Quanto do previsto já entrou</span>
          <span className="font-display font-bold tabular-nums tracking-tight text-charcoal">
            {formatCurrency(receivedCents)} de {formatCurrency(previstoCents)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${receivedRatio}%` }}
          />
        </div>
        {openCents > 0 && (
          <p className="mt-2 text-[11px] text-charcoal-muted">
            Ainda falta {formatCurrency(openCents)} para fechar o mês.
          </p>
        )}
      </div>

      <p className="text-sm text-charcoal-muted">
        Mensalidades, sessões e rendimentos avulsos. Paciente é opcional.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {RECEIVABLE_FILTERS.map((chip) => (
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
          placeholder="Buscar paciente ou descrição"
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
            <p className="text-sm text-error">{(error as Error).message || 'Não foi possível carregar as receitas.'}</p>
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
              const payable = item.status === 'PENDENTE' || item.status === 'ATRASADO';
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">
                      {item.paciente_nome || item.descricao || 'Receita avulsa'}
                    </p>
                    <p className="text-xs text-charcoal-muted">
                      {CATEGORIA_LABEL[item.categoria] ?? item.categoria}
                      {item.paciente_nome && item.descricao ? ` · ${item.descricao}` : ''}
                      {` · vence ${formatFinanceDate(item.data_vencimento)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_BADGE[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <p className="font-display text-sm font-bold tabular-nums tracking-tight text-charcoal">{formatCurrency(item.valor_cents)}</p>
                    {payable && (
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
                  ? 'Nenhuma receita neste mês.'
                  : `Nenhum título ${RECEIVABLE_FILTERS.find((chip) => chip.id === filter)?.label.toLowerCase()}.`}
              </li>
            )}
          </ul>
        )}
      </div>

      <RecordPaymentModal
        item={payItem}
        onClose={() => setPayItem(null)}
        onDone={() => setPayItem(null)}
      />
    </section>
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
  } ${onClick ? 'transition-shadow' : ''}`;

  if (!onClick) {
    return (
      <div className={className}>
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">{label}</p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums tracking-tight text-charcoal">{value}</p>
        <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums tracking-tight text-charcoal">{value}</p>
      <p className="mt-1 text-[11px] text-charcoal-muted">{hint}</p>
    </button>
  );
}
