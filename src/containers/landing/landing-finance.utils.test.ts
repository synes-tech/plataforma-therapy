import { describe, expect, it } from 'vitest';
import { FEATURES, FINANCE_DEMO } from './landing-content';
import {
  filterFinanceDemoItems,
  financeDemoKpis,
  formatFinanceDemoCurrency,
  nextFinanceHighlight,
  registerFinanceDemoPayment,
  toggleFinanceDemoFilter,
} from './landing-finance.utils';

describe('módulo financeiro da landing', () => {
  it('apresenta receitas e honorários com um painel demonstrativo', () => {
    const slide = FEATURES.find((feature) => feature.id === 'financeiro');
    expect(slide?.eyebrow).toBe('Módulo financeiro');
    expect(slide?.description).toMatch(/honorário/i);
    expect(slide?.points).toHaveLength(3);
    expect(FINANCE_DEMO.items).toHaveLength(5);
  });

  it('filtra títulos e registra o pagamento do honorário', () => {
    const pending = filterFinanceDemoItems(FINANCE_DEMO.items, 'PENDENTE');
    expect(pending.map((item) => item.patient)).toEqual(['Sofia R.', 'Helena C.']);

    const afterPay = registerFinanceDemoPayment(FINANCE_DEMO.items, 'sofia');
    expect(afterPay.find((item) => item.id === 'sofia')?.status).toBe('PAGO');
    expect(financeDemoKpis(afterPay).paidCount).toBe(3);
  });

  it('calcula o caixa do mês e formata em reais', () => {
    const kpis = financeDemoKpis(FINANCE_DEMO.items);
    expect(kpis.realizadaCents).toBe(72000);
    expect(kpis.aReceberCents).toBe(90000);
    expect(kpis.atrasadoCents).toBe(54000);
    expect(kpis.receivedPercent).toBe(33);
    expect(formatFinanceDemoCurrency(54000)).toBe('R$\u00a0540,00');
  });

  it('alterna o filtro ao repetir o clique e cicla o destaque', () => {
    expect(toggleFinanceDemoFilter('all', 'PAGO')).toBe('PAGO');
    expect(toggleFinanceDemoFilter('PAGO', 'PAGO')).toBe('all');
    expect(nextFinanceHighlight(4, 5)).toBe(0);
    expect(nextFinanceHighlight(0, 0)).toBe(0);
  });
});
