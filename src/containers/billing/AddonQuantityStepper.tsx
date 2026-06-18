import { formatCurrency } from '@features/billing/format';
import { addonMonthlyPriceCents, nextPacks } from './billing-addon.utils';

interface AddonQuantityStepperProps {
  packs: number;
  onChange: (packs: number) => void;
  disabled?: boolean;
  priceCentsPerPack: number;
}

export function AddonQuantityStepper({
  packs,
  onChange,
  disabled = false,
  priceCentsPerPack,
}: AddonQuantityStepperProps) {
  const quantity = packs * 5;
  const monthlyCents = addonMonthlyPriceCents(packs, priceCentsPerPack);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-charcoal">Pacotes adicionais</p>
        <p className="text-sm text-charcoal-muted">+{quantity} vagas</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Diminuir pacote"
          disabled={disabled || packs <= 1}
          onClick={() => onChange(nextPacks(packs, -1))}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <div className="flex h-12 min-w-[5rem] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-semibold text-charcoal">
          +{quantity}
        </div>

        <button
          type="button"
          aria-label="Aumentar pacote"
          disabled={disabled || packs >= 10}
          onClick={() => onChange(nextPacks(packs, 1))}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      <p className="text-sm font-semibold text-mint-dark transition-all duration-200">
        Total adicional: {formatCurrency(monthlyCents)} / mês
      </p>
    </div>
  );
}
