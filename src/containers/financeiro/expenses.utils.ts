import type { FinanceCustoTitulo, FinanceCustosResponse, FinanceStatus } from './financeiro.types';

export type ExpenseFilter = 'all' | 'PENDENTE' | 'PAGO' | 'ATRASADO';

export const EXPENSE_FILTERS: { id: ExpenseFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'PENDENTE', label: 'A pagar' },
  { id: 'PAGO', label: 'Pagas' },
  { id: 'ATRASADO', label: 'Atrasadas' },
];

const STATUS_RANK: Record<FinanceStatus, number> = {
  ATRASADO: 0,
  PENDENTE: 1,
  PAGO: 2,
  CANCELADO: 3,
};

export function summarizeExpenses(items: FinanceCustoTitulo[]) {
  const sum = (status: FinanceStatus) =>
    items.filter((item) => item.status === status).reduce((acc, item) => acc + Number(item.valor_cents), 0);
  const count = (status: FinanceStatus) => items.filter((item) => item.status === status).length;
  return {
    a_pagar_cents: sum('PENDENTE'),
    atrasado_cents: sum('ATRASADO'),
    pago_cents: sum('PAGO'),
    count_a_pagar: count('PENDENTE'),
    count_atrasado: count('ATRASADO'),
    count_pago: count('PAGO'),
  };
}

export function totalExpensesCents(summary: {
  a_pagar_cents: number;
  atrasado_cents: number;
  pago_cents: number;
}): number {
  return summary.a_pagar_cents + summary.atrasado_cents + summary.pago_cents;
}

export function filterExpenses(
  items: FinanceCustoTitulo[],
  filter: ExpenseFilter,
  query: string,
): FinanceCustoTitulo[] {
  const byStatus = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const term = query.trim().toLowerCase();
  if (!term) return byStatus;
  return byStatus.filter((item) => `${item.descricao} ${item.categoria}`.toLowerCase().includes(term));
}

export function sortExpenses(items: FinanceCustoTitulo[]): FinanceCustoTitulo[] {
  return [...items].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return (a.data_vencimento ?? a.created_at).localeCompare(b.data_vencimento ?? b.created_at);
  });
}

export function applyExpensePaid(
  data: FinanceCustosResponse,
  id: string,
  paidOn: string,
): FinanceCustosResponse {
  const titulos_mes = data.titulos_mes.map((item) =>
    item.id === id ? { ...item, status: 'PAGO' as const, data_pagamento: paidOn } : item,
  );
  return { ...data, titulos_mes, summary: summarizeExpenses(titulos_mes) };
}

export function installmentProgress(item: {
  parcela_label?: string | null;
  installment_current?: number | null;
  installment_total?: number | null;
}): { current: number; total: number; label: string } | null {
  const current = item.installment_current ?? Number(item.parcela_label?.split('/')[0]);
  const total = item.installment_total ?? Number(item.parcela_label?.split('/')[1]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) return null;
  return { current, total, label: `Parcela ${current} de ${total}` };
}
