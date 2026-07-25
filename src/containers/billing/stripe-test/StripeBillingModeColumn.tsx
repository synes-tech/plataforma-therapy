import { useState } from 'react';
import { LoadingButton } from '@containers/loading';
import {
  modeLabel,
  plansForBillingMode,
  priceSuffix,
  STRIPE_TEST_CARDS,
  type StripeBillingMode,
  type StripeCheckoutPlanId,
} from './stripe-billing.constants';
import { StripeCheckoutButton } from './StripeCheckoutButton';

interface StripeBillingModeColumnProps {
  mode: StripeBillingMode;
  publishableKey?: string;
  activeSessionId?: string | null;
  activeSessionMode?: StripeBillingMode | null;
  checkoutLoadingKey: string | null;
  portalLoading: boolean;
  onCheckout: (mode: StripeBillingMode, planId: StripeCheckoutPlanId) => void;
  onPortal: (mode: StripeBillingMode) => void;
}

function maskKey(key?: string): string {
  if (!key) return 'Secret key ok · publishable via servidor';
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}…${key.slice(-4)}`;
}

export function StripeBillingModeColumn({
  mode,
  publishableKey,
  activeSessionId,
  activeSessionMode,
  checkoutLoadingKey,
  portalLoading,
  onCheckout,
  onPortal,
}: StripeBillingModeColumnProps) {
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const isLive = mode === 'live';
  const canCheckoutLive = !isLive || liveConfirmed;
  const plans = plansForBillingMode(mode);

  return (
    <section
      className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm md:p-6 ${
        isLive ? 'border-error/25 bg-white' : 'border-primary/20 bg-white'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isLive ? 'bg-error-light text-error' : 'bg-primary-50 text-primary-dark'
            }`}
          >
            {isLive ? 'Produção' : 'Teste'}
          </span>
          <h2 className="mt-2 font-display text-lg font-bold text-charcoal">{modeLabel(mode)}</h2>
          <p className="mt-1 text-xs text-charcoal-muted">
            Chave publicável: <code className="text-charcoal">{maskKey(publishableKey)}</code>
          </p>
        </div>
      </div>

      {isLive && (
        <div className="mb-4 rounded-xl border border-error/20 bg-error-light/40 px-3 py-2 text-xs text-error">
          Cobrança real. Para validar com valor mínimo, use <strong>TESTE 1 REAL</strong> (R$ 1, pagamento único).
        </div>
      )}

      <div className="space-y-4">
        {plans.map((plan) => {
          const loadingKey = `${mode}:${plan.id}`;
          const isLiveSmokeTest = plan.id === 'teste_1_real';
          return (
            <article
              key={plan.id}
              className={`rounded-xl border p-4 ${
                isLiveSmokeTest
                  ? 'border-error/30 bg-error-light/20'
                  : 'border-slate-100 bg-[#F8FAF9]'
              }`}
            >
              {isLiveSmokeTest && (
                <span className="mb-2 inline-flex rounded-full bg-error px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Recomendado para teste real
                </span>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-charcoal">{plan.name}</h3>
                <p className="font-display text-lg font-bold text-charcoal">
                  {plan.priceLabel}
                  <span className="text-xs font-medium text-charcoal-muted">{priceSuffix(plan)}</span>
                </p>
              </div>
              <p className="mt-1 text-xs text-charcoal-muted">{plan.description}</p>
              {isLive && plan.productIdLive && (
                <p className="mt-1 font-mono text-[10px] text-charcoal-muted">product: {plan.productIdLive}</p>
              )}
              <div className="mt-3">
                <StripeCheckoutButton
                  mode={mode}
                  planId={plan.id}
                  label={isLiveSmokeTest ? 'Pagar R$ 1 (real)' : isLive ? 'Assinar (produção)' : 'Assinar (teste)'}
                  loading={checkoutLoadingKey === loadingKey}
                  disabled={!canCheckoutLive}
                  onCheckout={onCheckout}
                />
              </div>
            </article>
          );
        })}
      </div>

      {!isLive && (
        <div className="mt-5 rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-xs font-semibold text-charcoal">Cartões de teste (Stripe)</p>
          <ul className="mt-2 space-y-1.5 text-xs text-charcoal-muted">
            {STRIPE_TEST_CARDS.map((card) => (
              <li key={card.number} className="flex justify-between gap-2">
                <span>{card.label}</span>
                <code className="shrink-0 text-charcoal">{card.number}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-charcoal-muted">Validade/CVC: qualquer data futura e 3 dígitos.</p>
        </div>
      )}

      {isLive && (
        <label className="mt-5 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-100 bg-white p-3 text-xs text-charcoal-muted">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={liveConfirmed}
            onChange={(e) => setLiveConfirmed(e.target.checked)}
          />
          <span>Entendo que esta coluna usa chaves live e pode gerar cobrança real no cartão informado.</span>
        </label>
      )}

      {activeSessionId && activeSessionMode === mode && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <LoadingButton
            type="button"
            variant="secondary"
            fullWidth
            loading={portalLoading}
            onClick={() => onPortal(mode)}
            className="h-10 text-sm"
          >
            Gerenciar assinatura (Portal)
          </LoadingButton>
        </div>
      )}
    </section>
  );
}
