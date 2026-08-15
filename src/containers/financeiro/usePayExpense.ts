import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { FinanceCustoTitulo, FinanceCustosResponse } from './financeiro.types';
import { applyExpensePaid } from './expenses.utils';
import { invalidateFinanceQueries } from './invalidate-finance';

interface PayExpenseInput {
  item: FinanceCustoTitulo;
  paidOn: string;
  forma: 'pix' | 'cartao' | 'dinheiro' | 'boleto' | 'outro';
}

export function usePayExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ item, paidOn, forma }: PayExpenseInput) =>
      callFunction('financeiro-upsert-transacao', {
        action: 'baixar_despesa',
        id: item.id,
        data_pagamento: paidOn,
        forma_pagamento: forma,
      }),
    onMutate: async ({ item, paidOn }) => {
      await qc.cancelQueries({ queryKey: ['financeiro-custos'] });
      const snapshots = qc.getQueriesData<FinanceCustosResponse>({ queryKey: ['financeiro-custos'] });
      for (const [key, data] of snapshots) {
        if (data) qc.setQueryData(key, applyExpensePaid(data, item.id, paidOn));
      }
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      invalidateFinanceQueries(qc);
    },
  });
}
