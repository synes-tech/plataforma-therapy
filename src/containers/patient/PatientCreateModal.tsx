import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { normalizeCpf } from '@shared/lib/cpf';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { usePaywall } from '@containers/paywall';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';
import { PatientAnamnesisWizard } from './PatientAnamnesisWizard';
import { PatientCpfField } from './PatientCpfField';
import { PatientDependentPickerModal } from './PatientDependentPickerModal';
import { PatientIdentityToggle } from './PatientIdentityToggle';
import { PatientResponsibleFields } from './PatientResponsibleFields';
import { PatientAlreadyActiveCard, PatientReactivationCard } from './PatientReactivationCard';
import { uploadPatientAvatarFile } from './patient-avatar.upload';
import {
  formToCreatePayload,
  lookupCpfFromIdentity,
} from './patient-create-payload';
import type {
  CpfLookupPhase,
  PatientCreateIdentity,
  VerifyPatientCpfMatch,
  VerifyPatientCpfResponse,
} from './patient-cpf.types';
import { EMPTY_CREATE_IDENTITY } from './patient-cpf.types';
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
  }, []);

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
    navigate(`/patients/${match.patient_id}/copilot`);
  }

  const isBusy =
    lookupPhase === 'searching' ||
    createMutation.isPending ||
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
            <LoadingButton
              type="submit"
              form={CREATE_FORM_ID}
              loading={createMutation.isPending}
              fullWidth
              className="md:w-auto"
            >
              Concluir cadastro
            </LoadingButton>
            )}
          </>
        }
      >
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
                    isSubmitting={createMutation.isPending}
                    onSubmit={(form, avatarFile) =>
                      createMutation.mutate({
                        payload: formToCreatePayload(form, {
                          ...identity,
                          cpfPaciente: normalizeCpf(identity.cpfPaciente),
                          cpfResponsavel: normalizeCpf(identity.cpfResponsavel),
                        }),
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
