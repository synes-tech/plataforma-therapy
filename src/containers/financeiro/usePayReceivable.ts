import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { FinanceReceivableItem, FinanceReceivablesResponse, FinanceStatus } from './financeiro.types';
import { invalidateFinanceQueries } from './invalidate-finance';
import { applyReceivablePaid } from './receivables.utils';

interface PayReceivableInput {
  item: FinanceReceivableItem;
  paidOn: string;
  forma: 'pix' | 'cartao' | 'dinheiro' | 'outro';
}

export function usePayReceivable() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ item, paidOn, forma }: PayReceivableInput) =>
      callFunction('financeiro-upsert-transacao', {
        action: 'baixar_recebivel',
        id: item.id,
        data_pagamento: paidOn,
        forma_pagamento: forma,
      }),
    onMutate: async ({ item, paidOn }) => {
      await qc.cancelQueries({ queryKey: ['financeiro-receivables'] });
      const snapshots = qc.getQueriesData<FinanceReceivablesResponse>({ queryKey: ['financeiro-receivables'] });
      for (const [key, data] of snapshots) {
        if (data) qc.setQueryData(key, applyReceivablePaid(data, item.id, paidOn));
      }

      const ledgerSnapshots = qc.getQueriesData<{
        transacoes?: Array<{ id: string; status: FinanceStatus; data_pagamento: string | null }>;
      }>({ queryKey: ['financeiro-ledger-txs'] });
      for (const [key, data] of ledgerSnapshots) {
        if (!data?.transacoes) continue;
        qc.setQueryData(key, {
          ...data,
          transacoes: data.transacoes.map((row) =>
            row.id === item.id ? { ...row, status: 'PAGO' as const, data_pagamento: paidOn } : row,
          ),
        });
      }

      const historySnapshots = qc.getQueriesData<{
        transacoes?: Array<{ id: string; status: FinanceStatus; data_pagamento: string | null }>;
      }>({ queryKey: ['financeiro-patient-history'] });
      for (const [key, data] of historySnapshots) {
        if (!data?.transacoes) continue;
        qc.setQueryData(key, {
          ...data,
          transacoes: data.transacoes.map((row) =>
            row.id === item.id ? { ...row, status: 'PAGO' as const, data_pagamento: paidOn } : row,
          ),
        });
      }

      return { snapshots, ledgerSnapshots, historySnapshots };
    },
    onError: (_error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      context?.ledgerSnapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      context?.historySnapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      invalidateFinanceQueries(qc);
    },
  });
}
