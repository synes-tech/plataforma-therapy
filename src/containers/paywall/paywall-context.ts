import { createContext, useContext } from 'react';
import type { PaywallPlanCard, PaywallTrigger } from './paywall.types';

export interface PaywallContextValue {
  isLoading: boolean;
  canAddPatient: () => boolean;
  canUseAiFeature: () => boolean;
  interceptNewPatient: (onAllowed: () => void) => void;
  interceptAiFeature: (onAllowed: () => void) => void;
  openPaywall: (trigger?: PaywallTrigger) => void;
  openPlansCatalog: () => void;
  closePaywall: () => void;
  handlePaymentRequired: () => void;
  refreshState: () => void;
  visiblePlans: PaywallPlanCard[];
}

/** Módulo isolado para evitar instância duplicada do contexto em chunks lazy do Vite. */
export const PaywallContext = createContext<PaywallContextValue | null>(null);

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error('usePaywall deve ser usado dentro de PaywallProvider');
  }
  return ctx;
}
