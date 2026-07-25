import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { Toast } from '@containers/patient/Toast';
import { patientUsagePercent } from '@shared/lib/therapist-plans';
import {
  addonPriceCentsForCycle,
  formatAddonPrice,
  type AddonCatalogInfo,
} from './billing-patient-pack.utils';

export interface PatientQuotaPackPanelProps {
  planBaseLimit: number;
  quotaBonus: number;
  totalLimit: number;
  activeCount: number;
  addon: AddonCatalogInfo | null;
  billingCycle: 'monthly' | 'yearly';
  hasStripeSubscription: boolean;
  onQuotaUpdated?: (newBonus: number) => void;
  onPurchaseSuccess?: () => void;
  showSubmitButton?: boolean;
}

function UsersIcon() {
  return (
    <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

export function PatientQuotaPackPanel({
  planBaseLimit,
  quotaBonus: initialBonus,
  totalLimit: initialTotal,
  activeCount,
  addon,
  billingCycle,
  hasStripeSubscription,
  onQuotaUpdated,
  onPurchaseSuccess,
  showSubmitButton = true,
}: PatientQuotaPackPanelProps) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [quotaBonus, setQuotaBonus] = useState(initialBonus);
  const [totalLimit, setTotalLimit] = useState(initialTotal);
  const [animateBar, setAnimateBar] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    setQuotaBonus(initialBonus);
    setTotalLimit(initialTotal);
  }, [initialBonus, initialTotal]);

  const usagePct = patientUsagePercent(activeCount, totalLimit);
  const pricePerModule = addon ? addonPriceCentsForCycle(addon, billingCycle) : 0;
  const patientsPerModule = addon?.pacientes_bonus ?? 5;

  const mutation = useMutation({
    mutationFn: () =>
      callFunction<{
        patient_quota_bonus: number;
        total_quantity: number;
      }>('purchase-patient-quota-pack', { quantity }),
    onSuccess: (result) => {
      setQuotaBonus(result.patient_quota_bonus);
      setTotalLimit(planBaseLimit + result.patient_quota_bonus);
      setAnimateBar(true);
      setToastVisible(true);
      setPurchaseError(null);
      onQuotaUpdated?.(result.patient_quota_bonus);
      onPurchaseSuccess?.();
      void queryClient.invalidateQueries({ queryKey: ['plan-control-state'] });
      void queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      setTimeout(() => setAnimateBar(false), 800);
    },
    onError: (err: Error) => {
      setPurchaseError(err.message);
    },
  });

  if (!addon) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-[#F8FAF9] p-4 text-sm text-charcoal-muted">
        Módulos Adicionais de pacientes estão disponíveis nos planos Standard, Advanced e Premium.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-[#F8FAF9] p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
            <UsersIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-charcoal">Módulos Adicionais de pacientes</p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-muted">
              Cada módulo adiciona <strong>+{patientsPerModule} pacientes ativos</strong>, +
              {patientsPerModule * 4} sessões/mês e +375 interações de IA. A cobrança entra na sua
              assinatura atual ({billingCycle === 'yearly' ? 'ciclo anual com 12% off' : 'ciclo mensal'}),
              com valor proporcional no primeiro mês.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-charcoal">Pacientes ativos</p>
            <p className="text-sm font-semibold tabular-nums text-charcoal">
              {activeCount} <span className="font-normal text-charcoal-muted">/ {totalLimit}</span>
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-primary transition-all duration-700 ease-out ${
                animateBar ? 'brightness-110' : ''
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-charcoal-muted">
            Plano: {planBaseLimit} pacientes
            {quotaBonus > 0 ? ` · +${quotaBonus} extras via módulos` : ''}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-sm font-semibold text-charcoal">{addon.nome}</p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {formatAddonPrice(pricePerModule)}/mês por módulo
                {billingCycle === 'yearly' ? ' (com 12% off do ciclo anual)' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={mutation.isPending || quantity <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-8 text-center font-display text-sm font-semibold tabular-nums text-charcoal">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                disabled={mutation.isPending || quantity >= 10}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm font-medium text-mint-dark">
          +{quantity * patientsPerModule} pacientes · {formatAddonPrice(pricePerModule * quantity)}/mês adicionais
        </p>

        {!hasStripeSubscription && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Ative sua assinatura (com pagamento) para contratar Módulos Adicionais.
          </div>
        )}

        {purchaseError && (
          <div
            role="alert"
            className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error"
          >
            {purchaseError}
          </div>
        )}

        {showSubmitButton && (
          <LoadingButton
            type="button"
            variant="dark"
            fullWidth
            loading={mutation.isPending}
            disabled={!hasStripeSubscription}
            onClick={() => mutation.mutate()}
            className="h-12 font-semibold"
          >
            Contratar {quantity} módulo{quantity > 1 ? 's' : ''} (+{quantity * patientsPerModule} pacientes)
          </LoadingButton>
        )}
      </div>

      <Toast
        visible={toastVisible}
        message="Carteira ampliada com sucesso!"
        onDismiss={() => setToastVisible(false)}
        variant="success"
      />
    </>
  );
}
