import { Link } from 'react-router-dom';
import { formatCurrency } from '@features/billing/format';
import { SkeletonBlock } from '@containers/loading';
import type { BriefingData } from './dashboard.types';
import {
  financeNetCents,
  financeOverdueCents,
  financeReceivableCents,
  financeReceivedCents,
} from './home-layout.utils';

interface HomeFinanceStripProps {
  data?: BriefingData;
  loading?: boolean;
}

function FinanceMiniCard({
  label,
  cents,
  tone = 'default',
  loading,
}: {
  label: string;
  cents: number;
  tone?: 'default' | 'mint' | 'alert' | 'error';
  loading?: boolean;
}) {
  const valueClass = {
    default: 'text-charcoal',
    mint: 'text-mint-dark',
    alert: 'text-alert',
    error: 'text-error',
  }[tone];

  return (
    <article className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">{label}</p>
      {loading ? (
        <SkeletonBlock className="mt-2 h-7 w-24 rounded-md" />
      ) : (
        <p className={`mt-1.5 font-display text-xl font-bold tabular-nums tracking-tight ${valueClass}`}>
          {formatCurrency(cents)}
        </p>
      )}
    </article>
  );
}

export function HomeFinanceStrip({ data, loading }: HomeFinanceStripProps) {
  const received = financeReceivedCents(data);
  const receivable = financeReceivableCents(data);
  const overdue = financeOverdueCents(data);
  const net = financeNetCents(data);

  return (
    <section aria-labelledby="home-finance-title" className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id="home-finance-title" className="font-display text-sm font-semibold text-charcoal">
          Visão financeira
        </h2>
        <Link
          to="/financeiro"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-primary px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Abrir financeiro
        </Link>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <FinanceMiniCard label="Recebidos" cents={received} tone="mint" loading={loading} />
        <FinanceMiniCard label="A receber" cents={receivable} loading={loading} />
        <FinanceMiniCard label="Vencido" cents={overdue} tone={overdue > 0 ? 'error' : 'default'} loading={loading} />
        <FinanceMiniCard label="Saldo líquido" cents={net} tone={net < 0 ? 'error' : 'mint'} loading={loading} />
      </div>
    </section>
  );
}
