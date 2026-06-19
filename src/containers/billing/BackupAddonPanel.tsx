import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { Toast } from '@containers/patient/Toast';
import { AddonQuantityStepper } from './AddonQuantityStepper';
import { backupUsagePercent, quantityFromPacks } from './billing-addon.utils';

export interface BackupAddonPanelProps {
  licenses: number;
  archivedCount: number;
  packSize: number;
  priceCentsPerPack: number;
  onLicensesUpdated?: (newTotal: number) => void;
  onPurchaseSuccess?: () => void;
  submitLabel?: string;
  showSubmitButton?: boolean;
}

function CloudLockIcon() {
  return (
    <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15a4.5 4.5 0 004.5-4.5V9a6 6 0 1112 0v1.5a4.5 4.5 0 004.5 4.5M8.25 18.75h7.5"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v3.75" />
    </svg>
  );
}

export function BackupAddonPanel({
  licenses: initialLicenses,
  archivedCount,
  packSize,
  priceCentsPerPack,
  onLicensesUpdated,
  onPurchaseSuccess,
  submitLabel = 'Adicionar espaço',
  showSubmitButton = true,
}: BackupAddonPanelProps) {
  const queryClient = useQueryClient();
  const [packs, setPacks] = useState(1);
  const [licenses, setLicenses] = useState(initialLicenses);
  const [animateBar, setAnimateBar] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    setLicenses(initialLicenses);
  }, [initialLicenses]);

  const usagePct = backupUsagePercent(archivedCount, licenses);

  const mutation = useMutation({
    mutationFn: () =>
      callFunction<{
        quantidade_backup_pacientes: number;
        quantidade_comprada: number;
      }>('purchase-addon-bypass', {
        quantidade_comprada: quantityFromPacks(packs),
      }),
    onSuccess: (result) => {
      setLicenses(result.quantidade_backup_pacientes);
      setAnimateBar(true);
      setToastVisible(true);
      setPurchaseError(null);
      onLicensesUpdated?.(result.quantidade_backup_pacientes);
      onPurchaseSuccess?.();
      void queryClient.invalidateQueries({ queryKey: ['plan-control-state'] });
      void queryClient.invalidateQueries({ queryKey: ['archived-patients'] });
      void queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      setTimeout(() => setAnimateBar(false), 800);
    },
    onError: (err: Error) => {
      setPurchaseError(err.message);
    },
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-[#F8FAF9] p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
            <CloudLockIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-charcoal">Histórico preservado com segurança</p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-muted">
              Mantenha o prontuário de pacientes desvinculados acessível fora da agenda ativa, com criptografia e
              conformidade LGPD.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-charcoal">Licenças em uso</p>
            <p className="text-sm font-semibold tabular-nums text-charcoal">
              {archivedCount} <span className="font-normal text-charcoal-muted">/ {licenses || '—'}</span>
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
            Pacotes de {packSize} licenças · {archivedCount} paciente{archivedCount === 1 ? '' : 's'} arquivado
            {archivedCount === 1 ? '' : 's'}
          </p>
        </div>

        <ul className="space-y-2 text-sm text-charcoal-muted">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Prontuários, sessões e documentos permanecem consultáveis
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Libera vagas na agenda ativa sem perder o histórico clínico
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Cobrança mensal proporcional ao pacote contratado
          </li>
        </ul>

        <AddonQuantityStepper
          packs={packs}
          onChange={setPacks}
          disabled={mutation.isPending}
          priceCentsPerPack={priceCentsPerPack}
        />

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
            onClick={() => mutation.mutate()}
            className="h-12 font-semibold"
          >
            {submitLabel}
          </LoadingButton>
        )}
      </div>

      <Toast
        visible={toastVisible}
        message="Espaço de backup expandido com sucesso!"
        onDismiss={() => setToastVisible(false)}
        variant="success"
      />
    </>
  );
}