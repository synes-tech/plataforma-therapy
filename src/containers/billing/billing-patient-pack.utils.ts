import { addonModuleForPlan, formatBRL } from '@shared/lib/therapist-plans';

export interface AddonCatalogInfo {
  addon_id: string;
  nome: string;
  pacientes_bonus: number;
  preco_mensal_cents: number;
  preco_anual_mensal_cents: number | null;
}

/** Preço do módulo conforme o ciclo de cobrança da assinatura. */
export function addonPriceCentsForCycle(
  addon: AddonCatalogInfo,
  billingCycle: 'monthly' | 'yearly',
): number {
  if (billingCycle === 'yearly' && addon.preco_anual_mensal_cents) {
    return addon.preco_anual_mensal_cents;
  }
  return addon.preco_mensal_cents;
}

export function formatAddonPrice(cents: number): string {
  return formatBRL(cents);
}

/** Fallback local do catálogo quando a API ainda não retornou o addon. */
export function fallbackAddonForPlan(planId: string): AddonCatalogInfo | null {
  const module = addonModuleForPlan(planId);
  if (!module) return null;
  return {
    addon_id: module.id,
    nome: module.nome,
    pacientes_bonus: module.pacientesBonus,
    preco_mensal_cents: module.monthlyCents,
    preco_anual_mensal_cents: module.yearlyMonthlyCents,
  };
}
