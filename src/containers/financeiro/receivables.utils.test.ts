/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { FinanceReceivableItem, FinanceReceivablesResponse } from './financeiro.types';
import {
  applyReceivablePaid,
  filterReceivables,
  previstoCents,
  sortReceivables,
  summarizeReceivables,
} from './receivables.utils';

function item(partial: Partial<FinanceReceivableItem> & Pick<FinanceReceivableItem, 'id' | 'status' | 'valor_cents'>): FinanceReceivableItem {
  return {
    tipo: 'ENTRADA',
    categoria: 'MENSALIDADE',
    descricao: 'Mensalidade',
    data_vencimento: '2026-08-10',
    data_pagamento: null,
    paciente_id: 'p1',
    paciente_nome: 'Ana',
    created_at: '2026-08-01T00:00:00Z',
    ...partial,
  };
}

describe('receivables.utils', () => {
  it('soma previsto como aberto + recebido', () => {
    const summary = summarizeReceivables([
      item({ id: '1', status: 'PENDENTE', valor_cents: 10000 }),
      item({ id: '2', status: 'ATRASADO', valor_cents: 20000 }),
      item({ id: '3', status: 'PAGO', valor_cents: 30000 }),
    ]);
    expect(previstoCents(summary)).toBe(60000);
    expect(summary.pago_cents).toBe(30000);
  });

  it('filtra por status e busca', () => {
    const rows = [
      item({ id: '1', status: 'PENDENTE', valor_cents: 10000, paciente_nome: 'Ana' }),
      item({ id: '2', status: 'PAGO', valor_cents: 20000, paciente_nome: 'Bruno' }),
    ];
    expect(filterReceivables(rows, 'PENDENTE', '').map((row) => row.id)).toEqual(['1']);
    expect(filterReceivables(rows, 'all', 'bru').map((row) => row.id)).toEqual(['2']);
  });

  it('ordena atrasado antes de a receber e pago', () => {
    const sorted = sortReceivables([
      item({ id: 'pago', status: 'PAGO', valor_cents: 1 }),
      item({ id: 'atrasado', status: 'ATRASADO', valor_cents: 1 }),
      item({ id: 'pendente', status: 'PENDENTE', valor_cents: 1 }),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['atrasado', 'pendente', 'pago']);
  });

  it('baixa otimista move o título para pago e recalcula totais', () => {
    const data: FinanceReceivablesResponse = {
      mode: 'receivables',
      month: '2026-08',
      items: [
        item({ id: '1', status: 'PENDENTE', valor_cents: 15000 }),
        item({ id: '2', status: 'PAGO', valor_cents: 20000 }),
      ],
      summary: summarizeReceivables([
        item({ id: '1', status: 'PENDENTE', valor_cents: 15000 }),
        item({ id: '2', status: 'PAGO', valor_cents: 20000 }),
      ]),
    };
    const next = applyReceivablePaid(data, '1', '2026-08-14');
    expect(next.items.find((row) => row.id === '1')?.status).toBe('PAGO');
    expect(next.summary.pago_cents).toBe(35000);
    expect(next.summary.a_receber_cents).toBe(0);
  });
});
