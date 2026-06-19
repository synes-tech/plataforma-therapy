import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import {
  formatCurrency,
  formatDate,
  formatPeriod,
  getStatusMeta,
  type InvoiceStatus,
} from '@features/billing/format';

interface Invoice {
  id: string;
  invoice_number: string;
  description: string;
  plan_label: string;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
}

interface BillingSummary {
  total_invoices: number;
  total_paid_cents: number;
  open_amount_cents: number;
  has_overdue: boolean;
}

interface BillingData {
  invoices: Invoice[];
  summary: BillingSummary;
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-[11rem] shrink-0 snap-start rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm md:min-w-0">
      <p className="text-xs font-medium text-charcoal-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold tracking-tight ${accent ?? 'text-charcoal'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = getStatusMeta(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function BillingContainer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => callFunction<BillingData>('list-invoices', {}),
  });

  const invoices = data?.invoices ?? [];
  const summary = data?.summary;

  return (
    <div>
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar suas faturas. Tente novamente.
        </div>
      )}

      {/* Resumo */}
      <section aria-label="Resumo financeiro" className="mb-8">
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide snap-x md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
          <SummaryCard
            label="Total pago"
            value={isLoading ? '—' : formatCurrency(summary?.total_paid_cents ?? 0)}
            accent="text-mint-dark"
          />
          <SummaryCard
            label="Em aberto"
            value={isLoading ? '—' : formatCurrency(summary?.open_amount_cents ?? 0)}
            accent={summary?.has_overdue ? 'text-error' : 'text-charcoal'}
          />
          <SummaryCard
            label="Faturas emitidas"
            value={isLoading ? '—' : String(summary?.total_invoices ?? 0)}
          />
        </div>
      </section>

      {/* Lista de faturas */}
      <section aria-labelledby="invoices-title">
        <h2 id="invoices-title" className="mb-4 font-display text-base font-semibold text-charcoal">
          Histórico
        </h2>

        {isLoading ? (
          <ListPageSkeleton rows={3} rowClassName="h-16" />
        ) : invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
            <p className="text-sm text-charcoal-muted">Nenhuma fatura emitida ainda.</p>
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-charcoal-muted">
                    <th className="px-5 py-3 font-medium">Fatura</th>
                    <th className="px-5 py-3 font-medium">Período</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-50 last:border-b-0">
                      <td className="px-5 py-4">
                        <p className="font-medium text-charcoal">{inv.invoice_number}</p>
                        <p className="text-xs text-charcoal-muted">{inv.description}</p>
                      </td>
                      <td className="px-5 py-4 capitalize text-charcoal-muted">
                        {formatPeriod(inv.period_start)}
                      </td>
                      <td className="px-5 py-4 text-charcoal-muted">{formatDate(inv.due_date)}</td>
                      <td className="px-5 py-4 font-medium text-charcoal">
                        {formatCurrency(inv.amount_cents, inv.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="space-y-3 md:hidden">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">{inv.invoice_number}</p>
                      <p className="truncate text-xs text-charcoal-muted">{inv.description}</p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-charcoal-muted">Vencimento</p>
                      <p className="text-xs text-charcoal">{formatDate(inv.due_date)}</p>
                    </div>
                    <p className="font-display text-lg font-bold text-charcoal">
                      {formatCurrency(inv.amount_cents, inv.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
