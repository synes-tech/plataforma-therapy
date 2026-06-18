/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  addonMonthlyPriceCents,
  backupUsagePercent,
  clampPacks,
  nextPacks,
  quantityFromPacks,
} from './billing-addon.utils';

describe('billing-addon.utils', () => {
  it('stepper avança em pacotes de 5', () => {
    expect(quantityFromPacks(1)).toBe(5);
    expect(quantityFromPacks(2)).toBe(10);
    expect(nextPacks(1, 1)).toBe(2);
    expect(nextPacks(1, -1)).toBe(1);
    expect(clampPacks(99)).toBe(10);
  });

  it('calcula preço mensal do add-on', () => {
    expect(addonMonthlyPriceCents(1, 1990)).toBe(1990);
    expect(addonMonthlyPriceCents(2, 1990)).toBe(3980);
  });

  it('calcula percentual de uso do backup', () => {
    expect(backupUsagePercent(14, 15)).toBe(93);
    expect(backupUsagePercent(0, 0)).toBe(0);
    expect(backupUsagePercent(3, 0)).toBe(100);
  });
});
