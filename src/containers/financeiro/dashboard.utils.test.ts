/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { FinancePatientPlanRow, FinanceReceivableItem } from './financeiro.types';
import {
  buildTrendView,
  clampRate,
  contractMix,
  donutSegments,
  formatCompactCurrency,
  groupReceivablesByCategoria,
  monthLongLabel,
  financeiroPageTitle,
  monthShortLabel,
  previousMonthKey,
  signedDelta,
  statusSlices,
  topPatients,
} from './dashboard.utils';

function receivable(
  partial: Partial<FinanceReceivableItem> & Pick<FinanceReceivableItem, 'id' | 'valor_cents'>,
): FinanceReceivableItem {
  return {
    tipo: 'ENTRADA',
    categoria: 'MENSALIDADE',
    descricao: 'Mensalidade',
    status: 'PAGO',
    data_vencimento: '2026-08-10',
    data_pagamento: '2026-08-10',
    paciente_id: 'p1',
    paciente_nome: 'Ana',
    created_at: '2026-08-01T00:00:00Z',
    ...partial,
  };
}

describe('dashboard.utils', () => {
  it('calcula taxa e variação mês a mês', () => {
    expect(clampRate(2500, 10000)).toBe(25);
    expect(clampRate(10, 0)).toBe(0);
    expect(signedDelta(12000, 10000)).toEqual({ cents: 2000, pct: 20 });
    expect(signedDelta(5000, 0)).toEqual({ cents: 5000, pct: null });
  });

  it('formata mês e moeda compacta', () => {
    expect(monthShortLabel('2026-08')).toBe('ago');
    expect(monthLongLabel('2026-08')).toBe('Agosto de 2026');
    expect(financeiroPageTitle('executivo', '2026-08')).toBe('Financeiro - Visão de Agosto de 2026');
    expect(financeiroPageTitle('recebimentos', '2026-08')).toBe('Financeiro - Receitas');
    expect(financeiroPageTitle('custos', '2026-08')).toBe('Financeiro - Despesas');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(formatCompactCurrency(1_250_000)).toBe('R$ 12,5 mil');
  });

  it('agrupa receitas por categoria e top pacientes', () => {
    const items = [
      receivable({ id: '1', valor_cents: 30000, paciente_id: 'p1', paciente_nome: 'Ana' }),
      receivable({ id: '2', valor_cents: 10000, categoria: 'SESSAO_AVULSA', paciente_id: 'p2', paciente_nome: 'Bia' }),
      receivable({ id: '3', valor_cents: 20000, paciente_id: 'p1', paciente_nome: 'Ana' }),
    ];
    const cats = groupReceivablesByCategoria(items);
    expect(cats[0]).toMatchObject({ key: 'MENSALIDADE', cents: 50000 });
    expect(topPatients(items)[0]).toMatchObject({ label: 'Ana', cents: 50000 });
  });

  it('monta tendência com lucro e fatias de status', () => {
    const trend = buildTrendView([
      { month: '2026-07', receita: 10000, despesa: 4000 },
      { month: '2026-08', receita: 8000, despesa: 9000 },
    ]);
    expect(trend[0]?.lucro).toBe(6000);
    expect(trend[1]?.lucro).toBe(-1000);
    expect(trend[1]?.label).toBe('ago');
    expect(statusSlices(100, 40, 10, { paid: 'Pago', open: 'Aberto', overdue: 'Atrasado' })).toHaveLength(3);
    expect(statusSlices(0, 0, 0, { paid: 'Pago', open: 'Aberto', overdue: 'Atrasado' })).toHaveLength(0);
  });

  it('gera segmentos de donut e mix de contratos', () => {
    const segments = donutSegments([
      { id: 'a', label: 'A', value: 50, color: '#111' },
      { id: 'b', label: 'B', value: 50, color: '#222' },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.d.startsWith('M ')).toBe(true);

    const plans: FinancePatientPlanRow[] = [
      {
        patient_id: '1',
        patient_name: 'Ana',
        sessoes_disponiveis: 0,
        plan: {
          id: 'c1',
          modelo: 'avulso',
          model_type: 'PARTICULAR',
          billing_type: 'MENSAL_RECORRENTE',
          valor_sessao_cents: 10000,
          pacote_qtd_sessoes: null,
          pacote_valor_cents: null,
          observacoes: null,
        },
      },
      {
        patient_id: '2',
        patient_name: 'Bia',
        sessoes_disponiveis: 0,
        plan: null,
      },
    ];
    const mix = contractMix(plans);
    expect(mix.find((row) => row.key === 'MENSAL')?.cents).toBe(1);
    expect(mix.find((row) => row.key === 'SEM_CONTRATO')?.cents).toBe(1);
  });
});
