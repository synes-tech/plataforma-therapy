import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { normalizeCpf } from '@shared/lib/cpf';
import { StandardModal } from '@shared/ui/StandardModal';
import { usePaywall } from '@containers/paywall';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';
import { PatientAnamnesisWizard } from './PatientAnamnesisWizard';
import { PatientCpfField } from './PatientCpfField';
import { PatientAlreadyActiveCard, PatientReactivationCard } from './PatientReactivationCard';
import { uploadPatientAvatarFile } from './patient-avatar.upload';
import { formToCreatePayload } from './patient-anamnesis.types';
import type { VerifyPatientCpfFound, VerifyPatientCpfResponse } from './patient-cpf.types';
import { shouldTriggerCpfLookup } from './patient-cpf.utils';
import type { CpfLookupPhase } from './patient-cpf.types';

const CREATE_FORM_ID = 'create-patient-anamnesis-form';

interface PatientCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function cpfErrorMessage(phase: CpfLookupPhase): string | null {
  if (phase === 'invalid') return 'CPF inválido. Verifique os dígitos informados.';
  return null;
}

export function PatientCreateModal({ isOpen, onClose }: PatientCreateModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { interceptNewPatient, handlePaymentRequired, refreshState } = usePaywall();

  const [cpf, setCpf] = useState('');
  const [lookupPhase, setLookupPhase] = useState<CpfLookupPhase>('idle');
  const [match, setMatch] = useState<VerifyPatientCpfFound | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const resetFlow = useCallback(() => {
    setCpf('');
    setLookupPhase('idle');
    setMatch(null);
    setShowWizard(false);
    setCreateError(null);
    setUpgradeMessage(null);
    setUpgradeOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) resetFlow();
  }, [isOpen, resetFlow]);

  useEffect(() => {
    if (!isOpen) return;

    const digits = normalizeCpf(cpf);
    if (digits.length === 0) {
      setLookupPhase('idle');
      setShowWizard(false);
      setMatch(null);
      return;
    }
    if (digits.length < 11) {
      setLookupPhase('typing');
      setShowWizard(false);
      setMatch(null);
      return;
    }
    if (!shouldTriggerCpfLookup(cpf)) {
      setLookupPhase('invalid');
      setShowWizard(false);
      setMatch(null);
      return;
    }

    let cancelled = false;

    const lookup = async () => {
      setLookupPhase('searching');
      setCreateError(null);
      try {
        const res = await callFunction<VerifyPatientCpfResponse>('verify-patient-cpf', { cpf });
        if (cancelled) return;

        if (!res.exists) {
          setMatch(null);
          setLookupPhase('not_found');
          setShowWizard(true);
          return;
        }

        setMatch(res);
        setShowWizard(false);
        setLookupPhase(res.status_vinculo === 'desvinculado' ? 'found_backup' : 'found_active');
      } catch (err) {
        if (cancelled) return;
        setCreateError(err instanceof Error ? err.message : 'Não foi possível verificar o CPF');
        setLookupPhase('invalid');
      }
    };

    void lookup();
    return () => {
      cancelled = true;
    };
  }, [cpf, isOpen]);

  const createMutation = useMutation({
    mutationFn: async ({
      payload,
      avatarFile,
    }: {
      payload: ReturnType<typeof formToCreatePayload>;
      avatarFile: File | null;
    }) => {
      const res = await callFunction<{ patient_id: string }>('create-patient', payload);
      if (avatarFile) {
        await uploadPatientAvatarFile(res.patient_id, avatarFile);
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      refreshState();
      onClose();
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PAYMENT_REQUIRED') {
        handlePaymentRequired();
        return;
      }
      if (err.code === 'QUOTA_EXCEEDED') {
        setUpgradeMessage(err.message);
        setUpgradeOpen(true);
        return;
      }
      setCreateError(err.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (patientId: string) =>
      callFunction('reactivate-patient', { patient_id: patientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      refreshState();
      onClose();
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PAYMENT_REQUIRED') {
        handlePaymentRequired();
        return;
      }
      if (err.code === 'QUOTA_EXCEEDED') {
        setUpgradeMessage(err.message);
        setUpgradeOpen(true);
        return;
      }
      if (err.code === 'REACTIVATION_COOLDOWN') {
        setCreateError(err.message);
        return;
      }
      setCreateError(err.message);
    },
  });

  function handleReactivate() {
    if (!match) return;
    interceptNewPatient(() => reactivateMutation.mutate(match.patient_id));
  }

  function handleViewActiveRecord() {
    if (!match) return;
    onClose();
    navigate(`/patients/${match.patient_id}`);
  }

  const showFooterSubmit = showWizard && lookupPhase === 'not_found';

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar paciente"
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-100 md:w-auto"
          >
            Cancelar
          </button>
          {showFooterSubmit && (
            <button
              type="submit"
              form={CREATE_FORM_ID}
              disabled={createMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50 md:w-auto"
            >
              {createMutation.isPending ? 'Salvando...' : 'Concluir cadastro'}
            </button>
          )}
        </>
      }
    >
      {(createError) && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error"
        >
          {createError}
        </div>
      )}

      <div className="space-y-5">
        <PatientCpfField
          value={cpf}
          onChange={setCpf}
          loading={lookupPhase === 'searching'}
          error={cpfErrorMessage(lookupPhase)}
          disabled={lookupPhase === 'searching' || createMutation.isPending || reactivateMutation.isPending}
        />

        {lookupPhase === 'found_backup' && match && (
          <PatientReactivationCard
            match={match}
            onReactivate={handleReactivate}
            isReactivating={reactivateMutation.isPending}
          />
        )}

        {lookupPhase === 'found_active' && match && (
          <PatientAlreadyActiveCard match={match} onViewRecord={handleViewActiveRecord} />
        )}

        <div
          className={`grid transition-all duration-300 ease-out ${
            showWizard ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            {showWizard && (
              <div className="animate-fade-in border-t border-slate-100 pt-5">
                <p className="mb-4 text-sm text-charcoal-muted">
                  CPF não encontrado — complete a ficha para cadastrar um novo paciente.
                </p>
                <PatientAnamnesisWizard
                  formId={CREATE_FORM_ID}
                  isSubmitting={createMutation.isPending}
                  onSubmit={(form, avatarFile) =>
                    createMutation.mutate({
                      payload: formToCreatePayload(form, normalizeCpf(cpf)),
                      avatarFile,
                    })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradePlanModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        message={upgradeMessage ?? ''}
      />
    </StandardModal>
  );
}
