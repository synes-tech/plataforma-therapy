import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import type { FinanceBillingType, FinanceContractWindow, FinanceModelType } from '@containers/financeiro/financeiro.types';
import { EMPTY_CONTRACT_FORM, PatientContractFields, type PatientContractFormValues } from './PatientContractFields';
import {
  contractFormToPayload,
  contractToForm,
  validateContractForm,
} from './patient-contract.schema';
import { invalidateFinanceQueries } from '@containers/financeiro/invalidate-finance';
import { RecurrenceWindowsModal } from './RecurrenceWindowsModal';
import { Toast } from './Toast';

interface PatientFinancialSetupModalProps {
  isOpen: boolean;
  patientId: string | null;
  patientName?: string;
  onClose: () => void;
  onSaved?: (result: { needs_windows: boolean }) => void;
}

export function PatientFinancialSetupModal({
  isOpen,
  patientId,
  patientName,
  onClose,
  onSaved,
}: PatientFinancialSetupModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PatientContractFormValues>(EMPTY_CONTRACT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [windowsOpen, setWindowsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const contractQuery = useQuery({
    queryKey: ['financeiro-ledger', patientId],
    queryFn: () =>
      callFunction<{
        contract: {
          model_type?: FinanceModelType;
          billing_type?: FinanceBillingType;
          modelo?: string;
          valor_acordado_cents?: number;
          valor_sessao_cents?: number;
          due_day?: number | null;
          sessions_per_month?: number | null;
          sessions_custom?: boolean;
          contract_duration_months?: number | null;
          pacote_qtd_sessoes?: number | null;
          pacote_valor_cents?: number | null;
          observacoes?: string | null;
        } | null;
        needs_windows?: boolean;
        janelas?: FinanceContractWindow[];
      }>('financeiro-upsert-patient-plan', { action: 'get_contract', patient_id: patientId }),
    enabled: isOpen && Boolean(patientId),
  });

  useEffect(() => {
    if (!isOpen) {
      setWindowsOpen(false);
      setDirty(false);
      setErrors({});
      return;
    }
    setForm(contractToForm(contractQuery.data?.contract ?? null));
    setDirty(false);
    setErrors({});
  }, [isOpen, patientId, contractQuery.data?.contract]);

  function applyPatch(patch: Partial<PatientContractFormValues>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      const result = validateContractForm(next);
      setDirty(true);
      setErrors(result.errors);
      return next;
    });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error('Paciente não selecionado.');
      const result = validateContractForm(form);
      setDirty(true);
      setErrors(result.errors);
      if (!result.valid) {
        throw new Error('Revise os campos do contrato antes de salvar.');
      }
      return callFunction<{ needs_windows?: boolean; next_step?: string | null }>(
        'financeiro-upsert-patient-plan',
        contractFormToPayload(patientId, form),
      );
    },
    onSuccess: (data) => {
      invalidateFinanceQueries(qc);
      const needsWindows = Boolean(data.needs_windows);
      onSaved?.({ needs_windows: needsWindows });
      if (needsWindows) {
        setToast({ message: 'Contrato salvo. Agora defina os horários da agenda.', variant: 'success' });
        setWindowsOpen(true);
        return;
      }
      setToast({ message: 'Contrato financeiro salvo.', variant: 'success' });
      onClose();
    },
    onError: (err) => {
      setToast({
        message: err instanceof Error ? err.message : 'Não foi possível salvar o contrato.',
        variant: 'error',
      });
    },
  });

  const setupOpen = isOpen && !windowsOpen;
  const hasContract = Boolean(contractQuery.data?.contract);

  return (
    <>
      <StandardModal
        isOpen={setupOpen}
        onClose={onClose}
        title={hasContract ? 'Editar contrato financeiro' : 'Definir contrato financeiro'}
        size="lg"
        closeOnBackdropClick={!saveMutation.isPending}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              loading={saveMutation.isPending}
              loadingLabel="Salvando"
              disabled={!patientId || contractQuery.isLoading}
              onClick={() => saveMutation.mutate()}
            >
              Salvar contrato
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-muted">
            {patientName ? (
              <>
                Combine o modelo de cobrança de{' '}
                <strong className="font-medium text-charcoal">{patientName}</strong>.
              </>
            ) : (
              'Combine o modelo de cobrança deste paciente.'
            )}{' '}
            Particular ou convênio, avulso, mensal ou pacote — esses dados alimentam o caixa.
          </p>

          {contractQuery.isLoading && (
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden />
          )}

          {contractQuery.isError && (
            <p className="text-xs text-error" role="alert">
              {(contractQuery.error as Error).message || 'Não foi possível carregar o contrato.'}
            </p>
          )}

          {!contractQuery.isLoading && (
            <PatientContractFields value={form} onChange={applyPatch} errors={dirty ? errors : {}} />
          )}
        </div>
      </StandardModal>

      <RecurrenceWindowsModal
        isOpen={windowsOpen}
        patientId={patientId ?? ''}
        patientName={patientName}
        allowSkip
        onClose={() => {
          setWindowsOpen(false);
          onClose();
        }}
        onSaved={() => {
          setToast({ message: 'Horários salvos. Agenda e fatura do mês atualizadas.', variant: 'success' });
        }}
      />

      <Toast
        message={toast?.message ?? ''}
        visible={Boolean(toast)}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
