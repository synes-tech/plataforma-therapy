import type { QueryClient } from '@tanstack/react-query';

export function invalidateFinanceQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['financeiro-receivables'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-transacoes'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-ledger'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-ledger-txs'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-patient-history'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-plans'] });
  void qc.invalidateQueries({ queryKey: ['financeiro-custos'] });
}

export function invalidateFinanceAndAgendaQueries(qc: QueryClient) {
  invalidateFinanceQueries(qc);
  void qc.invalidateQueries({ queryKey: ['calendar'] });
  void qc.invalidateQueries({ queryKey: ['daily-sessions'] });
  void qc.invalidateQueries({ queryKey: ['monthly-summary'] });
  void qc.invalidateQueries({ queryKey: ['range-sessions'] });
  void qc.invalidateQueries({ queryKey: ['list-sessions'] });
}
