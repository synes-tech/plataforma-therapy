import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { FinanceCustosResponse } from './financeiro.types';
import {
  filterExpenses,
  sortExpenses,
  totalExpensesCents,
  type ExpenseFilter,
} from './expenses.utils';

export function useExpenses(month: string, filter: ExpenseFilter, query: string) {
  const custosQuery = useQuery({
    queryKey: ['financeiro-custos', month],
    queryFn: () =>
      callFunction<FinanceCustosResponse>('financeiro-list-transacoes', {
        mode: 'custos',
        month,
      }),
  });

  const summary = custosQuery.data?.summary;
  const templates = custosQuery.data?.templates ?? [];
  const items = useMemo(
    () => sortExpenses(filterExpenses(custosQuery.data?.titulos_mes ?? [], filter, query)),
    [custosQuery.data?.titulos_mes, filter, query],
  );

  return {
    ...custosQuery,
    items,
    templates,
    summary,
    totalCents: totalExpensesCents(summary ?? { a_pagar_cents: 0, atrasado_cents: 0, pago_cents: 0 }),
    paidCents: summary?.pago_cents ?? 0,
    openCents: (summary?.a_pagar_cents ?? 0) + (summary?.atrasado_cents ?? 0),
    fixas: templates.filter((item) => (item.kind ?? 'FIXA') === 'FIXA'),
    parceladas: templates.filter((item) => item.kind === 'VARIAVEL_PARCELADA'),
  };
}
