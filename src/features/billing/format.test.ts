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

  it('resolves plan labels, prioritizing solo as Consultório', () => {
    expect(planLabel('starter')).toBe('Clínica Starter');
    expect(planLabel('professional')).toBe('Clínica Pro');
    expect(planLabel('starter', true)).toBe('Consultório');
  });
});
