import { type FormEvent } from 'react';
import type { AccountType } from '@features/register/account-type';
import { ACCOUNT_TYPE_DESCRIPTIONS, ACCOUNT_TYPE_LABELS } from '@features/register/account-type';
import { RegisterInput } from '@features/register/RegisterInput';
import { PhoneInput } from '@features/register/PhoneInput';
import { RegisterProgressBar } from '@features/register/RegisterProgressBar';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';

export interface RegisterOnboardingFormData {
  clinic_name: string;
  clinic_email: string;
  clinic_phone: string;
  clinic_document: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  specialty: string;
}

interface RegisterOnboardingViewProps {
  accountType: AccountType;
  onAccountTypeChange: (type: AccountType) => void;
  form: RegisterOnboardingFormData;
  mobileStep: 1 | 2;
  isSubmitting: boolean;
  error: string | null;
  onFieldChange: (field: keyof RegisterOnboardingFormData, value: string) => void;
  onMobileNext: () => void;
  onMobileBack: () => void;
  onSubmit: (e: FormEvent) => void;
}

export function RegisterOnboardingView({
  accountType,
  onAccountTypeChange,
  form,
  mobileStep,
  isSubmitting,
  error,
  onFieldChange,
  onMobileNext,
  onMobileBack,
  onSubmit,
}: RegisterOnboardingViewProps) {
  const isSolo = accountType === 'solo';
  const showClinicStep = mobileStep === 1;
  const showAccessStep = mobileStep === 2;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto md:h-dvh md:overflow-hidden">
      <div className="absolute inset-0">
        <div className="h-1/2 bg-white" />
        <div
          className="h-1/2"
          style={{
            background:
              'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
          }}
        />
      </div>

      <div className="relative z-10 flex shrink-0 justify-center pt-8 md:pt-10">
        <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-9 w-auto" />
      </div>

      <div className="relative z-10 shrink-0 px-6 pt-6 text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          Crie sua conta
        </h1>
        <p className="mt-1.5 text-sm text-charcoal-muted">
          Comece grátis — 14 dias para explorar o Unithery sem cartão.
        </p>
      </div>

      <div className="relative z-10 mx-auto mt-8 w-full max-w-2xl px-5">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-charcoal-muted">
          Tipo de conta
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['solo', 'corporate'] as AccountType[]).map((type) => {
            const active = accountType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onAccountTypeChange(type)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? 'border-primary/50 bg-white shadow-[0_0_24px_rgba(13,148,136,0.12)] ring-1 ring-primary/30'
                    : 'border-slate-200/80 bg-white/80 hover:border-primary/25'
                }`}
              >
                <span className={`text-sm font-semibold ${active ? 'text-primary-dark' : 'text-charcoal'}`}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-charcoal-muted">
                  {ACCOUNT_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 shrink-0 pt-6">
        <RegisterProgressBar currentStep={mobileStep} />
      </div>

      {error && (
        <div
          role="alert"
          className="relative z-10 mx-5 mt-4 shrink-0 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error md:mx-auto md:max-w-5xl md:w-full"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="relative z-10 shrink-0 px-5 pb-8 pt-5 md:px-8"
      >
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm md:p-6">
          <div className="grid md:grid-cols-2 md:gap-x-10 md:items-start lg:gap-x-14">
            <section className={`md:block ${showClinicStep ? 'block' : 'hidden'}`}>
              <h2 className="mb-4 font-display text-sm font-semibold text-charcoal">
                {isSolo ? '1. Dados do consultório' : '1. Dados da clínica'}
              </h2>
              <div className="space-y-3 md:space-y-3.5">
                {!isSolo && (
                  <RegisterInput
                    id="clinic_name"
                    label="Nome da clínica *"
                    value={form.clinic_name}
                    onChange={(v) => onFieldChange('clinic_name', v)}
                    required
                    placeholder="Ex: Clínica Evoluir"
                    autoComplete="organization"
                  />
                )}
                <RegisterInput
                  id="clinic_email"
                  label={isSolo ? 'E-mail profissional *' : 'E-mail de contato *'}
                  type="email"
                  value={form.clinic_email}
                  onChange={(v) => onFieldChange('clinic_email', v)}
                  required
                  placeholder="contato@exemplo.com"
                  autoComplete="email"
                />
                <PhoneInput
                  id="clinic_phone"
                  label="Telefone"
                  value={form.clinic_phone}
                  onChange={(v) => onFieldChange('clinic_phone', v)}
                  placeholder="(11) 99999-0000"
                  autoComplete="tel"
                />
                {isSolo ? (
                  <RegisterInput
                    id="specialty"
                    label="Sua especialidade"
                    value={form.specialty}
                    onChange={(v) => onFieldChange('specialty', v)}
                    placeholder="Psicologia, Fonoaudiologia..."
                  />
                ) : (
                  <RegisterInput
                    id="clinic_document"
                    label="CNPJ (opcional)"
                    value={form.clinic_document}
                    onChange={(v) => onFieldChange('clinic_document', v)}
                    placeholder="12.345.678/0001-90"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={onMobileNext}
                className="mt-6 h-12 w-full rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] md:hidden"
              >
                Próximo passo
              </button>
            </section>

            <section
              className={`md:flex md:flex-col md:border-l md:border-slate-100 md:pl-8 lg:pl-10 ${
                showAccessStep ? 'block' : 'hidden md:block'
              }`}
            >
              <h2 className="mb-4 font-display text-sm font-semibold text-charcoal">
                2. Seus dados de acesso
              </h2>
              <div className="space-y-3 md:space-y-3.5">
                <RegisterInput
                  id="admin_name"
                  label="Seu nome completo *"
                  value={form.admin_name}
                  onChange={(v) => onFieldChange('admin_name', v)}
                  required
                  placeholder="Dr. João Silva"
                  autoComplete="name"
                />
                <RegisterInput
                  id="admin_email"
                  label="E-mail de login *"
                  type="email"
                  value={form.admin_email}
                  onChange={(v) => onFieldChange('admin_email', v)}
                  required
                  placeholder="joao@email.com"
                  autoComplete="email"
                />
                <RegisterInput
                  id="admin_password"
                  label="Crie uma senha *"
                  type="password"
                  value={form.admin_password}
                  onChange={(v) => onFieldChange('admin_password', v)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="button"
                onClick={onMobileBack}
                className="mt-4 w-full text-center text-xs font-medium text-charcoal-muted transition-colors hover:text-charcoal md:hidden"
              >
                ← Voltar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`mt-6 h-12 w-full rounded-xl border border-primary/30 bg-primary/10 text-sm font-medium text-primary shadow-[0_0_20px_rgba(13,148,136,0.15)] backdrop-blur-sm transition-all hover:bg-primary/15 hover:shadow-[0_0_28px_rgba(13,148,136,0.22)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:mt-8 ${
                  showAccessStep ? 'block' : 'hidden md:block'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    Criando sua conta...
                  </span>
                ) : (
                  'Começar teste grátis'
                )}
              </button>
            </section>
          </div>
        </div>

        <p className="mx-auto mt-6 text-center text-sm text-charcoal-muted">
          Já tem uma conta?{' '}
          <a
            href="/login"
            className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-primary"
          >
            Fazer login
          </a>
        </p>
      </form>
    </div>
  );
}
