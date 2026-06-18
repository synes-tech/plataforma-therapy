import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { planLabel } from '@features/billing/format';

interface ClinicSettings {
  admin_name: string;
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
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        <p className="text-xs text-charcoal-muted">{description}</p>
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

function UsageBar({ label, used, max, unit }: { label: string; used: number; max: number; unit: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-charcoal">{label}</p>
        <p className="text-xs text-charcoal-muted">
          {used} / {max} {unit}
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${danger ? 'bg-error' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 font-display text-base font-semibold text-charcoal">{title}</h2>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
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
        preferences: prefs,
      }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-dashboard'] });
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function updatePref(key: PreferenceKey, value: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 space-y-4">
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  const quotas = data?.quotas;
  const usage = data?.ai_usage;
  const isSolo = data?.clinic.is_solo_professional ?? false;

  return (
    <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 md:mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Gerencie os dados da clínica, plano e notificações.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar as configurações. Tente novamente.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados da clínica */}
        <Card title={isSolo ? 'Dados do consultório' : 'Dados da clínica'}>
          <div className="space-y-4">
            <Field id="name" label="Nome" value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
            <Field id="email" label="E-mail de contato" type="email" value={profile.email} onChange={(v) => setProfile((p) => ({ ...p, email: v }))} />
            <Field id="phone" label="Telefone" value={profile.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} placeholder="(11) 99999-0000" />
            {!isSolo && (
              <Field id="document" label="CNPJ" value={profile.document} onChange={(v) => setProfile((p) => ({ ...p, document: v }))} placeholder="00.000.000/0001-00" />
            )}
          </div>
        </Card>

        {/* Plano e uso */}
        <Card title="Plano e uso">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs text-charcoal-muted">Plano atual</p>
              <p className="text-sm font-semibold text-charcoal">
                {planLabel(data?.clinic.subscription_plan ?? '', isSolo)}
              </p>
            </div>
            <a href="/billing/invoices" className="text-xs font-medium text-primary hover:text-primary-dark">
              Ver faturas →
            </a>
          </div>

          <div className="mt-5 space-y-4">
            <UsageBar
              label="Relatórios de IA (mês)"
              used={usage?.ai_reports_this_month ?? 0}
              max={quotas?.max_ai_queries_per_month ?? 0}
              unit=""
            />
            <UsageBar
              label="Minutos de áudio (mês)"
              used={usage?.audio_minutes_this_month ?? 0}
              max={quotas?.max_audio_minutes_per_month ?? 0}
              unit="min"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-charcoal-muted">Profissionais</p>
              <p className="font-medium text-charcoal">até {quotas?.max_professionals ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-charcoal-muted">Pacientes / prof.</p>
              <p className="font-medium text-charcoal">até {quotas?.max_patients_per_professional ?? 0}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-charcoal-muted/70">
            Limites do plano são definidos pela administração. Para alterar, fale com o suporte.
          </p>
        </Card>

        {/* Notificações */}
        <Card title="Notificações">
          <div className="divide-y divide-slate-100">
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
        </Card>

        {/* Conta */}
        <Card title="Conta">
          <p className="text-sm text-charcoal">
            Responsável: <span className="font-medium">{data?.admin_name}</span>
          </p>
          <p className="mt-1 text-sm text-charcoal-muted">{profile.email}</p>
          <a
            href="/login"
            className="mt-4 inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50"
          >
            Alterar senha
          </a>
        </Card>
      </div>

      {/* Save bar */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-mint-dark">Alterações salvas.</span>}
        {mutation.isError && (
          <span className="text-sm text-error">
            {(mutation.error as Error)?.message ?? 'Erro ao salvar.'}
          </span>
        )}
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="h-11 rounded-xl bg-charcoal px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
