export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'canceled' | 'refunded';

export function formatCurrency(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format((cents ?? 0) / 100);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

export function formatPeriod(start: string, _end?: string): string {
  const s = new Date(start);
  const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' });
  if (Number.isNaN(s.getTime())) return '—';
  return fmt.format(s).replace('.', '');
}

interface StatusMeta {
  label: string;
  className: string;
}

export function getStatusMeta(status: InvoiceStatus): StatusMeta {
  const map: Record<InvoiceStatus, StatusMeta> = {
    paid: { label: 'Paga', className: 'bg-mint-50 text-mint-dark' },
    pending: { label: 'Pendente', className: 'bg-alert-bg text-alert' },
    overdue: { label: 'Vencida', className: 'bg-error-light text-error' },
    canceled: { label: 'Cancelada', className: 'bg-slate-100 text-charcoal-muted' },
    refunded: { label: 'Reembolsada', className: 'bg-ai-50 text-ai' },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-charcoal-muted' };
}

export const PLAN_LABEL_MAP: Record<string, string> = {
  consultorio: 'Consultório',
  starter: 'Clínica Starter',
  professional: 'Clínica Pro',
  enterprise: 'Enterprise',
};

export function planLabel(plan: string, isSolo = false): string {
  if (isSolo) return 'Consultório';
  return PLAN_LABEL_MAP[plan] ?? plan;
}
