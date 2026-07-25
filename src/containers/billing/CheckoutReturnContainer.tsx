import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { PaywallBillingState } from '@containers/paywall/paywall.types';

interface PaywallStatePayload extends PaywallBillingState {
  plans: unknown[];
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

interface ConfirmCheckoutResult {
  subscription_status: string;
  payment_method_on_file: boolean;
}

export default function CheckoutReturnContainer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canceled = searchParams.get('canceled') === '1';
  const success = searchParams.get('success') === '1';
  const planId = searchParams.get('plan');
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<'waiting' | 'ready' | 'timeout' | 'canceled'>(
    canceled ? 'canceled' : success ? 'waiting' : 'canceled',
  );

  useEffect(() => {
    if (!success || canceled) return;

    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      attempts += 1;
      try {
        if (sessionId) {
          const confirmed = await callFunction<ConfirmCheckoutResult>('confirm-stripe-checkout', {
            session_id: sessionId,
          });
          if (
            confirmed.subscription_status === 'active' ||
            confirmed.subscription_status === 'trial_active' ||
            confirmed.payment_method_on_file
          ) {
            await queryClient.invalidateQueries({ queryKey: ['paywall-state'] });
            if (!cancelled) setStatus('ready');
            return;
          }
        }

        const state = await callFunction<PaywallStatePayload>('get-paywall-state', {});
        await queryClient.invalidateQueries({ queryKey: ['paywall-state'] });

        if (!state.requires_paywall) {
          if (!cancelled) setStatus('ready');
          return;
        }
      } catch {
        // continua polling
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
  }, [success, canceled, sessionId, queryClient]);

  useEffect(() => {
    if (status !== 'ready') return;
    const timer = window.setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [status, navigate]);

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

        {status === 'ready' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-5 font-serif text-2xl text-charcoal">Assinatura ativa!</h1>
            <p className="mt-2 text-sm text-slate-500">Redirecionando para o painel…</p>
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
