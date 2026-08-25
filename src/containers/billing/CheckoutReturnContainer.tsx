import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { planLabel } from '@features/billing/format';
import type { PaywallBillingState } from '@containers/paywall/paywall.types';
import { CheckoutCelebration } from './CheckoutCelebration';
import { isCheckoutTrialStatus } from './checkout-celebration.copy';
import { checkoutLooksActive, checkoutReturnFromError } from './checkout-return.utils';

interface PaywallStatePayload extends PaywallBillingState {
  plans: unknown[];
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

interface ConfirmCheckoutResult {
  plan_id?: string;
  subscription_status: string;
  payment_method_on_file: boolean;
  trial_ends_at?: string | null;
}

interface CelebrationState {
  planId: string;
  isTrial: boolean;
  chargeAtIso: string | null;
}

export default function CheckoutReturnContainer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canceled = searchParams.get('canceled') === '1';
  const success = searchParams.get('success') === '1';
  const planId = searchParams.get('plan');
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<'waiting' | 'ready' | 'timeout' | 'canceled' | 'mismatch'>(
    canceled ? 'canceled' : success ? 'waiting' : 'canceled',
  );
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);

  useEffect(() => {
    if (!success || canceled) return;

    let attempts = 0;
    let cancelled = false;

    const goReady = (next: CelebrationState) => {
      if (cancelled) return;
      setCelebration(next);
      setStatus('ready');
    };

    const poll = async () => {
      attempts += 1;
      try {
        if (sessionId) {
          const confirmed = await callFunction<ConfirmCheckoutResult>('confirm-stripe-checkout', {
            session_id: sessionId,
          });
          if (checkoutLooksActive(confirmed)) {
            await queryClient.invalidateQueries({ queryKey: ['paywall-state'] });
            goReady({
              planId: confirmed.plan_id ?? planId ?? 'standard',
              isTrial: isCheckoutTrialStatus(confirmed.subscription_status),
              chargeAtIso: confirmed.trial_ends_at ?? null,
            });
            return;
          }
        }

        const state = await callFunction<PaywallStatePayload>('get-paywall-state', {});
        await queryClient.invalidateQueries({ queryKey: ['paywall-state'] });

        if (checkoutLooksActive(state)) {
          goReady({
            planId: state.subscription_plan || planId || 'standard',
            isTrial: isCheckoutTrialStatus(state.subscription_status),
            chargeAtIso: state.trial_ends_at,
          });
          return;
        }
      } catch (err) {
        if (checkoutReturnFromError(err) === 'mismatch') {
          if (!cancelled) setStatus('mismatch');
          return;
        }
      }

      if (attempts >= MAX_POLL_ATTEMPTS) {
        if (!cancelled) setStatus('timeout');
        return;
      }

      window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [success, canceled, sessionId, planId, queryClient]);

  if (status === 'ready') {
    return (
      <CheckoutCelebration
        planLabel={planLabel(celebration?.planId ?? planId ?? 'standard')}
        isTrial={celebration?.isTrial ?? false}
        chargeAtIso={celebration?.chargeAtIso ?? null}
        onContinue={() => navigate('/dashboard', { replace: true })}
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F8FAF9] px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
        {status === 'canceled' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mt-5 font-serif text-2xl text-charcoal">Pagamento cancelado</h1>
            <p className="mt-2 text-sm text-slate-500">
              Nenhuma cobrança foi feita. Você pode assinar quando quiser.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Voltar ao painel
            </button>
          </>
        )}

        {status === 'waiting' && (
          <>
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <h1 className="mt-5 font-serif text-2xl text-charcoal">Confirmando pagamento…</h1>
            <p className="mt-2 text-sm text-slate-500">
              Aguarde enquanto ativamos sua assinatura
              {planId ? ` (${planId})` : ''}.
            </p>
          </>
        )}

        {status === 'mismatch' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <span className="text-2xl">⏳</span>
            </div>
            <h1 className="mt-5 font-serif text-2xl text-charcoal">Conta diferente</h1>
            <p className="mt-2 text-sm text-slate-500">
              O pagamento foi concluído, mas esta página abriu em outra conta.
              Volte ao navegador onde você iniciou a assinatura e atualize o painel —
              o plano já deve estar ativo lá.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Ir ao painel desta conta
            </button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <span className="text-2xl">⏳</span>
            </div>
            <h1 className="mt-5 font-serif text-2xl text-charcoal">Quase lá</h1>
            <p className="mt-2 text-sm text-slate-500">
              Seu pagamento foi recebido, mas a ativação ainda está em processamento.
              Atualize a página em instantes ou entre em contato com o suporte.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-charcoal hover:bg-slate-50"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Ir ao painel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
