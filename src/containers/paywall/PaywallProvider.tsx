import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { useAuthStore } from '@shared/lib/auth-store';
import type { CheckoutFormData } from '@containers/checkout';
import { digitsOnly } from '@containers/checkout';

const STRIPE_BILLING_ENABLED = import.meta.env.VITE_STRIPE_BILLING_ENABLED === 'true';

interface StripeCheckoutResult {
  url: string;
  session_id: string;
  plan_id: string;
}
import { PaywallModal, type PaywallStep } from './PaywallModal';
import { CheckoutWelcomeToast } from './CheckoutWelcomeToast';
import { PaywallContext, type PaywallContextValue } from './paywall-context';
import { overlayLandingPlanCopy } from './paywall-plan-copy';
import {
  plansForAccountType,
  shouldBlockAiFeature,
  shouldBlockNewPatient,
  type PaywallBillingCycle,
  type PaywallPlanCard,
  type PaywallTrigger,
  type PaywallBillingState,
} from './paywall.types';

interface PaywallStatePayload extends PaywallBillingState {
  plans: PaywallPlanCard[];
}

interface CheckoutBypassResult {
  clinic_id: string;
  plan_id: string;
  subscription_status: 'trial_active';
  payment_method_on_file: true;
  trial_ends_at: string;
}

const DEFAULT_STATE: PaywallStatePayload = {
  requires_paywall: false,
  patient_count: 0,
  freemium_patient_limit: 1,
  account_type: 'solo',
  subscription_status: 'active',
  subscription_plan: 'free',
  trial_ends_at: null,
  trial_used: false,
  plans: [],
};

export function PaywallProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const pendingActionRef = useRef<(() => void) | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<PaywallStep>('plans');
  const [trigger, setTrigger] = useState<PaywallTrigger>('patient_limit');
  const [selectedPlan, setSelectedPlan] = useState<PaywallPlanCard | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['paywall-state'],
    queryFn: () => callFunction<PaywallStatePayload>('get-paywall-state', {}),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const state = data ?? DEFAULT_STATE;
  const visiblePlans = useMemo(
    () => plansForAccountType(state.plans, state.account_type).map(overlayLandingPlanCopy),
    [state.plans, state.account_type],
  );

  const openPaywall = useCallback((nextTrigger: PaywallTrigger = 'patient_limit') => {
    setTrigger(nextTrigger);
    setStep('plans');
    setSelectedPlan(null);
    setCheckoutError(null);
    setIsOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    if (checkoutSubmitting) return;
    setIsOpen(false);
    setStep('plans');
    setSelectedPlan(null);
    setCheckoutError(null);
    pendingActionRef.current = null;
  }, [checkoutSubmitting]);

  const refreshState = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['paywall-state'] });
  }, [queryClient]);

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
  }, []);

  const completeCheckoutSuccess = useCallback(
    async (result: CheckoutBypassResult) => {
      queryClient.setQueryData<PaywallStatePayload>(['paywall-state'], (old) => {
        if (!old) return old;
        return {
          ...old,
          requires_paywall: false,
          subscription_status: result.subscription_status,
          trial_ends_at: result.trial_ends_at,
        };
      });

      setIsOpen(false);
      setStep('plans');
      setSelectedPlan(null);
      setCheckoutError(null);
      setWelcomeVisible(true);

      await queryClient.invalidateQueries({ queryKey: ['paywall-state'] });
      runPendingAction();
    },
    [queryClient, runPendingAction],
  );

  const redirectToStripeCheckout = useCallback(
    async (plan: PaywallPlanCard, cycle: PaywallBillingCycle) => {
      setCheckoutError(null);
      setCheckoutSubmitting(true);

      try {
        const result = await callFunction<StripeCheckoutResult>('create-stripe-checkout', {
          plan_id: plan.id,
          billing_cycle: cycle,
          intent: trigger === 'plan_catalog' ? 'plan_change' : 'subscribe',
        });
        window.location.href = result.url;
      } catch (err) {
        setCheckoutError(
          err instanceof Error ? err.message : 'Não foi possível abrir o checkout seguro.',
        );
        setCheckoutSubmitting(false);
      }
    },
    [trigger],
  );

  const handleCheckoutSubmit = useCallback(
    async (formData: CheckoutFormData) => {
      if (!selectedPlan) return;

      setCheckoutError(null);
      setCheckoutSubmitting(true);

      try {
        const result = await callFunction<CheckoutBypassResult>('process-checkout-bypass', {
          plan_id: selectedPlan.id,
          card_holder_name: formData.card_holder_name.trim(),
          card_number: digitsOnly(formData.card_number),
          card_expiry: formData.card_expiry,
          card_cvv: formData.card_cvv,
        });
        await completeCheckoutSuccess(result);
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'Não foi possível confirmar a assinatura.');
      } finally {
        setCheckoutSubmitting(false);
      }
    },
    [selectedPlan, completeCheckoutSuccess],
  );

  const handleSelectPlan = useCallback(
    (plan: PaywallPlanCard, cycle: PaywallBillingCycle) => {
      setSelectedPlan(plan);
      setCheckoutError(null);

      if (STRIPE_BILLING_ENABLED) {
        void redirectToStripeCheckout(plan, cycle);
        return;
      }

      setStep('checkout');
    },
    [redirectToStripeCheckout],
  );

  const openPlansCatalog = useCallback(() => {
    openPaywall('plan_catalog');
  }, [openPaywall]);

  const blockWithPaywall = useCallback(
    (nextTrigger: PaywallTrigger, onAllowed: () => void) => {
      pendingActionRef.current = onAllowed;
      openPaywall(nextTrigger);
    },
    [openPaywall],
  );

  const interceptNewPatient = useCallback(
    (onAllowed: () => void) => {
      if (shouldBlockNewPatient(state)) {
        blockWithPaywall('patient_limit', onAllowed);
        return;
      }
      onAllowed();
    },
    [state, blockWithPaywall],
  );

  const canAddPatient = useCallback((): boolean => {
    if (shouldBlockNewPatient(state)) {
      openPaywall('patient_limit');
      return false;
    }
    return true;
  }, [state, openPaywall]);

  const canUseAiFeature = useCallback((): boolean => {
    if (shouldBlockAiFeature(state)) {
      openPaywall('ai_feature');
      return false;
    }
    return true;
  }, [state, openPaywall]);

  const interceptAiFeature = useCallback(
    (onAllowed: () => void) => {
      if (shouldBlockAiFeature(state)) {
        blockWithPaywall('ai_feature', onAllowed);
        return;
      }
      onAllowed();
    },
    [state, blockWithPaywall],
  );

  const handlePaymentRequired = useCallback(() => {
    refreshState();
    openPaywall('plan_catalog');
  }, [openPaywall, refreshState]);

  const value = useMemo<PaywallContextValue>(
    () => ({
      isLoading,
      canAddPatient,
      canUseAiFeature,
      interceptNewPatient,
      interceptAiFeature,
      openPaywall,
      openPlansCatalog,
      closePaywall,
      handlePaymentRequired,
      refreshState,
      visiblePlans,
    }),
    [
      isLoading,
      canAddPatient,
      canUseAiFeature,
      interceptNewPatient,
      interceptAiFeature,
      openPaywall,
      openPlansCatalog,
      closePaywall,
      handlePaymentRequired,
      refreshState,
      visiblePlans,
    ],
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallModal
        isOpen={isOpen}
        step={step}
        onClose={closePaywall}
        trigger={trigger}
        plans={visiblePlans}
        selectedPlan={selectedPlan}
        trialEndsAt={state.trial_ends_at}
        trialUsed={state.trial_used}
        stripeBillingEnabled={STRIPE_BILLING_ENABLED}
        onSelectPlan={handleSelectPlan}
        onBackToPlans={() => {
          setStep('plans');
          setCheckoutError(null);
        }}
        onCheckoutSubmit={handleCheckoutSubmit}
        checkoutSubmitting={checkoutSubmitting}
        checkoutError={checkoutError}
      />
      <CheckoutWelcomeToast
        visible={welcomeVisible}
        onDismiss={() => setWelcomeVisible(false)}
      />
    </PaywallContext.Provider>
  );
}
