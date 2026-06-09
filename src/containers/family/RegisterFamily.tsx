import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ApiResponse } from '@shared/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const ERROR_TRANSLATIONS: Record<string, string> = {
  CONFLICT: 'Já existe uma conta com este e-mail. Faça login para vincular o convite.',
  INVITE_NOT_FOUND: 'Código de convite inválido.',
  INVITE_CONSUMED: 'Este convite já foi utilizado.',
  INVITE_EXPIRED: 'Este convite expirou. Solicite um novo ao terapeuta.',
  INVITE_REVOKED: 'Este convite foi revogado.',
  FAMILY_QUOTA_EXCEEDED: 'Limite de familiares para este paciente já atingido.',
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos.',
};

/**
 * RegisterFamily — onboarding do responsável (PWA mobile-first).
 * Cadastro direto via Edge Function (sem confirmação de e-mail).
 */
export default function RegisterFamily() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/register-family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          invite_code: code.trim(),
        }),
      });

      const data: ApiResponse<{ message: string }> = await response.json();

      if (!data.success) {
        const code = data.error?.code ?? 'UNKNOWN';
        throw new Error(ERROR_TRANSLATIONS[code] ?? data.error?.message ?? 'Erro ao criar conta');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex h-dvh overflow-hidden">
      {/* Mobile: fundo dividido */}
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

      {/* Desktop: painel de branding */}
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
            className="absolute -bottom-20 -right-12 h-72 w-72 text-mint/30 opacity-60"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path
              d="M39.5,-48.6C52.9,-38.2,66.8,-27.5,71.2,-13.6C75.6,0.3,70.5,17.4,61.4,31.2C52.3,44.9,39.2,55.3,24.3,60.8C9.5,66.3,-7.1,66.9,-22.1,62C-37.1,57.1,-50.5,46.7,-58.8,33.1C-67.1,19.5,-70.3,2.8,-66.9,-12C-63.5,-26.9,-53.5,-39.9,-41.2,-50.5C-28.9,-61,-14.4,-69.1,-0.5,-68.5C13.5,-67.9,26.1,-59,39.5,-48.6Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        <div className="relative z-10 max-w-md px-12 xl:px-16">
          <div className="mb-8 [@media(max-height:800px)]:mb-5">
            <svg
              className="mx-auto h-40 w-40 text-charcoal/80 [@media(max-height:800px)]:h-32 [@media(max-height:800px)]:w-32"
              viewBox="0 0 200 200"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="100" cy="168" rx="56" ry="7" className="text-charcoal/5" fill="currentColor" stroke="none" />
              <rect x="62" y="88" width="76" height="52" rx="8" className="text-white" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
              <path d="M72 104h56M72 116h40M72 128h48" className="text-charcoal/30" />
              <circle cx="148" cy="108" r="10" className="text-mint/40" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
              <path d="M145 108l2 2 5-5" className="text-mint-dark" />
              <path d="M55 75 C55 65, 70 58, 85 62 C95 65, 100 72, 100 72" className="text-charcoal/50" />
              <path d="M145 75 C145 65, 130 58, 115 62 C105 65, 100 72, 100 72" className="text-charcoal/40" />
              <circle cx="78" cy="68" r="3" className="text-charcoal/30" fill="currentColor" stroke="none" />
              <circle cx="122" cy="68" r="3" className="text-charcoal/30" fill="currentColor" stroke="none" />
            </svg>
          </div>

          <blockquote className="text-center">
            <p className="font-serif text-2xl font-medium leading-snug tracking-tight text-charcoal xl:text-3xl [@media(max-height:800px)]:text-xl">
              Acompanhe cada passo,
              <br />
              <span className="italic text-primary-dark">junto</span> com quem cuida.
            </p>
          </blockquote>

          <div className="mx-auto mt-6 h-px w-16 bg-charcoal/10 [@media(max-height:800px)]:mt-4" />

          <p className="mt-5 text-center text-sm leading-relaxed text-charcoal-muted/70 [@media(max-height:800px)]:mt-3 [@media(max-height:800px)]:text-xs">
            Diário da rotina, acordos terapêuticos
            <br />
            e comunicação direta com o terapeuta.
          </p>
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative z-10 flex h-dvh min-h-0 w-full flex-col overflow-hidden lg:w-[45%] lg:bg-white">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:items-center lg:justify-center lg:overflow-hidden lg:px-8">
          <div className="mx-auto flex w-full max-w-sm min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pb-6 sm:pt-8 lg:max-h-full lg:flex-none lg:justify-center lg:py-6">
            {/* Logo mobile */}
            <div className="mb-4 shrink-0 text-center sm:mb-6 lg:hidden [@media(max-height:640px)]:mb-3">
              <img
                src="/src/assets/logotherapy.png"
                alt="Therapy.AI"
                className="mx-auto h-12 w-auto sm:h-14 [@media(max-height:640px)]:h-10"
              />
            </div>

            {/* Logo desktop */}
            <div className="mb-6 hidden shrink-0 lg:block [@media(max-height:800px)]:mb-4">
              <img src="/src/assets/logotherapy.png" alt="Therapy.AI" className="h-9 w-auto [@media(max-height:800px)]:h-8" />
            </div>

            {/* Título */}
            <div className="mb-4 shrink-0 text-center sm:mb-5 lg:text-left [@media(max-height:640px)]:mb-3">
              <h1 className="font-serif text-xl font-medium tracking-tight text-charcoal sm:text-2xl lg:font-display lg:text-2xl lg:font-bold [@media(max-height:640px)]:text-lg">
                Portal da Família
              </h1>
              <p className="mt-1 text-xs text-charcoal-muted sm:mt-1.5 sm:text-sm [@media(max-height:640px)]:text-[0.7rem]">
                Crie sua conta com o código que o terapeuta enviou.
              </p>
            </div>

            {/* Card do formulário — scroll interno só em telas muito baixas */}
            <div className="min-h-0 flex-1 lg:flex-none">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:rounded-3xl sm:p-5 lg:p-6 [@media(max-height:640px)]:p-3.5">
                {error && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-xl border border-error/15 bg-error-light/40 px-3 py-2.5 text-xs text-error sm:mb-5 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a.75.75 0 100-1.5.75.75 0 000 1.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {error}
                  </div>
                )}
                {success ? (
                  <div className="text-center">
                    <div
                      role="status"
                      className="mb-6 rounded-xl border border-mint/20 bg-mint/10 px-4 py-4 text-sm text-mint-dark sm:px-5 sm:py-5"
                    >
                      <svg
                        className="mx-auto mb-3 h-10 w-10 text-mint"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-medium text-charcoal">Conta criada com sucesso!</p>
                      <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
                        Seu cadastro foi concluído e o convite já está vinculado. Agora é só entrar com seu e-mail e senha.
                      </p>
                    </div>
                    <Link
                      to="/login"
                      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98]"
                    >
                      Clicar aqui para logar
                    </Link>
                  </div>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 [@media(max-height:640px)]:space-y-2.5">
                  <Field label="Seu nome" htmlFor="name">
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Maria Silva"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="E-mail" htmlFor="email">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="seu@email.com"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Senha" htmlFor="password">
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Mínimo 6 caracteres"
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-charcoal-muted/60 hover:text-charcoal sm:right-4"
                        aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </Field>

                  <Field label="Código de convite" htmlFor="code">
                    <input
                      id="code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.slice(0, 8))}
                      required
                      maxLength={8}
                      placeholder="AbC12xYz"
                      className={`${inputClass} font-mono text-base tracking-[0.25em] sm:text-lg sm:tracking-[0.3em]`}
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-1 h-11 w-full rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:mt-2 sm:h-12 [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:text-xs"
                  >
                    {isSubmitting ? 'Criando conta...' : 'Criar conta e vincular'}
                  </button>
                </form>
                )}
              </div>
            </div>

            {!success && (
            <p className="mt-4 shrink-0 text-center text-xs text-charcoal-muted sm:mt-5 sm:text-sm [@media(max-height:640px)]:mt-3">
              Já tem conta?{' '}
              <Link
                to="/login"
                className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-primary"
              >
                Entrar
              </Link>
            </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 sm:h-12 sm:px-4 [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:px-3 [@media(max-height:640px)]:text-xs';

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-charcoal sm:mb-1.5 sm:text-sm [@media(max-height:640px)]:mb-0.5 [@media(max-height:640px)]:text-[0.7rem]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
    </svg>
  );
}
