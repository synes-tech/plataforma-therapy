import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { normalizeCpf } from '@shared/lib/cpf';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { usePaywall } from '@containers/paywall';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';
import { PatientAnamnesisWizard } from './PatientAnamnesisWizard';
import {
  PATIENT_CREATE_PROGRESS_STEPS,
  PatientCreateProgressOverlay,
} from './PatientCreateProgressOverlay';
import { PatientCpfField } from './PatientCpfField';
import { PatientDependentPickerModal } from './PatientDependentPickerModal';
import { PatientIdentityToggle } from './PatientIdentityToggle';
import { PatientResponsibleFields } from './PatientResponsibleFields';
import { PatientAlreadyActiveCard, PatientReactivationCard } from './PatientReactivationCard';
import { uploadPatientAvatarFile } from './patient-avatar.upload';
import { uploadPatientAttachmentFile } from './attachments/patient-attachment.api';
import {
  formToCreatePayload,
  lookupCpfFromIdentity,
} from './patient-create-payload';
import {
  EMPTY_CREATE_IDENTITY,
  type CpfLookupPhase,
  type PatientCreateIdentity,
  type VerifyPatientCpfMatch,
  type VerifyPatientCpfResponse,
} from './patient-cpf.types';
import type { PatientAnamnesisForm } from './patient-anamnesis.types';
import { shouldTriggerCpfLookup } from './patient-cpf.utils';

const CREATE_FORM_ID = 'create-patient-anamnesis-form';

interface PatientCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function cpfErrorMessage(phase: CpfLookupPhase): string | null {
  if (phase === 'invalid') return 'CPF inválido. Verifique os dígitos informados.';
  return null;
}

function resolvePhaseFromMatch(match: VerifyPatientCpfMatch): CpfLookupPhase {
  return match.status_vinculo === 'desvinculado' ? 'found_backup' : 'found_active';
}

export function PatientCreateModal({ isOpen, onClose }: PatientCreateModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { interceptNewPatient, handlePaymentRequired, refreshState } = usePaywall();

  const [identity, setIdentity] = useState<PatientCreateIdentity>(EMPTY_CREATE_IDENTITY);
  const [lookupPhase, setLookupPhase] = useState<CpfLookupPhase>('idle');
  const [match, setMatch] = useState<VerifyPatientCpfMatch | null>(null);
  const [pendingMatches, setPendingMatches] = useState<VerifyPatientCpfMatch[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createProgressOpen, setCreateProgressOpen] = useState(false);
  const [createProgressStep, setCreateProgressStep] = useState(0);
  const [createProgressComplete, setCreateProgressComplete] = useState(false);
  const progressTimerRef = useRef<number | null>(null);

  const stopProgressCycle = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressCycle = useCallback(() => {
    stopProgressCycle();
    setCreateProgressOpen(true);
    setCreateProgressComplete(false);
    setCreateProgressStep(0);
    progressTimerRef.current = window.setInterval(() => {
      setCreateProgressStep((prev) => Math.min(prev + 1, PATIENT_CREATE_PROGRESS_STEPS.length - 1));
    }, 650);
  }, [stopProgressCycle]);

  useEffect(() => () => stopProgressCycle(), [stopProgressCycle]);

  const resetFlow = useCallback(() => {
    setIdentity(EMPTY_CREATE_IDENTITY);
    setLookupPhase('idle');
    setMatch(null);
    setPendingMatches([]);
    setPickerOpen(false);
    setShowWizard(false);
    setCreateError(null);
    setUpgradeMessage(null);
    setUpgradeOpen(false);
    setIsCreating(false);
    setCreateProgressOpen(false);
    setCreateProgressComplete(false);
    setCreateProgressStep(0);
    stopProgressCycle();
  }, [stopProgressCycle]);

  useEffect(() => {
    if (!isOpen) resetFlow();
  }, [isOpen, resetFlow]);

  const lookupCpf = lookupCpfFromIdentity(identity);

  useEffect(() => {
    if (!isOpen) return;

    const digits = normalizeCpf(lookupCpf);
    if (digits.length === 0) {
      setLookupPhase('idle');
      setShowWizard(false);
      setMatch(null);
      setPendingMatches([]);
      return;
    }
    if (digits.length < 11) {
      setLookupPhase('typing');
      setShowWizard(false);
      setMatch(null);
      setPendingMatches([]);
      return;
    }
    if (!shouldTriggerCpfLookup(lookupCpf)) {
      setLookupPhase('invalid');
      setShowWizard(false);
      setMatch(null);
      setPendingMatches([]);
      return;
    }

    let cancelled = false;

    const lookup = async () => {
      setLookupPhase('searching');
      setCreateError(null);
      try {
        const res = await callFunction<VerifyPatientCpfResponse>('verify-patient-cpf', {
          cpf: digits,
        });
        if (cancelled) return;

        if (!res.exists || res.matches.length === 0) {
          setMatch(null);
          setPendingMatches([]);
          setLookupPhase('not_found');
          setShowWizard(true);
          return;
        }

        if (res.matches.length > 1) {
          setMatch(null);
          setPendingMatches(res.matches);
          setShowWizard(false);
          setPickerOpen(true);
          setLookupPhase('found_multiple');
          return;
        }

        const single = res.matches[0];
        if (!single) {
          setMatch(null);
          setPendingMatches([]);
          setLookupPhase('not_found');
          setShowWizard(true);
          return;
        }
        setMatch(single);
        setPendingMatches([]);
        setShowWizard(false);
        setLookupPhase(resolvePhaseFromMatch(single));
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
  }, [lookupCpf, isOpen]);

  function handleIdentityModeChange(mode: PatientCreateIdentity['mode']) {
    setIdentity({
      mode,
      cpfPaciente: '',
      cpfResponsavel: '',
      nomeResponsavel: '',
    });
    setLookupPhase('idle');
    setMatch(null);
    setPendingMatches([]);
    setPickerOpen(false);
    setShowWizard(false);
    setCreateError(null);
  }

  function handlePickerSelect(selected: VerifyPatientCpfMatch) {
    setMatch(selected);
    setPickerOpen(false);
    setLookupPhase(resolvePhaseFromMatch(selected));
  }

  function handleRegisterNewDependent() {
    setPickerOpen(false);
    setMatch(null);
    setShowWizard(true);
    setLookupPhase('not_found');
  }

  function handleCreateError(err: Error & { code?: string }) {
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
  }

  async function runPatientCreate(
    payload: ReturnType<typeof formToCreatePayload>,
    avatarFile: File | null,
    attachmentFiles: File[],
  ) {
    startProgressCycle();
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await callFunction<{ patient_id: string }>('create-patient', payload);

      setCreateProgressStep(2);

      const uploads: Promise<unknown>[] = [];
      if (avatarFile) {
        uploads.push(uploadPatientAvatarFile(res.patient_id, avatarFile));
      }
      for (const file of attachmentFiles) {
        uploads.push(uploadPatientAttachmentFile(res.patient_id, file));
      }
      if (uploads.length > 0) {
        await Promise.all(uploads);
      }

      stopProgressCycle();
      setCreateProgressStep(PATIENT_CREATE_PROGRESS_STEPS.length - 1);
      setCreateProgressComplete(true);
      await new Promise((resolve) => window.setTimeout(resolve, 1100));

      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      refreshState();
      setCreateProgressOpen(false);
      onClose();
    } catch (err) {
      stopProgressCycle();
      setCreateProgressOpen(false);
      handleCreateError(err instanceof Error ? err : new Error('Falha ao cadastrar paciente'));
    } finally {
      setIsCreating(false);
    }
  }

  function handleCreateSubmit(
    form: PatientAnamnesisForm,
    avatarFile: File | null,
    attachmentFiles: File[],
  ) {
    const payload = formToCreatePayload(form, {
      ...identity,
      cpfPaciente: normalizeCpf(identity.cpfPaciente),
      cpfResponsavel: normalizeCpf(identity.cpfResponsavel),
    });
    interceptNewPatient(() => {
      void runPatientCreate(payload, avatarFile, attachmentFiles);
    });
  }

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
    navigate(`/patients/${match.patient_id}/copilot`);
  }

  const isBusy =
    lookupPhase === 'searching' ||
    isCreating ||
    reactivateMutation.isPending;

  const dependentReady =
    identity.mode === 'dependent' && identity.nomeResponsavel.trim().length >= 2;

  const showFooterSubmit =
    showWizard &&
    lookupPhase === 'not_found' &&
    (identity.mode === 'own_cpf' || dependentReady);

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title="Cadastrar paciente"
        size="xl"
        closeOnBackdropClick={false}
        closeOnEscape={false}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              Cancelar
            </button>
            {showFooterSubmit && (
            <LoadingButton
              type="submit"
              form={CREATE_FORM_ID}
              loading={isCreating}
              fullWidth
              className="md:w-auto"
            >
              Concluir cadastro
            </LoadingButton>
            )}
          </>
        }
      >
        <div className="relative">
          <PatientCreateProgressOverlay
            open={createProgressOpen}
            stepIndex={createProgressStep}
            complete={createProgressComplete}
          />

        {createError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error"
          >
            {createError}
          </div>
        )}

        <div className="space-y-5">
          <PatientIdentityToggle
            mode={identity.mode}
            onChange={handleIdentityModeChange}
            disabled={isBusy}
          />

          {identity.mode === 'own_cpf' ? (
            <PatientCpfField
              value={identity.cpfPaciente}
              onChange={(value) =>
                setIdentity((prev) => ({ ...prev, cpfPaciente: value }))
              }
              loading={lookupPhase === 'searching'}
              error={cpfErrorMessage(lookupPhase)}
              disabled={isBusy}
            />
          ) : (
            <PatientResponsibleFields
              nomeResponsavel={identity.nomeResponsavel}
              cpfResponsavel={identity.cpfResponsavel}
              onNomeChange={(value) =>
                setIdentity((prev) => ({ ...prev, nomeResponsavel: value }))
              }
              onCpfChange={(value) =>
                setIdentity((prev) => ({ ...prev, cpfResponsavel: value }))
              }
              cpfLoading={lookupPhase === 'searching'}
              cpfError={cpfErrorMessage(lookupPhase)}
              disabled={isBusy}
            />
          )}

          {lookupPhase === 'found_backup' && match && (
            <PatientReactivationCard
              match={match}
              onReactivate={handleReactivate}
              isReactivating={reactivateMutation.isPending}
            />
          )}

          {lookupPhase === 'found_active' && match && (
            <PatientAlreadyActiveCard
              match={match}
              onViewRecord={handleViewActiveRecord}
              onRegisterAnother={
                identity.mode === 'dependent' ? handleRegisterNewDependent : undefined
              }
            />
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
                    {identity.mode === 'own_cpf'
                      ? 'CPF não encontrado — complete a ficha para cadastrar um novo paciente.'
                      : 'Responsável não vinculado a este paciente — complete a ficha do dependente.'}
                  </p>
                  <PatientAnamnesisWizard
                    formId={CREATE_FORM_ID}
                    isSubmitting={isCreating}
                    onSubmit={handleCreateSubmit}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        <UpgradePlanModal
          isOpen={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          message={upgradeMessage ?? ''}
        />
      </StandardModal>

      <PatientDependentPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        matches={pendingMatches}
        onSelect={handlePickerSelect}
        onRegisterNew={identity.mode === 'dependent' ? handleRegisterNewDependent : undefined}
      />
    </>
  );
}
