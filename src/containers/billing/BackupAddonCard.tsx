import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { Toast } from '@containers/patient/Toast';
import { AddonQuantityStepper } from './AddonQuantityStepper';
import { backupUsagePercent, quantityFromPacks } from './billing-addon.utils';

interface BackupAddonCardProps {
  licenses: number;
  archivedCount: number;
  packSize: number;
  priceCentsPerPack: number;
  onLicensesUpdated?: (newTotal: number) => void;
}

function CloudLockIcon() {
  return (
    <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15a4.5 4.5 0 004.5-4.5V9a6 6 0 1112 0v1.5a4.5 4.5 0 004.5 4.5M8.25 18.75h7.5"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v3.75" />
    </svg>
  );
}

export function BackupAddonCard({
  licenses: initialLicenses,
  archivedCount,
  packSize,
  priceCentsPerPack,
  onLicensesUpdated,
}: BackupAddonCardProps) {
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
      <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">
            <CloudLockIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-charcoal">Arquivo Clínico Seguro</h3>
            <p className="mt-1 text-sm text-charcoal-muted">
              Backup de pacientes desvinculados — histórico preservado fora da agenda ativa.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-charcoal">Licenças em uso</p>
            <p className="text-sm font-medium text-charcoal-muted">
              {archivedCount} de {licenses} licenças em uso
            </p>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-primary transition-all duration-700 ease-out ${
                animateBar ? 'brightness-110' : ''
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-charcoal-muted/80">
            Pacotes de {packSize} licenças · {archivedCount} paciente{archivedCount === 1 ? '' : 's'} arquivado{archivedCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <AddonQuantityStepper
            packs={packs}
            onChange={setPacks}
            disabled={mutation.isPending}
            priceCentsPerPack={priceCentsPerPack}
          />
        </div>

        {purchaseError && (
          <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {purchaseError}
          </div>
        )}

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-charcoal px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? 'Processando...' : 'Adicionar Espaço'}
        </button>
      </article>

      <Toast
        visible={toastVisible}
        message="Espaço de backup expandido com sucesso!"
        onDismiss={() => setToastVisible(false)}
        variant="success"
      />
    </>
  );
}
