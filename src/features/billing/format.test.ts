import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, getStatusMeta, planLabel } from './format';

describe('billing/format', () => {
  it('formats cents as BRL currency', () => {
    expect(formatCurrency(29900)).toContain('299,00');
    expect(formatCurrency(0)).toContain('0,00');
  });

  it('handles null/invalid dates gracefully', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('maps invoice status to a label and class', () => {
    expect(getStatusMeta('paid').label).toBe('Paga');
    expect(getStatusMeta('overdue').label).toBe('Vencida');
    expect(getStatusMeta('pending').className).toContain('alert');
  });

  it('resolves plan labels (catálogo v2 + legado)', () => {
    expect(planLabel('free')).toBe('Plano Free');
    expect(planLabel('standard')).toBe('Plano Standard');
    expect(planLabel('advanced')).toBe('Plano Advanced');
    expect(planLabel('premium')).toBe('Plano Premium');
    expect(planLabel('starter')).toBe('Clínica Starter');
    expect(planLabel('professional')).toBe('Clínica Pro');
    expect(planLabel('inicial')).toBe('Plano Standard (legado)');
  });
});
