import type { FinanceDemoItem, FinanceDemoStatus } from './landing-content';

export type FinanceDemoFilter = 'all' | FinanceDemoStatus;

export function formatFinanceDemoCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function filterFinanceDemoItems(
  items: FinanceDemoItem[],
  filter: FinanceDemoFilter,
): FinanceDemoItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.status === filter);
}

export function registerFinanceDemoPayment(items: FinanceDemoItem[], id: string): FinanceDemoItem[] {
  return items.map((item) => (item.id === id ? { ...item, status: 'PAGO' } : item));
}

export function financeDemoKpis(items: FinanceDemoItem[]) {
  const paid = items.filter((item) => item.status === 'PAGO');
  const pending = items.filter((item) => item.status === 'PENDENTE');
  const overdue = items.filter((item) => item.status === 'ATRASADO');
  const realizadaCents = paid.reduce((sum, item) => sum + item.amountCents, 0);
  const aReceberCents = pending.reduce((sum, item) => sum + item.amountCents, 0);
  const atrasadoCents = overdue.reduce((sum, item) => sum + item.amountCents, 0);
  const previstoCents = realizadaCents + aReceberCents + atrasadoCents;

  return {
    realizadaCents,
    aReceberCents,
    atrasadoCents,
    previstoCents,
    receivedPercent: previstoCents > 0 ? Math.round((realizadaCents / previstoCents) * 100) : 0,
    paidCount: paid.length,
    pendingCount: pending.length,
    overdueCount: overdue.length,
  };
}

export function nextFinanceHighlight(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index + 1) % count;
}

export function toggleFinanceDemoFilter(
  current: FinanceDemoFilter,
  next: FinanceDemoStatus,
): FinanceDemoFilter {
  return current === next ? 'all' : next;
}
