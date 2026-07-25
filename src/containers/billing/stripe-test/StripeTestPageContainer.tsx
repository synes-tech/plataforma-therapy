import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  fetchStripePublicConfig,
} from './stripe-test.api';
import { StripeBillingModeColumn } from './StripeBillingModeColumn';
import { StripeCheckoutReturnBanner } from './StripeCheckoutReturnBanner';
import type { StripeBillingMode, StripeCheckoutPlanId } from './stripe-billing.constants';

const FALLBACK_LIVE_PK = import.meta.env.VITE_STRIPE_LIVE_PUBLISHABLE_KEY as string | undefined;

function parseMode(value: string | null): StripeBillingMode | null {
  return value === 'test' || value === 'live' ? value : null;
}

function parsePlan(value: string | null): StripeCheckoutPlanId | null {
  return value === 'inicial' || value === 'intermediario' || value === 'teste_1_real' ? value : null;
}

export default function StripeTestPageContainer() {
  const [searchParams] = useSearchParams();
  const [checkoutLoadingKey, setCheckoutLoadingKey] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';
  const sessionId = searchParams.get('session_id');
  const returnMode = parseMode(searchParams.get('mode'));
  const returnPlan = parsePlan(searchParams.get('plan'));

  const { data: stripeConfig } = useQuery({
    queryKey: ['stripe-test-public-config'],
    queryFn: fetchStripePublicConfig,
    staleTime: 5 * 60_000,
  });

  const testPublishableKey = stripeConfig?.test_publishable_key ?? undefined;
  const livePublishableKey = stripeConfig?.live_publishable_key ?? FALLBACK_LIVE_PK;

  useEffect(() => {
    document.title = 'Teste Stripe — Unithery';
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute('content', 'noindex, nofollow');
    } else {
      const tag = document.createElement('meta');
      tag.name = 'robots';
      tag.content = 'noindex, nofollow';
      document.head.appendChild(tag);
    }
  }, []);

  const statusVisible = useMemo(() => success || canceled, [success, canceled]);

  async function handleCheckout(mode: StripeBillingMode, planId: StripeCheckoutPlanId) {
    const loadingKey = `${mode}:${planId}`;
    setCheckoutLoadingKey(loadingKey);
    setError(null);
    try {
      const result = await createStripeCheckoutSession({ mode, planId });
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar checkout.');
      setCheckoutLoadingKey(null);
    }
  }

  async function handlePortal(mode: StripeBillingMode) {
    if (!sessionId) return;
    setPortalLoading(true);
    setError(null);
    try {
      const result = await createStripePortalSession({ mode, sessionId });
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir portal de clientes.');
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAF9] px-4 py-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-9 w-auto" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
            Laboratório · Stripe Checkout
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-charcoal">
            Teste vs Produção
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-charcoal-muted">
            Rota oculta <code className="text-charcoal">/unithery/teste</code> — compare sandbox e live lado a
            lado. Chaves secretas ficam só no servidor (Supabase secrets).
          </p>
        </div>

        {statusVisible && (
          <StripeCheckoutReturnBanner
            success={success}
            canceled={canceled}
            mode={returnMode}
            planId={returnPlan}
            sessionId={sessionId}
          />
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error"
          >
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <StripeBillingModeColumn
            mode="test"
            publishableKey={testPublishableKey}
            activeSessionId={sessionId}
            activeSessionMode={returnMode}
            checkoutLoadingKey={checkoutLoadingKey}
            portalLoading={portalLoading}
            onCheckout={handleCheckout}
            onPortal={handlePortal}
          />
          <StripeBillingModeColumn
            mode="live"
            publishableKey={livePublishableKey}
            activeSessionId={sessionId}
            activeSessionMode={returnMode}
            checkoutLoadingKey={checkoutLoadingKey}
            portalLoading={portalLoading}
            onCheckout={handleCheckout}
            onPortal={handlePortal}
          />
        </div>

        <section className="mt-8 rounded-xl border border-mint/30 bg-mint-50/50 p-4 text-xs leading-relaxed text-charcoal-muted">
          <p className="font-semibold text-mint-dark">Configuração aplicada automaticamente</p>
          <p className="mt-2">
            Secrets Stripe configurados no Supabase, produtos de teste criados (Inicial R$ 150 · Intermediário
            R$ 300) e checkout validado. Basta acessar a página e testar.
          </p>
        </section>
      </div>
    </div>
  );
}
