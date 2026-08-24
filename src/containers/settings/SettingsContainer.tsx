import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton, PageLoader } from '@containers/loading';
import { CancelPlanModal } from '@containers/billing/CancelPlanModal';
import { usePaywall } from '@containers/paywall';
import { StandardModal } from '@shared/ui/StandardModal';
import { callFunction } from '@shared/lib/api';
import { OwnerProfilePhotoUpload } from './OwnerProfilePhotoUpload';
import { uploadOwnerAvatarFile } from './owner-avatar.upload';
import { MfaSettingsSection } from './MfaSettingsSection';
import { planLabel } from '@features/billing/format';
import { effectivePatientLimit } from '@shared/lib/therapist-plans';
import {
  clinicSettingsToFormState,
  isSettingsFormDirty,
  patientUsagePercent,
  unwrapClinicSettings,
} from './settings-form.utils';
import {
  SettingsField,
  SettingsGhostButton,
  SettingsRow,
  SettingsSection,
  SettingsToggle,
  SettingsValue,
} from './settings-ui';

interface OwnerProfile {
  kind: 'professional' | 'clinic_admin';
  name: string;
  email: string;
  specialty: string | null;
  crp: string | null;
  foto_url: string | null;
}

interface ClinicSettings {
  admin_name: string;
  owner_profile?: OwnerProfile;
  clinic: {
    id: string;
    name: string;
    document: string | null;
    email: string;
    phone: string | null;
    subscription_plan: string;
    status: string;
    is_solo_professional: boolean;
    created_at: string;
    billing_exempt?: boolean;
  };
  resource_usage?: {
    active_patients_clinic_total: number;
    active_patients_owner_count: number;
    owner_is_professional: boolean;
    patient_quota_bonus: number;
  };
  quotas: {
    max_professionals: number;
    max_patients_per_professional: number;
    max_family_members_per_patient: number;
    max_ai_queries_per_month: number;
    max_audio_minutes_per_month: number;
  };
  ai_usage: {
    ai_reports_this_month: number;
    audio_minutes_this_month: number;
  };
  preferences: {
    crisis_alerts_email: boolean;
    weekly_digest_email: boolean;
    ai_usage_alerts: boolean;
  };
}

type PreferenceKey = keyof ClinicSettings['preferences'];

export default function SettingsContainer() {
  const queryClient = useQueryClient();
  const { openPlansCatalog } = usePaywall();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancelPlanOpen, setCancelPlanOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => callFunction<ClinicSettings>('get-clinic-settings', {}),
  });

  const [profile, setProfile] = useState({ name: '', email: '', phone: '', document: '' });
  const [ownerProfile, setOwnerProfile] = useState({
    name: '',
    email: '',
    specialty: '',
    crp: '',
    foto_url: null as string | null,
    kind: 'professional' as OwnerProfile['kind'],
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [prefs, setPrefs] = useState({
    crisis_alerts_email: true,
    weekly_digest_email: true,
    ai_usage_alerts: true,
  });
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    const form = clinicSettingsToFormState(data);
    if (!form) return;
    setProfile(form.profile);
    setOwnerProfile(form.ownerProfile);
    setPrefs(form.prefs);
  }, [data]);

  useEffect(() => {
    if (searchParams.get('plans') !== '1') return;
    openPlansCatalog();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('plans');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, openPlansCatalog]);

  const mutation = useMutation({
    mutationFn: () =>
      callFunction('update-clinic-settings', {
        clinic: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          document: profile.document,
        },
        owner_profile: {
          name: ownerProfile.name,
          specialty: ownerProfile.specialty,
          crp: ownerProfile.crp,
        },
        preferences: prefs,
      }),
    onSuccess: async (result) => {
      const snapshot = unwrapClinicSettings(result);
      const form = clinicSettingsToFormState(result) ?? clinicSettingsToFormState(data);
      if (form) {
        setProfile(form.profile);
        setOwnerProfile(form.ownerProfile);
        setPrefs(form.prefs);
      }
      if (snapshot?.clinic || snapshot?.owner_profile || snapshot?.preferences) {
        queryClient.setQueryData(['clinic-settings'], (prev: ClinicSettings | undefined) => {
          const current = unwrapClinicSettings(prev) as ClinicSettings | null;
          if (!current && !data) return prev;
          return {
            ...(current ?? data),
            clinic: { ...(current?.clinic ?? data?.clinic), ...snapshot.clinic },
            owner_profile: {
              ...(current?.owner_profile ?? data?.owner_profile),
              ...snapshot.owner_profile,
            },
            preferences: {
              ...(current?.preferences ?? data?.preferences),
              ...snapshot.preferences,
            },
          } as ClinicSettings;
        });
      }
      setSaved(true);
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['clinic-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['professional-avatar-url'] });
      setTimeout(() => setSaved(false), 2500);
    },
  });

  async function handlePhotoSelected(file: File) {
    setPhotoError(null);
    setPhotoUploading(true);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);

    try {
      const fotoUrl = await uploadOwnerAvatarFile(file);
      setOwnerProfile((prev) => ({ ...prev, foto_url: fotoUrl }));
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['professional-avatar-url'] });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Falha ao enviar a foto.');
      setPhotoPreview(null);
    } finally {
      URL.revokeObjectURL(preview);
      setPhotoUploading(false);
    }
  }

  function updatePref(key: PreferenceKey, value: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  const baseline = useMemo(() => clinicSettingsToFormState(data), [data]);
  const isDirty = isSettingsFormDirty({ profile, ownerProfile, prefs }, baseline);

  function restoreBaseline() {
    if (!baseline) return;
    setProfile(baseline.profile);
    setOwnerProfile(baseline.ownerProfile);
    setPrefs(baseline.prefs);
  }

  function startEditing() {
    setSaved(false);
    setIsEditing(true);
  }

  function requestStopEditing() {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    setIsEditing(false);
  }

  function confirmDiscard() {
    restoreBaseline();
    setDiscardOpen(false);
    setIsEditing(false);
  }

  useEffect(() => {
    if (!isEditing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestStopEditing();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing, isDirty]);

  useEffect(() => {
    if (!isEditing) return;
    const first = document.getElementById('owner-name');
    first?.focus();
  }, [isEditing]);

  if (isLoading) {
    return <PageLoader label="Carregando configurações..." className="min-h-[40vh]" />;
  }

  const settings = (unwrapClinicSettings(data) as ClinicSettings | null) ?? data;
  const isSolo = settings?.clinic.is_solo_professional ?? false;
  const planId = settings?.clinic.subscription_plan ?? 'free';
  const billingExempt = settings?.clinic.billing_exempt === true;
  const resources = settings?.resource_usage;
  const showOwnerPatients = isSolo || Boolean(resources?.owner_is_professional);
  const patientUsed = showOwnerPatients
    ? resources?.active_patients_owner_count ?? 0
    : resources?.active_patients_clinic_total ?? 0;
  const patientLimit = billingExempt
    ? null
    : effectivePatientLimit(
        settings?.quotas.max_patients_per_professional ?? 0,
        resources?.patient_quota_bonus ?? 0,
      );
  const usagePercent = patientUsagePercent(patientUsed, patientLimit);
  const roleLabel =
    ownerProfile.kind === 'clinic_admin' ? 'Administrador da clínica' : 'Profissional';
  const workspaceLabel = isSolo ? 'consultório' : 'clínica';

  const editorActions = isEditing ? (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <button
        type="button"
        onClick={requestStopEditing}
        className="h-10 px-3 text-sm font-medium text-charcoal-muted transition-colors hover:text-charcoal"
      >
        Cancelar
      </button>
      <LoadingButton
        type="button"
        variant="dark"
        loading={mutation.isPending}
        disabled={!isDirty && !mutation.isPending}
        onClick={() => mutation.mutate()}
        className="h-10 min-w-[9.5rem] px-4"
      >
        Salvar alterações
      </LoadingButton>
    </div>
  ) : (
    <SettingsGhostButton onClick={startEditing}>Editar infos</SettingsGhostButton>
  );

  return (
    <div className="flex w-full flex-col gap-5 pb-8 lg:gap-6">
      {error && (
        <div role="alert" className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar as configurações. Tente novamente.
        </div>
      )}

      {saved && !isEditing && (
        <p className="text-sm font-medium text-mint-dark" role="status">
          Alterações salvas.
        </p>
      )}
      {mutation.isError && (
        <p className="text-sm text-error" role="alert">
          {(mutation.error as Error)?.message ?? 'Erro ao salvar.'}
        </p>
      )}

      <SettingsSection
        title="Você"
        description="Como seu nome e foto aparecem no menu, nos e-mails e para as famílias."
        action={editorActions}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <OwnerProfilePhotoUpload
                name={ownerProfile.name || settings?.admin_name || 'Usuário'}
                fotoUrl={ownerProfile.foto_url}
                previewUrl={photoPreview}
                uploading={photoUploading}
                disabled={!isEditing}
                onFileSelected={(file) => void handlePhotoSelected(file)}
                onValidationError={setPhotoError}
              />
              {photoError && (
                <p className="mt-2 text-sm text-error" role="alert">
                  {photoError}
                </p>
              )}
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="font-serif text-2xl font-medium tracking-tight text-charcoal">
                {ownerProfile.name || 'Seu nome'}
              </p>
              <p className="mt-1 text-sm text-charcoal-muted">
                {roleLabel}
                {ownerProfile.email ? ` · ${ownerProfile.email}` : ''}
              </p>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {isEditing ? (
              <>
                <SettingsField
                  id="owner-name"
                  label="Nome"
                  value={ownerProfile.name}
                  onChange={(v) => setOwnerProfile((p) => ({ ...p, name: v }))}
                />
                <SettingsField
                  id="owner-email"
                  label="E-mail de login"
                  type="email"
                  value={ownerProfile.email}
                  onChange={() => {}}
                  readOnly
                  hint="Este e-mail identifica a sua conta e não pode ser alterado aqui."
                />
                {ownerProfile.kind === 'professional' && (
                  <>
                    <SettingsField
                      id="owner-specialty"
                      label="Especialidade"
                      value={ownerProfile.specialty}
                      onChange={(v) => setOwnerProfile((p) => ({ ...p, specialty: v }))}
                      placeholder="Psicólogo, Fonoaudiólogo..."
                    />
                    <SettingsField
                      id="owner-crp"
                      label="Registro profissional"
                      value={ownerProfile.crp}
                      onChange={(v) => setOwnerProfile((p) => ({ ...p, crp: v }))}
                      placeholder="CRP, CRFa..."
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <SettingsValue label="Nome" value={ownerProfile.name} />
                <SettingsValue
                  label="E-mail de login"
                  value={ownerProfile.email}
                  hint="Identifica a sua conta."
                />
                {ownerProfile.kind === 'professional' && (
                  <>
                    <SettingsValue label="Especialidade" value={ownerProfile.specialty} />
                    <SettingsValue label="Registro profissional" value={ownerProfile.crp} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </SettingsSection>

      <div className="flex w-full flex-col-reverse gap-5 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <SettingsSection
          title={isSolo ? 'Consultório' : 'Clínica'}
          description={
            isSolo
              ? 'Dados do seu consultório em documentos, convites e faturas.'
              : 'Dados institucionais da clínica em documentos, convites e faturas.'
          }
        >
          <div className="grid w-full gap-4 sm:grid-cols-2">
            {isEditing ? (
              <>
                <SettingsField
                  id="name"
                  label={`Nome do ${workspaceLabel}`}
                  value={profile.name}
                  onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
                  className={isSolo ? 'sm:col-span-2' : ''}
                />
                <SettingsField
                  id="email"
                  label="E-mail de contato"
                  type="email"
                  value={profile.email}
                  onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
                  hint="Usado em comunicações com famílias e no financeiro."
                />
                <SettingsField
                  id="phone"
                  label="Telefone"
                  value={profile.phone}
                  onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
                  placeholder="(11) 99999-0000"
                />
                {!isSolo && (
                  <SettingsField
                    id="document"
                    label="CNPJ"
                    value={profile.document}
                    onChange={(v) => setProfile((p) => ({ ...p, document: v }))}
                    placeholder="00.000.000/0001-00"
                  />
                )}
              </>
            ) : (
              <>
                <SettingsValue
                  label={`Nome do ${workspaceLabel}`}
                  value={profile.name}
                  className={isSolo ? 'sm:col-span-2' : ''}
                />
                <SettingsValue label="E-mail de contato" value={profile.email} />
                <SettingsValue label="Telefone" value={profile.phone} />
                {!isSolo && <SettingsValue label="CNPJ" value={profile.document} />}
              </>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Assinatura"
          description="Plano contratado e uso atual de pacientes."
        >
          <div className="flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted/70">
                  Plano atual
                </p>
                <p className="mt-1.5 font-serif text-2xl font-medium tracking-tight text-charcoal">
                  {planLabel(planId, isSolo)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  billingExempt
                    ? 'bg-slate-100 text-charcoal-muted'
                    : 'bg-mint-50 text-mint-dark'
                }`}
              >
                {billingExempt ? 'Cortesia' : 'Ativo'}
              </span>
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-charcoal">Pacientes</p>
                <p className="text-sm tabular-nums text-charcoal-muted">
                  <span className="font-semibold text-charcoal">{patientUsed}</span>
                  <span className="mx-1.5 text-charcoal-muted/50">/</span>
                  {patientLimit == null ? 'Ilimitado' : patientLimit}
                </p>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={usagePercent ?? 0}
                aria-label="Uso de pacientes do plano"
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    (usagePercent ?? 0) >= 90 ? 'bg-alert' : 'bg-primary'
                  }`}
                  style={{ width: `${usagePercent ?? (patientLimit == null ? 18 : 0)}%` }}
                />
              </div>
            </div>

            <div className="mt-auto flex flex-col items-center gap-3 pt-8">
              <button
                type="button"
                onClick={openPlansCatalog}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
              >
                Alterar assinatura
              </button>
              {planId !== 'free' ? (
                <button
                  type="button"
                  onClick={() => setCancelPlanOpen(true)}
                  className="text-xs text-charcoal-muted underline-offset-2 transition-colors hover:text-error hover:underline"
                >
                  Cancelar assinatura
                </button>
              ) : null}
            </div>
          </div>
        </SettingsSection>
      </div>

      <SettingsSection
        title="Notificações"
        description={
          isEditing
            ? 'Escolha o que chega no seu e-mail e salve no topo da página.'
            : 'O que chega no seu e-mail. Toque em Editar infos para mudar.'
        }
      >
        <div className="divide-y divide-slate-100">
          <SettingsToggle
            label="Alertas de crise"
            description="E-mail quando uma família registrar uma crise."
            checked={prefs.crisis_alerts_email}
            onChange={(v) => updatePref('crisis_alerts_email', v)}
            disabled={!isEditing}
          />
          <SettingsToggle
            label="Resumo semanal"
            description="Panorama da semana no consultório, toda segunda."
            checked={prefs.weekly_digest_email}
            onChange={(v) => updatePref('weekly_digest_email', v)}
            disabled={!isEditing}
          />
          <SettingsToggle
            label="Uso de IA"
            description="Aviso quando o uso de IA se aproximar do limite do plano."
            checked={prefs.ai_usage_alerts}
            onChange={(v) => updatePref('ai_usage_alerts', v)}
            disabled={!isEditing}
          />
        </div>
        {isEditing && (
          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 sm:hidden">
            {editorActions}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Segurança" description="Acesso, senha e autenticação em duas etapas.">
        <div className="divide-y divide-slate-100">
          <SettingsRow
            label="Responsável"
            description={`${settings?.admin_name ?? '—'} · ${ownerProfile.email || profile.email || '—'}`}
          >
            <span className="text-xs text-charcoal-muted">Titular da conta</span>
          </SettingsRow>
          <MfaSettingsSection />
          <SettingsRow label="Senha" description="Altere a senha na tela de acesso da plataforma.">
            <a
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50"
            >
              Alterar senha
            </a>
          </SettingsRow>
        </div>
      </SettingsSection>

      <CancelPlanModal isOpen={cancelPlanOpen} onClose={() => setCancelPlanOpen(false)} />

      <StandardModal
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Descartar alterações?"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDiscardOpen(false)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 md:w-auto"
            >
              Continuar editando
            </button>
            <button
              type="button"
              onClick={confirmDiscard}
              className="h-11 w-full rounded-xl bg-charcoal px-5 text-sm font-medium text-white transition-all hover:bg-charcoal-light md:w-auto"
            >
              Descartar
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-charcoal-muted">
          As alterações que você fez em perfil, {workspaceLabel} e notificações não serão salvas.
        </p>
      </StandardModal>
    </div>
  );
}
