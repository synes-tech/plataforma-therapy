/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { FinanceTransacao } from '@containers/financeiro/financeiro.types';
import { buildPatientSessionTimeline, chargeKind, groupHistoryByMonth } from './patient-session-history';

function tx(partial: Partial<FinanceTransacao> & Pick<FinanceTransacao, 'id' | 'categoria' | 'status'>): FinanceTransacao {
  return {
    tipo: 'ENTRADA',
    descricao: partial.descricao ?? 'Lançamento',
    valor_cents: 15000,
    data_vencimento: '2026-08-10',
    data_pagamento: null,
    paciente_id: 'p1',
    created_at: '2026-08-10T10:00:00Z',
    ...partial,
  };
}

describe('patient-session-history', () => {
  it('classifica avulsa, extra e mensalidade', () => {
    expect(chargeKind('SESSAO_AVULSA')).toEqual({ kind: 'avulsa', label: 'Avulsa' });
    expect(chargeKind('SESSAO_MANUAL')).toEqual({ kind: 'extra', label: 'Sessão extra' });
    expect(chargeKind('MENSALIDADE')).toEqual({ kind: 'mensalidade', label: 'Mensalidade' });
  });

  it('monta timeline com badge financeiro e ação de baixa', () => {
    const items = buildPatientSessionTimeline([
      tx({ id: '1', categoria: 'SESSAO_AVULSA', status: 'PENDENTE', descricao: 'Sessão avulsa' }),
      tx({ id: '2', categoria: 'MENSALIDADE', status: 'PAGO', descricao: 'Agosto' }),
    ]);
    const avulsa = items.find((row) => row.id === '1');
    const mensal = items.find((row) => row.id === '2');
    expect(avulsa?.kind).toBe('avulsa');
    expect(avulsa?.payable).toBe(true);
    expect(mensal?.statusLabel).toBe('Pago');
  });

  it('mostra sessão do pacote sem duplicar o título vinculado', () => {
    const items = buildPatientSessionTimeline(
      [tx({ id: 'tx-1', categoria: 'SESSAO_AVULSA', status: 'PAGO' })],
      [
        {
          id: 'c1',
          status_cobranca: 'CONSUMIDO_PACOTE',
          valor_previsto_cents: 0,
          transacao_id: 'tx-1',
          created_at: '2026-08-08T10:00:00Z',
          therapist_schedule: { scheduled_at: '2026-08-08T10:00:00Z', title: 'Sessão de sexta' },
        },
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kindLabel).toBe('Pacote');
    expect(items[0]?.statusLabel).toBe('No pacote');
  });

  it('agrupa por mês', () => {
    const groups = groupHistoryByMonth(
      buildPatientSessionTimeline([
        tx({ id: '1', categoria: 'MENSALIDADE', status: 'PAGO', data_vencimento: '2026-07-10' }),
        tx({ id: '2', categoria: 'SESSAO_AVULSA', status: 'PENDENTE', data_vencimento: '2026-08-10' }),
      ]),
    );
    expect(groups.map((group) => group.monthKey)).toEqual(['2026-08', '2026-07']);
  });
});
