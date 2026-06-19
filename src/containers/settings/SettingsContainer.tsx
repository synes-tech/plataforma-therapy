import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton, PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { OwnerProfilePhotoUpload } from './OwnerProfilePhotoUpload';
import { uploadOwnerAvatarFile } from './owner-avatar.upload';

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

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-charcoal-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ${
            checked
              ? 'translate-x-5 bg-charcoal'
              : 'translate-x-0 bg-white ring-1 ring-slate-300/60'
          }`}
        />
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-card-surface w-full rounded-2xl p-5 sm:p-6">
      <header className="mb-5 border-b border-slate-100/80 pb-4">
        <h2 className="font-display text-base font-semibold text-charcoal">{title}</h2>
        {description && <p className="mt-1 text-sm text-charcoal-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  readOnly,
  className = '',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 ${
          readOnly ? 'cursor-default bg-slate-50 text-charcoal-muted' : 'bg-white'
        }`}
      />
    </div>
  );
}

export default function SettingsContainer() {
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (data) {
      setProfile({
        name: data.clinic.name ?? '',
        email: data.clinic.email ?? '',
        phone: data.clinic.phone ?? '',
        document: data.clinic.document ?? '',
      });
      setPrefs(data.preferences);
      if (data.owner_profile) {
        setOwnerProfile({
          name: data.owner_profile.name ?? '',
          email: data.owner_profile.email ?? '',
          specialty: data.owner_profile.specialty ?? '',
          crp: data.owner_profile.crp ?? '',
          foto_url: data.owner_profile.foto_url ?? null,
          kind: data.owner_profile.kind,
        });
      }
    }
  }, [data]);

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
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['professional-avatar-url'] });
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

  if (isLoading) {
    return <PageLoader label="Carregando configurações..." className="min-h-[40vh]" />;
  }

  const isSolo = data?.clinic.is_solo_professional ?? false;

  return (
    <div className="flex w-full flex-col gap-6">
      {error && (
        <div role="alert" className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar as configurações. Tente novamente.
        </div>
      )}

      <SettingsSection
        title="Meu perfil"
        description="Sua foto e dados pessoais exibidos no menu e nas comunicações da plataforma."
      >
        <div className="flex flex-col items-center gap-6 border-b border-slate-100/80 pb-6">
          <OwnerProfilePhotoUpload
            name={ownerProfile.name || data?.admin_name || 'Usuário'}
            fotoUrl={ownerProfile.foto_url}
            previewUrl={photoPreview}
            uploading={photoUploading}
            onFileSelected={(file) => void handlePhotoSelected(file)}
            onValidationError={setPhotoError}
          />
          {photoError && (
            <p className="text-sm text-error" role="alert">
              {photoError}
            </p>
          )}
        </div>

        <div className="mt-6 grid w-full gap-4 sm:grid-cols-2">
          <Field
            id="owner-name"
            label="Nome"
            value={ownerProfile.name}
            onChange={(v) => setOwnerProfile((p) => ({ ...p, name: v }))}
          />
          <Field
            id="owner-email"
            label="E-mail"
            type="email"
            value={ownerProfile.email}
            onChange={() => {}}
            readOnly
          />
          {ownerProfile.kind === 'professional' && (
            <>
              <Field
                id="owner-specialty"
                label="Especialidade"
                value={ownerProfile.specialty}
                onChange={(v) => setOwnerProfile((p) => ({ ...p, specialty: v }))}
                placeholder="Psicólogo, Fonoaudiólogo..."
              />
              <Field
                id="owner-crp"
                label="Registro profissional"
                value={ownerProfile.crp}
                onChange={(v) => setOwnerProfile((p) => ({ ...p, crp: v }))}
                placeholder="CRP, CRFa..."
              />
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={isSolo ? 'Dados do consultório' : 'Dados da clínica'}
        description={
          isSolo
            ? 'Informações de contato do seu consultório autônomo.'
            : 'Dados institucionais da clínica visíveis em documentos e faturas.'
        }
      >
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field
            id="name"
            label="Nome"
            value={profile.name}
            onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
            className={isSolo ? 'sm:col-span-2' : ''}
          />
          <Field
            id="email"
            label="E-mail de contato"
            type="email"
            value={profile.email}
            onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
          />
          <Field
            id="phone"
            label="Telefone"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
            placeholder="(11) 99999-0000"
          />
          {!isSolo && (
            <Field
              id="document"
              label="CNPJ"
              value={profile.document}
              onChange={(v) => setProfile((p) => ({ ...p, document: v }))}
              placeholder="00.000.000/0001-00"
            />
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notificações"
        description="Escolha quais avisos você deseja receber por e-mail."
      >
        <div className="flex w-full flex-col gap-2.5">
          <Toggle
            label="Alertas de crise por e-mail"
            description="Receba um e-mail quando uma família registrar uma crise."
            checked={prefs.crisis_alerts_email}
            onChange={(v) => updatePref('crisis_alerts_email', v)}
          />
          <Toggle
            label="Resumo semanal"
            description="Um panorama da clínica enviado toda semana."
            checked={prefs.weekly_digest_email}
            onChange={(v) => updatePref('weekly_digest_email', v)}
          />
          <Toggle
            label="Alertas de uso de IA"
            description="Avisar quando o uso de IA se aproximar do limite do plano."
            checked={prefs.ai_usage_alerts}
            onChange={(v) => updatePref('ai_usage_alerts', v)}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Conta" description="Credenciais e responsável legal pela conta.">
        <div className="flex w-full flex-col gap-4">
          <div className="min-w-0">
            <p className="text-sm text-charcoal">
              Responsável: <span className="font-semibold">{data?.admin_name}</span>
            </p>
            <p className="mt-1 text-sm text-charcoal-muted">{profile.email}</p>
          </div>
          <a
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50 sm:w-auto sm:self-start"
          >
            Alterar senha
          </a>
        </div>
      </SettingsSection>

      <div className="flex w-full flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex min-h-[1.25rem] items-center justify-center sm:justify-end">
          {saved && <span className="text-sm font-medium text-mint-dark">Alterações salvas.</span>}
          {mutation.isError && (
            <span className="text-sm text-error">
              {(mutation.error as Error)?.message ?? 'Erro ao salvar.'}
            </span>
          )}
        </div>
        <LoadingButton
          type="button"
          variant="dark"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="h-11 px-6 sm:min-w-[11rem]"
        >
          Salvar alterações
        </LoadingButton>
      </div>
    </div>
  );
}
