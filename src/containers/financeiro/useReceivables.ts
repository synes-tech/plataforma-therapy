import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { FinanceReceivablesResponse } from './financeiro.types';
import {
  filterReceivables,
  previstoCents,
  sortReceivables,
  type ReceivableFilter,
} from './receivables.utils';

export function useReceivables(month: string, filter: ReceivableFilter, query: string) {
  const receivablesQuery = useQuery({
    queryKey: ['financeiro-receivables', month],
    queryFn: () =>
      callFunction<FinanceReceivablesResponse>('financeiro-list-transacoes', {
        mode: 'receivables',
        month,
      }),
  });

  const summary = receivablesQuery.data?.summary;
  const items = useMemo(
    () => sortReceivables(filterReceivables(receivablesQuery.data?.items ?? [], filter, query)),
    [receivablesQuery.data?.items, filter, query],
  );

  return {
    ...receivablesQuery,
    items,
    summary,
    previstoCents: previstoCents(summary ?? { a_receber_cents: 0, atrasado_cents: 0, pago_cents: 0 }),
    receivedCents: summary?.pago_cents ?? 0,
    openCents: (summary?.a_receber_cents ?? 0) + (summary?.atrasado_cents ?? 0),
  };
}
