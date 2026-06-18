export const BACKUP_PACK_SIZE = 5;
export const BACKUP_MAX_PACKS = 10;
export const BACKUP_PRICE_CENTS_PER_PACK = 1990;

export function packsFromQuantity(quantity: number): number {
  return quantity / BACKUP_PACK_SIZE;
}

export function quantityFromPacks(packs: number): number {
  return packs * BACKUP_PACK_SIZE;
}

export function clampPacks(packs: number): number {
  return Math.min(BACKUP_MAX_PACKS, Math.max(1, packs));
}

export function nextPacks(current: number, delta: number): number {
  return clampPacks(current + delta);
}

export function addonMonthlyPriceCents(packs: number, pricePerPack: number): number {
  return packs * pricePerPack;
}

export function backupUsagePercent(inUse: number, licenses: number): number {
  if (licenses <= 0) return inUse > 0 ? 100 : 0;
  return Math.min(100, Math.round((inUse / licenses) * 100));
}
