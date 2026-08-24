import { Link } from 'react-router-dom';
import { ListPageSkeleton } from '@containers/loading';
import type { InboxItem } from './dashboard.types';

const TONE = {
  alert: 'border-l-alert bg-alert-bg/40',
  primary: 'border-l-primary bg-primary-50/50',
  error: 'border-l-error bg-red-50/70',
  slate: 'border-l-slate-300 bg-slate-50/80',
} as const;

const KIND_LABEL = {
  crisis: 'Crise',
  note: 'Evolução',
  classify: 'Caixa',
  family: 'Família',
  overdue: 'Atraso',
} as const;

interface DashboardInboxCardProps {
  items: InboxItem[];
  loading?: boolean;
}

export function DashboardInboxCard({ items, loading }: DashboardInboxCardProps) {
  return (
    <section id="inbox" className="scroll-mt-24 lg:col-span-4" aria-labelledby="inbox-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="inbox-title" className="font-display text-base font-semibold text-charcoal">
          Pendências
        </h2>
        {items.length > 0 ? (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
            {items.length}
          </span>
        ) : null}
      </div>

      {loading ? (
        <ListPageSkeleton rows={3} rowClassName="h-12" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-charcoal">Nada em aberto</p>
          <p className="mt-1 text-sm text-charcoal-muted">Crises, evoluções e vínculos aparecem aqui.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={`flex items-center justify-between gap-3 rounded-xl border border-slate-100 border-l-[3px] px-3 py-2.5 transition-colors hover:border-primary/25 ${TONE[item.tone]}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">{item.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-charcoal-muted">
                    {KIND_LABEL[item.kind]} · {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-primary">Abrir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
