import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckoutCelebration } from '@containers/billing/CheckoutCelebration';
import { PORTAL_CONTEXT_QUERY_KEY, type PortalContext } from '@shared/lib/portal-context';
import { PORTAL_ROUTES } from '@shared/lib/portal-nav';
import { THERY_PLAN_NAME, THERY_TRIAL_DAYS } from './portal-subscription.utils';
import { portalCelebrationFromContext, portalCheckoutUnlocked } from './portal-checkout-return';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 12;

type Phase = 'idle' | 'waiting' | 'ready';

interface CelebrationState {
  isTrial: boolean;
  chargeAtIso: string | null;
}

export function PortalCheckoutCelebration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const success = searchParams.get('checkout') === 'success';
  const [phase, setPhase] = useState<Phase>(success ? 'waiting' : 'idle');
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);

  useEffect(() => {
    if (!success) return;

    let attempts = 0;
    let cancelled = false;
    setPhase((current) => (current === 'ready' ? current : 'waiting'));

    const clearQuery = () => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('checkout');
        next.delete('session_id');
        return next;
      }, { replace: true });
    };

    const goReady = (next: CelebrationState) => {
      if (cancelled) return;
      setCelebration(next);
      setPhase('ready');
      clearQuery();
    };

    const poll = async () => {
      attempts += 1;
      await queryClient.invalidateQueries({ queryKey: PORTAL_CONTEXT_QUERY_KEY });
      await queryClient.refetchQueries({ queryKey: PORTAL_CONTEXT_QUERY_KEY });
      const fresh = queryClient.getQueryData(PORTAL_CONTEXT_QUERY_KEY) as PortalContext | undefined;

      if (portalCheckoutUnlocked(fresh)) {
        goReady(portalCelebrationFromContext(fresh));
        return;
      }

      if (attempts < MAX_POLL_ATTEMPTS && !cancelled) {
        window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
        return;
      }

      if (!cancelled) {
        goReady({ isTrial: true, chargeAtIso: null });
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [queryClient, setSearchParams, success]);

  if (phase === 'idle') return null;

  if (phase === 'ready') {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#F8FAF9]">
        <CheckoutCelebration
          planLabel={THERY_PLAN_NAME}
          isTrial={celebration?.isTrial ?? true}
          chargeAtIso={celebration?.chargeAtIso ?? null}
          trialDays={THERY_TRIAL_DAYS}
          continueLabel="Começar a conversar"
          onContinue={() => {
            setPhase('idle');
            navigate(PORTAL_ROUTES.companion, { replace: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#F8FAF9] px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <h1 className="mt-5 font-serif text-2xl text-charcoal">Confirmando pagamento…</h1>
        <p className="mt-2 text-sm text-slate-500">Aguarde enquanto liberamos a Ivy no seu portal.</p>
      </div>
    </div>
  );
}
