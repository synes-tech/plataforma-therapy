import type { FinanceReceivableItem, FinanceReceivablesResponse, FinanceStatus } from './financeiro.types';

export type ReceivableFilter = 'all' | 'PENDENTE' | 'PAGO' | 'ATRASADO';

export const RECEIVABLE_FILTERS: { id: ReceivableFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'PENDENTE', label: 'A receber' },
  { id: 'PAGO', label: 'Recebidas' },
  { id: 'ATRASADO', label: 'Atrasadas' },
];

const STATUS_RANK: Record<FinanceStatus, number> = {
  ATRASADO: 0,
  PENDENTE: 1,
  PAGO: 2,
  CANCELADO: 3,
};

export function summarizeReceivables(items: FinanceReceivableItem[]) {
  const sum = (status: FinanceStatus) =>
    items.filter((item) => item.status === status).reduce((acc, item) => acc + Number(item.valor_cents), 0);
  const count = (status: FinanceStatus) => items.filter((item) => item.status === status).length;
  return {
    a_receber_cents: sum('PENDENTE'),
    atrasado_cents: sum('ATRASADO'),
    pago_cents: sum('PAGO'),
    count_a_receber: count('PENDENTE'),
    count_atrasado: count('ATRASADO'),
    count_pago: count('PAGO'),
  };
}

export function previstoCents(summary: {
  a_receber_cents: number;
  atrasado_cents: number;
  pago_cents: number;
}): number {
  return summary.a_receber_cents + summary.atrasado_cents + summary.pago_cents;
}

export function filterReceivables(
  items: FinanceReceivableItem[],
  filter: ReceivableFilter,
  query: string,
): FinanceReceivableItem[] {
  const byStatus = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const term = query.trim().toLowerCase();
  if (!term) return byStatus;
  return byStatus.filter((item) =>
    `${item.paciente_nome ?? ''} ${item.descricao} ${item.categoria}`.toLowerCase().includes(term),
  );
}

export function sortReceivables(items: FinanceReceivableItem[]): FinanceReceivableItem[] {
  return [...items].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return (a.data_vencimento ?? a.created_at).localeCompare(b.data_vencimento ?? b.created_at);
  });
}

export function applyReceivablePaid(
  data: FinanceReceivablesResponse,
  id: string,
  paidOn: string,
  valorCents?: number,
): FinanceReceivablesResponse {
  const items = data.items.map((item) =>
    item.id === id
      ? {
          ...item,
          status: 'PAGO' as const,
          data_pagamento: paidOn,
          valor_cents: valorCents ?? item.valor_cents,
        }
      : item,
  );
  return { ...data, items, summary: summarizeReceivables(items) };
}

export function formatFinanceDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
