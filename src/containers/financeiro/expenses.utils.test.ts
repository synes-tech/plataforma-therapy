/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { FinanceCustoTitulo, FinanceCustosResponse } from './financeiro.types';
import {
  applyExpensePaid,
  filterExpenses,
  installmentProgress,
  sortExpenses,
  summarizeExpenses,
  totalExpensesCents,
} from './expenses.utils';
import { EMPTY_EXPENSE_FORM, validateExpenseForm } from './expense-form.schema';
import { lastInstallmentLabel } from './expense-preview';

function item(
  partial: Partial<FinanceCustoTitulo> & Pick<FinanceCustoTitulo, 'id' | 'status' | 'valor_cents'>,
): FinanceCustoTitulo {
  return {
    tipo: 'SAIDA',
    categoria: 'CUSTO_FIXO',
    descricao: 'Aluguel',
    data_vencimento: '2026-08-10',
    data_pagamento: null,
    paciente_id: null,
    created_at: '2026-08-01T00:00:00Z',
    ...partial,
  };
}

describe('expenses.utils', () => {
  it('soma o total do mês e o que já foi pago', () => {
    const summary = summarizeExpenses([
      item({ id: '1', status: 'PENDENTE', valor_cents: 10000 }),
      item({ id: '2', status: 'ATRASADO', valor_cents: 20000 }),
      item({ id: '3', status: 'PAGO', valor_cents: 30000 }),
    ]);
    expect(totalExpensesCents(summary)).toBe(60000);
    expect(summary.pago_cents).toBe(30000);
  });

  it('filtra e ordena atrasadas primeiro', () => {
    const rows = [
      item({ id: 'pago', status: 'PAGO', valor_cents: 1, descricao: 'Internet' }),
      item({ id: 'atrasado', status: 'ATRASADO', valor_cents: 1, descricao: 'Aluguel' }),
    ];
    expect(filterExpenses(rows, 'PENDENTE', '')).toHaveLength(0);
    expect(filterExpenses(rows, 'all', 'alu').map((row) => row.id)).toEqual(['atrasado']);
    expect(sortExpenses(rows).map((row) => row.id)).toEqual(['atrasado', 'pago']);
  });

  it('mostra parcela 3 de 12 a partir do label ou dos campos', () => {
    expect(installmentProgress({ parcela_label: '3/12' })?.label).toBe('Parcela 3 de 12');
    expect(installmentProgress({ installment_current: 2, installment_total: 10 })?.label).toBe(
      'Parcela 2 de 10',
    );
    expect(installmentProgress({ installment_total: 1, installment_current: 1 })).toBeNull();
  });

  it('baixa otimista move a conta para pago', () => {
    const data: FinanceCustosResponse = {
      mode: 'custos',
      month: '2026-08',
      templates: [],
      titulos_mes: [item({ id: '1', status: 'PENDENTE', valor_cents: 15000 })],
      summary: summarizeExpenses([item({ id: '1', status: 'PENDENTE', valor_cents: 15000 })]),
    };
    const next = applyExpensePaid(data, '1', '2026-08-14');
    expect(next.titulos_mes.find((row) => row.id === '1')?.status).toBe('PAGO');
    expect(next.summary?.pago_cents).toBe(15000);
  });
});

describe('expense-form.schema', () => {
  it('bloqueia despesa sem descrição e valor', () => {
    expect(validateExpenseForm(EMPTY_EXPENSE_FORM).valid).toBe(false);
  });

  it('parcelada exige quantidade entre 2 e 60', () => {
    expect(
      validateExpenseForm({
        ...EMPTY_EXPENSE_FORM,
        kind: 'VARIAVEL_PARCELADA',
        descricao: 'Notebook',
        valor: '200,00',
        months_total: '1',
      }).valid,
    ).toBe(false);
    expect(
      validateExpenseForm({
        ...EMPTY_EXPENSE_FORM,
        kind: 'VARIAVEL_PARCELADA',
        descricao: 'Notebook',
        valor: '200,00',
        months_total: '12',
        starts_on: '2026-08',
      }).valid,
    ).toBe(true);
  });

  it('calcula o mês da última parcela', () => {
    expect(lastInstallmentLabel('2026-08-01', 12)).toMatch(/2027/);
  });
});
