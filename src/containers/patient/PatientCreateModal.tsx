import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { formatCpfDisplay, normalizeCpf } from '@shared/lib/cpf';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { usePaywall } from '@containers/paywall';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';
import {
  PatientAnamnesisWizard,
  type PatientAnamnesisWizardHandle,
} from './PatientAnamnesisWizard';
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
import { RecurrenceWindowsModal } from './RecurrenceWindowsModal';

const CREATE_FORM_ID = 'create-patient-anamnesis-form';

/** Resultado do convite do portal, para quem abriu o modal dar o retorno ao terapeuta. */
export interface PatientCreatedSummary {
  patientId: string;
  patientName: string;
  portalInvite: {
    code: string;
    recipient: 'patient' | 'caregiver';
    email: string | null;
    sent: boolean;
  } | null;
}

interface PatientCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (summary: PatientCreatedSummary) => void;
}

function cpfErrorMessage(phase: CpfLookupPhase): string | null {
  if (phase === 'invalid') return 'CPF inválido. Verifique os dígitos informados.';
  return null;
}

function resolvePhaseFromMatch(match: VerifyPatientCpfMatch): CpfLookupPhase {
  return match.status_vinculo === 'desvinculado' ? 'found_backup' : 'found_active';
}

export function PatientCreateModal({ isOpen, onClose, onCreated }: PatientCreateModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { interceptNewPatient, handlePaymentRequired, refreshState } = usePaywall();

  const [identity, setIdentity] = useState<PatientCreateIdentity>(EMPTY_CREATE_IDENTITY);
  const [lookupPhase, setLookupPhase] = useState<CpfLookupPhase>('idle');
  const [match, setMatch] = useState<VerifyPatientCpfMatch | null>(null);
  const [pendingMatches, setPendingMatches] = useState<VerifyPatientCpfMatch[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  /** Evita reabrir o wizard automaticamente ao tocar em "Alterar" identidade. */
  const [suppressWizardAutoOpen, setSuppressWizardAutoOpen] = useState(false);
  const [wizardMounted, setWizardMounted] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCanAdvance, setWizardCanAdvance] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createProgressOpen, setCreateProgressOpen] = useState(false);
  const [createProgressStep, setCreateProgressStep] = useState(0);
  const [createProgressComplete, setCreateProgressComplete] = useState(false);
  const progressTimerRef = useRef<number | null>(null);
  const wizardRef = useRef<PatientAnamnesisWizardHandle>(null);
  const [windowsPatient, setWindowsPatient] = useState<{ id: string; name: string } | null>(null);

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
    setSuppressWizardAutoOpen(false);
    setWizardMounted(false);
    setWizardStep(1);
    setWizardCanAdvance(false);
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
      setSuppressWizardAutoOpen(false);
      setMatch(null);
      setPendingMatches([]);
      return;
    }
    if (digits.length < 11) {
      setLookupPhase('typing');
      setShowWizard(false);
      setSuppressWizardAutoOpen(false);
      setMatch(null);
      setPendingMatches([]);
      return;
    }
    if (!shouldTriggerCpfLookup(lookupCpf)) {
      setLookupPhase('invalid');
      setShowWizard(false);
      setSuppressWizardAutoOpen(false);
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
          if (!suppressWizardAutoOpen) {
            setShowWizard(true);
            setWizardMounted(true);
          }
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
          if (!suppressWizardAutoOpen) {
            setShowWizard(true);
            setWizardMounted(true);
          }
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
  }, [lookupCpf, isOpen, suppressWizardAutoOpen]);

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
    setSuppressWizardAutoOpen(false);
    setWizardMounted(false);
    setWizardStep(1);
    setWizardCanAdvance(false);
    setCreateError(null);
  }

  function handleEditIdentity() {
    setShowWizard(false);
    setSuppressWizardAutoOpen(true);
    setCreateError(null);
  }

  function handleResumeWizard() {
    if (lookupPhase !== 'not_found') return;
    if (identity.mode === 'dependent' && identity.nomeResponsavel.trim().length < 2) return;
    setSuppressWizardAutoOpen(false);
    setShowWizard(true);
    setWizardMounted(true);
  }

  function handlePickerSelect(selected: VerifyPatientCpfMatch) {
    setMatch(selected);
    setPickerOpen(false);
    setLookupPhase(resolvePhaseFromMatch(selected));
  }

  function handleRegisterNewDependent() {
    setPickerOpen(false);
    setMatch(null);
    setSuppressWizardAutoOpen(false);
    setShowWizard(true);
    setWizardMounted(true);
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
      const res = await callFunction<{
        patient_id: string;
        needs_windows?: boolean;
        next_step?: string | null;
        portal_invite?: {
          code: string;
          recipient: 'patient' | 'caregiver';
          email: string | null;
          sent: boolean;
        } | null;
      }>('create-patient', payload);

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
      if (res.needs_windows) {
        setWindowsPatient({
          id: res.patient_id,
          name: payload.name?.trim() || 'paciente',
        });
      }
      onCreated?.({
        patientId: res.patient_id,
        patientName: payload.name?.trim() || 'paciente',
        portalInvite: res.portal_invite ?? null,
      });
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

  const wizardActive =
    showWizard &&
    lookupPhase === 'not_found' &&
    (identity.mode === 'own_cpf' || dependentReady);

  const isLastWizardStep = wizardStep >= 6;

  const identityCpfDisplay = formatCpfDisplay(lookupCpf);
  const identitySummary =
    identity.mode === 'own_cpf'
      ? `CPF ${identityCpfDisplay}`
      : `${identity.nomeResponsavel.trim() || 'Responsável'} · CPF ${identityCpfDisplay}`;

  function handleWizardNext() {
    if (isLastWizardStep) return;
    wizardRef.current?.goNext();
  }

  function handleWizardBack() {
    if (wizardStep <= 1) {
      handleEditIdentity();
      return;
    }
    wizardRef.current?.goBack();
  }

  const ghostBtnClass =
    'inline-flex h-11 w-full items-center justify-center rounded-xl border border-transparent px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto';

  const outlineBtnClass =
    'inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto';

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title={wizardActive ? 'Cadastrar paciente' : 'Identificar paciente'}
        size="xl"
        closeOnBackdropClick={false}
        closeOnEscape={false}
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className={`${ghostBtnClass} order-last sm:order-none`}
            >
              Cancelar
            </button>

            {wizardActive ? (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  disabled={isCreating}
                  className={`${outlineBtnClass} order-2 sm:order-none`}
                >
                  Voltar
                </button>
                {isLastWizardStep ? (
                  <LoadingButton
                    type="submit"
                    form={CREATE_FORM_ID}
                    loading={isCreating}
                    fullWidth
                    className="order-1 md:w-auto sm:order-none"
                  >
                    Concluir cadastro
                  </LoadingButton>
                ) : (
                  <LoadingButton
                    type="button"
                    onClick={handleWizardNext}
                    disabled={!wizardCanAdvance || isCreating}
                    fullWidth
                    className="order-1 md:w-auto sm:order-none"
                  >
                    Avançar
                  </LoadingButton>
                )}
              </div>
            ) : null}
          </div>
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

          {!wizardActive && (
            <div className="mx-auto max-w-lg space-y-5">
              <div className="rounded-2xl border border-slate-100 bg-[#F8FAF9]/60 px-4 py-5 sm:px-5">
                <p className="mb-4 text-sm leading-relaxed text-charcoal-muted">
                  Informe o CPF para verificar se o paciente já existe na plataforma. Em seguida,
                  você preenche a ficha em etapas.
                </p>

                <div className="space-y-5">
                  <PatientIdentityToggle
                    mode={identity.mode}
                    onChange={handleIdentityModeChange}
                    disabled={isBusy}
                  />

                  {identity.mode === 'own_cpf' ? (
                    <PatientCpfField
                      value={identity.cpfPaciente}
                      onChange={(value) => {
                        setSuppressWizardAutoOpen(false);
                        setIdentity((prev) => ({ ...prev, cpfPaciente: value }));
                      }}
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
                      onCpfChange={(value) => {
                        setSuppressWizardAutoOpen(false);
                        setIdentity((prev) => ({ ...prev, cpfResponsavel: value }));
                      }}
                      cpfLoading={lookupPhase === 'searching'}
                      cpfError={cpfErrorMessage(lookupPhase)}
                      disabled={isBusy}
                    />
                  )}
                </div>
              </div>

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

              {lookupPhase === 'searching' && (
                <p className="text-center text-xs text-charcoal-muted">Verificando CPF…</p>
              )}

              {suppressWizardAutoOpen &&
                lookupPhase === 'not_found' &&
                (identity.mode === 'own_cpf' || dependentReady) && (
                  <LoadingButton type="button" onClick={handleResumeWizard} fullWidth>
                    Continuar cadastro
                  </LoadingButton>
                )}
            </div>
          )}

          {wizardMounted && (
            <div className={wizardActive ? 'space-y-4' : 'hidden'} aria-hidden={!wizardActive}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-charcoal-muted">
                    Identidade validada
                  </p>
                  <p className="truncate text-sm font-medium text-charcoal">{identitySummary}</p>
                </div>
                <button
                  type="button"
                  onClick={handleEditIdentity}
                  disabled={isCreating}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-50 disabled:opacity-50"
                >
                  Alterar
                </button>
              </div>

              <PatientAnamnesisWizard
                key={`${identity.mode}-${normalizeCpf(lookupCpf)}`}
                ref={wizardRef}
                formId={CREATE_FORM_ID}
                isSubmitting={isCreating}
                onSubmit={handleCreateSubmit}
                onStepChange={setWizardStep}
                onCanAdvanceChange={setWizardCanAdvance}
              />
            </div>
          )}
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

      {windowsPatient && (
        <RecurrenceWindowsModal
          isOpen
          patientId={windowsPatient.id}
          patientName={windowsPatient.name}
          allowSkip
          onClose={() => {
            const id = windowsPatient.id;
            setWindowsPatient(null);
            navigate(`/patients/${id}/financeiro`);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['financeiro-ledger', windowsPatient.id] });
          }}
        />
      )}
    </>
  );
}
