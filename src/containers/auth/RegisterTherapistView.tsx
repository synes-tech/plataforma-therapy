import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { RegisterInput } from '@features/register/RegisterInput';
import { PhoneInput } from '@features/register/PhoneInput';
import { TherapistSpecialtySelect } from '@features/register/TherapistSpecialtySelect';
import { TermsOfUseModal } from '@features/legal/TermsOfUseModal';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { GoogleContinueButton } from './GoogleContinueButton';

export interface RegisterTherapistFormData {
  name: string;
  phone: string;
  email: string;
  confirm_email: string;
  password: string;
  confirm_password: string;
  specialty_id: string;
  specialty_other: string;
}

interface RegisterTherapistViewProps {
  step: 1 | 2;
  form: RegisterTherapistFormData;
  isSubmitting: boolean;
  isGoogleSubmitting?: boolean;
  googleEnabled?: boolean;
  error: string | null;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
  onFieldChange: (field: keyof RegisterTherapistFormData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void;
  onGoogleRegister?: () => void;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-6 w-full" aria-label={`Etapa ${step} de 2`}>
      <div className="flex gap-2">
        <div
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            step >= 1 ? 'bg-primary' : 'bg-slate-200'
          }`}
        />
        <div
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            step >= 2 ? 'bg-primary' : 'bg-slate-200'
          }`}
        />
      </div>
      <p className="mt-2 text-center text-xs text-charcoal-muted lg:text-left">
        Etapa {step} de 2 · {step === 1 ? 'Seus dados' : 'Especialidade'}
      </p>
    </div>
  );
}

function RegisterBrandingAside() {
  return (
    <aside className="relative hidden w-[55%] overflow-hidden lg:flex lg:items-center lg:justify-center">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='1' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`,
        }}
      />
      <div className="pointer-events-none absolute inset-0">
        <svg
          className="absolute -left-16 -top-16 h-80 w-80 text-primary-100 opacity-40"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path
            d="M47.5,-57.2C59.1,-46.8,64.5,-29.5,67.3,-11.7C70.1,6.2,70.2,24.5,62.1,38.2C54,51.9,37.6,61,20.3,65.8C3,70.5,-15.2,70.9,-30.8,64.7C-46.4,58.5,-59.3,45.7,-66.2,30.2C-73.1,14.7,-73.9,-3.5,-68.5,-19.3C-63,-35,-51.3,-48.3,-37.8,-58.2C-24.3,-68.1,-9,-74.7,4.9,-80.4C18.8,-86.1,35.9,-67.6,47.5,-57.2Z"
            transform="translate(100 100)"
          />
        </svg>
        <svg
          className="absolute -bottom-20 -right-12 h-72 w-72 text-ai-50 opacity-60"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path
            d="M39.5,-48.6C52.9,-38.2,66.8,-27.5,71.2,-13.6C75.6,0.3,70.5,17.4,61.4,31.2C52.3,44.9,39.2,55.3,24.3,60.8C9.5,66.3,-7.1,66.9,-22.1,62C-37.1,57.1,-50.5,46.7,-58.8,33.1C-67.1,19.5,-70.3,2.8,-66.9,-12C-63.5,-26.9,-53.5,-39.9,-41.2,-50.5C-28.9,-61,-14.4,-69.1,-0.5,-68.5C13.5,-67.9,26.1,-59,39.5,-48.6Z"
            transform="translate(100 100)"
          />
        </svg>
        <div className="absolute left-1/4 top-1/3 h-3 w-3 rounded-full bg-alert/20" />
        <div className="absolute bottom-1/3 right-1/3 h-2 w-2 rounded-full bg-primary-200/40" />
      </div>

      <div className="relative z-10 max-w-md px-12 xl:px-16">
        <div className="mb-10">
          <svg
            className="mx-auto h-44 w-44 text-charcoal/80"
            viewBox="0 0 200 200"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="100" cy="160" rx="60" ry="8" className="text-charcoal/5" fill="currentColor" stroke="none" />
            <rect x="55" y="95" width="22" height="22" rx="4" className="text-primary/60" stroke="currentColor" strokeWidth="1.5" />
            <rect x="82" y="85" width="22" height="22" rx="4" className="text-mint/60" stroke="currentColor" strokeWidth="1.5" />
            <rect x="109" y="92" width="22" height="22" rx="4" className="text-ai/40" stroke="currentColor" strokeWidth="1.5" />
            <path d="M60 130 C60 125, 65 120, 70 118 C75 116, 85 115, 90 118 C95 121, 95 126, 95 130" className="text-charcoal/70" />
            <path d="M108 128 C108 124, 112 121, 116 120 C120 119, 125 120, 128 123 C131 126, 131 130, 130 133" className="text-charcoal/60" />
            <path d="M140 70 L142 75 L147 77 L142 79 L140 84 L138 79 L133 77 L138 75 Z" className="text-alert/60" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <blockquote className="text-center">
          <p className="font-serif text-2xl font-medium leading-snug tracking-tight text-charcoal xl:text-3xl">
            Seu consultório,
            <br />
            <span className="italic text-primary-dark">organizado</span>
            <br />
            desde o primeiro dia.
          </p>
        </blockquote>

        <div className="mx-auto mt-8 h-px w-16 bg-charcoal/10" />

        <p className="mt-6 text-center text-sm leading-relaxed text-charcoal-muted/70">
          Prontuários, copiloto clínico e comunicação com famílias — tudo em um só lugar.
        </p>
      </div>
    </aside>
  );
}

export function RegisterTherapistView({
  step,
  form,
  isSubmitting,
  isGoogleSubmitting = false,
  googleEnabled = false,
  error,
  termsAccepted,
  onTermsAcceptedChange,
  onFieldChange,
  onNext,
  onBack,
  onSubmit,
  onGoogleRegister,
}: RegisterTherapistViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="relative flex min-h-dvh">
      <div className="absolute inset-0 lg:hidden">
        <div className="h-1/2 bg-white" />
        <div
          className="h-1/2"
          style={{
            background:
              'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
          }}
        />
      </div>

      <RegisterBrandingAside />

      <main className="relative z-10 flex w-full flex-col items-center justify-center overflow-y-auto px-6 py-8 lg:w-[45%] lg:bg-white lg:py-12">
        <div className="flex w-full max-w-sm flex-col">
          <div className="mb-8 text-center lg:text-left">
            <img
              src={BRAND_LOGO_SRC}
              alt="Unithery"
              className="mx-auto mb-8 h-16 w-auto lg:mx-0 lg:mb-10 lg:h-10"
            />
            <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal">
              Crie sua conta
            </h1>
            <p className="mt-2 text-sm text-charcoal-muted">
              {step === 1 ? 'Crie sua conta de terapeuta' : 'Quase lá — escolha sua especialidade'}
            </p>
          </div>

          <StepIndicator step={step} />

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-error" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a.75.75 0 100-1.5.75.75 0 000 1.5z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onNext();
              }}
              className="space-y-4"
            >
              {googleEnabled && onGoogleRegister && (
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => onTermsAcceptedChange(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-primary accent-[#1A86E2] focus:ring-primary/30"
                    />
                    <span className="text-sm leading-relaxed text-charcoal">
                      Li e aceito os <strong>Termos de Uso</strong> da Unithery.
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="pl-7 text-left text-xs font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:text-primary-dark"
                  >
                    Ler os Termos de Uso
                  </button>
                  <GoogleContinueButton
                    onClick={onGoogleRegister}
                    disabled={isSubmitting}
                    loading={isGoogleSubmitting}
                    label="Cadastrar com Google"
                    loadingLabel="Criando sua conta…"
                  />
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-medium uppercase tracking-wide text-charcoal-muted/60">ou</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                </div>
              )}
              <RegisterInput
                id="name"
                label="Seu nome completo *"
                value={form.name}
                onChange={(v) => onFieldChange('name', v)}
                required
                placeholder="Dr. João Silva"
                autoComplete="name"
              />

              <PhoneInput
                id="phone"
                label="Telefone"
                value={form.phone}
                onChange={(v) => onFieldChange('phone', v)}
                placeholder="(11) 99999-0000"
                autoComplete="tel"
              />

              <RegisterInput
                id="email"
                label="E-mail *"
                type="email"
                value={form.email}
                onChange={(v) => onFieldChange('email', v)}
                required
                placeholder="seu@email.com"
                autoComplete="email"
              />

              <RegisterInput
                id="confirm_email"
                label="Confirmar e-mail *"
                type="email"
                value={form.confirm_email}
                onChange={(v) => onFieldChange('confirm_email', v)}
                required
                placeholder="seu@email.com"
                autoComplete="email"
              />

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-charcoal">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => onFieldChange('password', e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-charcoal-muted/60 transition-colors hover:text-charcoal"
                    aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <RegisterInput
                id="confirm_password"
                label="Confirmar senha *"
                type={showPassword ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={(v) => onFieldChange('confirm_password', v)}
                required
                placeholder="Repita a senha"
                minLength={6}
                autoComplete="new-password"
              />

              <LoadingButton type="submit" variant="dark" fullWidth className="mt-2 h-12">
                Prosseguir
              </LoadingButton>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft lg:border-slate-100 lg:shadow-sm">
                <TherapistSpecialtySelect
                  selectedId={form.specialty_id}
                  otherValue={form.specialty_other}
                  onSelect={(id) => onFieldChange('specialty_id', id)}
                  onOtherChange={(v) => onFieldChange('specialty_other', v)}
                />
              </div>

              {/* Aceite obrigatório dos Termos de Uso */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft lg:border-slate-100 lg:shadow-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => onTermsAcceptedChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-primary accent-[#1A86E2] focus:ring-primary/30"
                  />
                  <span className="text-sm leading-relaxed text-charcoal">
                    Li e aceito o <strong>Contrato de Adesão e Termo de Uso Integrado</strong> da
                    Unithery.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="mt-2.5 pl-7 text-left text-xs font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:text-primary-dark"
                >
                  Clique aqui para ler os Termos de Uso
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onBack}
                  className="order-2 h-12 rounded-xl border border-slate-200 bg-white text-sm font-medium text-charcoal transition-all hover:border-charcoal/20 sm:order-1 sm:flex-1"
                >
                  Voltar
                </button>
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingLabel="Criando sua conta..."
                  variant="dark"
                  fullWidth
                  className="order-1 h-12 sm:order-2 sm:flex-[2]"
                >
                  Criar conta
                </LoadingButton>
              </div>
            </form>
          )}

          {step === 1 && (
            <>
              <p className="mt-8 text-center text-sm text-charcoal-muted lg:text-left">
                Já tem uma conta?{' '}
                <Link
                  to="/login"
                  className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-primary"
                >
                  Fazer login
                </Link>
              </p>
              <p className="mt-3 text-center text-sm text-charcoal-muted lg:text-left">
                Recebeu convite do terapeuta?{' '}
                <Link
                  to="/portal/register"
                  className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-primary"
                >
                  Crie o seu acesso
                </Link>
              </p>
            </>
          )}
        </div>

        <div className="pb-2 pt-8 text-center lg:hidden">
          <p className="text-xs text-charcoal-muted/40">© 2026 Unithery</p>
        </div>
      </main>

      <TermsOfUseModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          onTermsAcceptedChange(true);
          setTermsOpen(false);
        }}
        acceptLabel="Aceitar e continuar"
      />
    </div>
  );
}
