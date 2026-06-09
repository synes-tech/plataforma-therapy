import { type FormEvent } from 'react';
import {
  type PlanId,
  PLAN_LABELS,
  getClinicSectionTitle,
  getRegisterTitle,
  getSubmitLabel,
  isSoloPlan,
} from './constants';
import { RegisterInput } from './RegisterInput';
import { RegisterProgressBar } from './RegisterProgressBar';

export interface RegisterFormData {
  clinic_name: string;
  clinic_email: string;
  clinic_phone: string;
  clinic_document: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  specialty: string;
}

interface RegisterFormViewProps {
  plan: PlanId;
  form: RegisterFormData;
  mobileStep: 1 | 2;
  isSubmitting: boolean;
  error: string | null;
  onFieldChange: (field: keyof RegisterFormData, value: string) => void;
  onBackToPlans: () => void;
  onMobileNext: () => void;
  onMobileBack: () => void;
  onSubmit: (e: FormEvent) => void;
}

function ClinicFields({
  plan,
  form,
  onFieldChange,
}: {
  plan: PlanId;
  form: RegisterFormData;
  onFieldChange: (field: keyof RegisterFormData, value: string) => void;
}) {
  const solo = isSoloPlan(plan);

  return (
    <div className="space-y-3 md:space-y-3.5">
      <RegisterInput
        id="clinic_name"
        label={solo ? 'Nome da clínica/consultório *' : 'Nome da clínica *'}
        value={form.clinic_name}
        onChange={(v) => onFieldChange('clinic_name', v)}
        required
        placeholder={solo ? 'Ex: Consultório Dra. Ana' : 'Ex: Clínica Evoluir'}
        autoComplete="organization"
      />
      <RegisterInput
        id="clinic_email"
        label="E-mail de contato *"
        type="email"
        value={form.clinic_email}
        onChange={(v) => onFieldChange('clinic_email', v)}
        required
        placeholder="contato@exemplo.com"
        autoComplete="email"
      />
      <RegisterInput
        id="clinic_phone"
        label="Telefone"
        value={form.clinic_phone}
        onChange={(v) => onFieldChange('clinic_phone', v)}
        placeholder="(11) 99999-0000"
        autoComplete="tel"
      />
      {solo ? (
        <RegisterInput
          id="specialty"
          label="Sua especialidade"
          value={form.specialty}
          onChange={(v) => onFieldChange('specialty', v)}
          placeholder="Psicóloga, Fonoaudióloga, T.O...."
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
  );
}

function AccessFields({
  form,
  onFieldChange,
}: {
  form: RegisterFormData;
  onFieldChange: (field: keyof RegisterFormData, value: string) => void;
}) {
  return (
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
  );
}

export function RegisterFormView({
  plan,
  form,
  mobileStep,
  isSubmitting,
  error,
  onFieldChange,
  onBackToPlans,
  onMobileNext,
  onMobileBack,
  onSubmit,
}: RegisterFormViewProps) {
  const showClinicStep = mobileStep === 1;
  const showAccessStep = mobileStep === 2;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto md:h-dvh md:overflow-hidden">
      {/* Fundo dividido — igual à tela de escolha de planos */}
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

      {/* Top bar */}
      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 pt-5 md:px-8 md:pt-6">
        <button
          type="button"
          onClick={onBackToPlans}
          className="text-xs font-medium text-charcoal-muted transition-colors hover:text-charcoal"
        >
          ← Voltar para planos
        </button>
        <p className="text-xs text-charcoal-muted">
          Plano:{' '}
          <span className="font-medium text-charcoal">{PLAN_LABELS[plan]}</span>{' '}
          <button
            type="button"
            onClick={onBackToPlans}
            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary-dark"
          >
            (Mudar)
          </button>
        </p>
      </header>

      {/* Logo — alinhado às telas de login e planos */}
      <div className="relative z-10 flex shrink-0 justify-center pt-4 md:pt-3">
        <img
          src="/src/assets/logotherapy.png"
          alt="Therapy.AI"
          className="h-8 w-auto md:h-9"
        />
      </div>

      {/* Título */}
      <div className="relative z-10 shrink-0 px-6 pt-4 text-center md:pt-5">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          {getRegisterTitle()}
        </h1>
        <p className="mt-1.5 text-sm text-charcoal-muted">
          Configure seu ambiente clínico e seus dados de acesso.
        </p>
      </div>

      {/* Progresso mobile */}
      <div className="relative z-10 shrink-0 pt-5">
        <RegisterProgressBar currentStep={mobileStep} />
      </div>

      {/* Erro global */}
      {error && (
        <div
          role="alert"
          className="relative z-10 mx-5 mt-4 shrink-0 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error md:mx-auto md:max-w-5xl md:w-full"
        >
          {error}
        </div>
      )}

      {/* Formulário */}
      <form
        onSubmit={onSubmit}
        className="relative z-10 shrink-0 px-5 pb-6 pt-5 md:px-8 md:pb-8 md:pt-6"
      >
        {/* Box branca — altura conforme o conteúdo */}
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
          <div className="grid md:grid-cols-2 md:gap-x-10 md:items-start lg:gap-x-14">
          {/* Coluna 1 — Dados do espaço */}
          <section
            className={`md:block ${showClinicStep ? 'block' : 'hidden'}`}
            aria-labelledby="clinic-section-title"
          >
            <h2
              id="clinic-section-title"
              className="mb-4 font-display text-sm font-semibold text-charcoal"
            >
              {getClinicSectionTitle(plan)}
            </h2>
            <ClinicFields plan={plan} form={form} onFieldChange={onFieldChange} />

            {/* Mobile: próximo passo */}
            <button
              type="button"
              onClick={onMobileNext}
              className="mt-6 h-12 w-full rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-charcoal-light active:scale-[0.98] md:hidden"
            >
              Próximo passo
            </button>
          </section>

          {/* Coluna 2 — Dados de acesso */}
          <section
            className={`md:flex md:flex-col md:border-l md:border-slate-100 md:pl-8 lg:pl-10 ${
              showAccessStep ? 'block' : 'hidden md:block'
            }`}
            aria-labelledby="access-section-title"
          >
            <h2
              id="access-section-title"
              className="mb-4 font-display text-sm font-semibold text-charcoal"
            >
              2. Seus dados de acesso
            </h2>
            <AccessFields form={form} onFieldChange={onFieldChange} />

            {/* Mobile: voltar */}
            <button
              type="button"
              onClick={onMobileBack}
              className="mt-4 w-full text-center text-xs font-medium text-charcoal-muted transition-colors hover:text-charcoal md:hidden"
            >
              ← Voltar para {isSoloPlan(plan) ? 'dados do consultório' : 'dados da clínica'}
            </button>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`mt-6 h-12 w-full rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-charcoal-light hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:mt-8 ${
                showAccessStep ? 'block' : 'hidden md:block'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Criando...
                </span>
              ) : (
                getSubmitLabel(plan)
              )}
            </button>
          </section>
          </div>
        </div>

        {/* Footer */}
        <p className="mx-auto mt-6 shrink-0 text-center text-sm text-charcoal-muted md:mt-5">
          Já tem uma conta?{' '}
          <a
            href="/login"
            className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
          >
            Fazer login
          </a>
        </p>
      </form>
    </div>
  );
}
