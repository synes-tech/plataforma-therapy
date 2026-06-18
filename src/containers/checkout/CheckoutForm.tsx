import { useState, type FormEvent } from 'react';
import { formatCurrency } from '@features/billing/format';
import type { PaywallPlanCard } from '@containers/paywall/paywall.types';
import {
  formatCardExpiry,
  formatCardNumber,
  isCheckoutFormValid,
  validateCheckoutForm,
  type CheckoutFormData,
} from './checkout.validation';

interface CheckoutFormProps {
  plan: PaywallPlanCard;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CheckoutFormData) => void;
  onBack: () => void;
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export function CheckoutForm({ plan, isSubmitting, error, onSubmit, onBack }: CheckoutFormProps) {
  const [form, setForm] = useState<CheckoutFormData>({
    card_holder_name: '',
    card_number: '',
    card_expiry: '',
    card_cvv: '',
  });
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validateCheckoutForm>>({});

  function updateField<K extends keyof CheckoutFormData>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validateCheckoutForm(form);
    setFieldErrors(errors);
    if (!isCheckoutFormValid(form)) return;
    onSubmit(form);
  }

  const inputClass =
    'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col">
      <div className="border-b border-white/10 px-6 py-6 md:px-8">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="mb-4 inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white disabled:opacity-50"
        >
          ← Voltar aos planos
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary-300/90">
              Checkout seguro
            </p>
            <h2 className="mt-2 font-serif text-2xl font-medium text-white">Confirmar assinatura</h2>
            <p className="mt-2 text-sm text-slate-400">
              Plano <span className="text-white">{plan.nome}</span>
              {' · '}
              {formatCurrency(plan.preco_mensal_cents)}/mês após o trial
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <LockIcon />
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-mint-500/20 bg-mint-500/10 px-4 py-3 text-xs leading-relaxed text-mint-100">
          Cobrança de <strong>R$ 0,00</strong> hoje. Cancele a qualquer momento antes do fim dos 14 dias.
        </p>
      </div>

      <div className="space-y-4 p-6 md:p-8">
        {error && (
          <div role="alert" className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="card_holder_name" className="mb-1.5 block text-xs font-medium text-slate-400">
            Nome no cartão
          </label>
          <input
            id="card_holder_name"
            type="text"
            autoComplete="cc-name"
            disabled={isSubmitting}
            value={form.card_holder_name}
            onChange={(e) => updateField('card_holder_name', e.target.value)}
            className={inputClass}
            placeholder="Como impresso no cartão"
          />
          {fieldErrors.card_holder_name && (
            <p className="mt-1 text-xs text-red-300">{fieldErrors.card_holder_name}</p>
          )}
        </div>

        <div>
          <label htmlFor="card_number" className="mb-1.5 block text-xs font-medium text-slate-400">
            Número do cartão
          </label>
          <input
            id="card_number"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            disabled={isSubmitting}
            value={form.card_number}
            onChange={(e) => updateField('card_number', formatCardNumber(e.target.value))}
            className={inputClass}
            placeholder="0000 0000 0000 0000"
          />
          {fieldErrors.card_number && (
            <p className="mt-1 text-xs text-red-300">{fieldErrors.card_number}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="card_expiry" className="mb-1.5 block text-xs font-medium text-slate-400">
              Validade
            </label>
            <input
              id="card_expiry"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              disabled={isSubmitting}
              value={form.card_expiry}
              onChange={(e) => updateField('card_expiry', formatCardExpiry(e.target.value))}
              className={inputClass}
              placeholder="MM/AA"
            />
            {fieldErrors.card_expiry && (
              <p className="mt-1 text-xs text-red-300">{fieldErrors.card_expiry}</p>
            )}
          </div>
          <div>
            <label htmlFor="card_cvv" className="mb-1.5 block text-xs font-medium text-slate-400">
              CVV
            </label>
            <input
              id="card_cvv"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              disabled={isSubmitting}
              value={form.card_cvv}
              onChange={(e) => updateField('card_cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
              className={inputClass}
              placeholder="•••"
            />
            {fieldErrors.card_cvv && (
              <p className="mt-1 text-xs text-red-300">{fieldErrors.card_cvv}</p>
            )}
          </div>
        </div>

        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <LockIcon />
          Pagamento simulado nesta versão — nenhum dado financeiro real é processado.
        </p>
      </div>

      <div className="border-t border-white/10 px-6 py-5 md:px-8">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processando...
            </>
          ) : (
            'Confirmar assinatura'
          )}
        </button>
      </div>
    </form>
  );
}
