import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { AuthLoginModeToggle } from '@containers/auth/AuthLoginModeToggle';
import type { AuthLoginMode } from '@containers/auth/AuthLoginModeToggle';
import { MfaSmsChallengeModal } from '@containers/auth/MfaSmsChallengeModal';
import { useAuth } from '@shared/hooks/useAuth';
import { useAuthStore } from '@shared/lib/auth-store';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { isMfaRequiredError } from '@shared/lib/firebase-mfa';
import { isFirebaseAuthConfigured } from '@shared/lib/firebase';
import { getRetryAfterSeconds, isRateLimitedError } from '@shared/lib/rate-limit-message';
import { RateLimitMessage } from '@shared/ui/RateLimitMessage';
import { GoogleContinueButton } from './GoogleContinueButton';

function resolvePostLoginPath(role: string | undefined): string {
  return role === 'family' ? '/portal/diary' : '/dashboard';
}

function loginModeFromSearch(params: URLSearchParams): AuthLoginMode {
  return params.get('mode') === 'family' ? 'family' : 'therapist';
}

export default function LoginContainer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const emailJustConfirmed = searchParams.get('confirmed') === '1';
  const [loginMode, setLoginMode] = useState<AuthLoginMode>(() => loginModeFromSearch(searchParams));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const { login, loginWithGoogle, completeMfaLogin, clearPendingMfa, pendingMfaResolver } = useAuth();
  const navigate = useNavigate();
  const googleEnabled = isFirebaseAuthConfigured();

  const isFamilyMode = loginMode === 'family';

  function handleLoginModeChange(mode: AuthLoginMode) {
    setLoginMode(mode);
    setError(null);
    const next = new URLSearchParams(searchParams);
    if (mode === 'family') {
      next.set('mode', 'family');
    } else {
      next.delete('mode');
    }
    setSearchParams(next, { replace: true });
  }

  function mapLoginError(err: unknown): string {
    if (isMfaRequiredError(err)) return '';
    if (!(err instanceof Error)) return 'Erro inesperado. Tente novamente.';
    const msg = err.message;
    if (msg === 'Invalid login credentials') return 'Email ou senha incorretos.';
    if (msg === 'Email not confirmed' || msg.toLowerCase().includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
    }
    if (msg.includes('Tempo limite')) return 'Servidor demorou para responder. Tente novamente.';
    return msg;
  }

  function goAfterLogin() {
    const role = useAuthStore.getState().user?.role;
    navigate(resolvePostLoginPath(role), { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRetryAfterSeconds(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      goAfterLogin();
    } catch (err) {
      if (isMfaRequiredError(err)) {
        setMfaOpen(true);
      } else if (isRateLimitedError(err)) {
        setRetryAfterSeconds(getRetryAfterSeconds(err));
      } else {
        setError(mapLoginError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setRetryAfterSeconds(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle();
      goAfterLogin();
    } catch (err) {
      if (isMfaRequiredError(err)) {
        setMfaOpen(true);
      } else {
        setError(mapLoginError(err));
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  function handleMfaClose() {
    setMfaOpen(false);
    clearPendingMfa();
  }

  async function handleMfaVerify(verificationId: string, code: string) {
    await completeMfaLogin(verificationId, code);
    setMfaOpen(false);
    goAfterLogin();
  }

  return (
    <div className="relative flex min-h-dvh">
      <MfaSmsChallengeModal
        isOpen={mfaOpen && Boolean(pendingMfaResolver)}
        resolver={pendingMfaResolver}
        onClose={handleMfaClose}
        onVerify={handleMfaVerify}
      />
      {/* Mobile: fundo dividido — metade branca, metade pastel (igual planos/cadastro) */}
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

      {/* Left: Visual Branding — Conceito de Acolhimento Humano */}
      <aside className="relative hidden w-[55%] overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:items-center lg:justify-center">
        {/* Fundo com textura orgânica suave — tons pastel quentes */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
          }}
        />

        {/* Textura de linho sutil */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='1' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`,
          }}
        />

        {/* Formas orgânicas decorativas — estilo recorte de papel */}
        <div className="pointer-events-none absolute inset-0">
          {/* Forma orgânica principal — canto superior esquerdo */}
          <svg
            className="absolute -left-16 -top-16 h-80 w-80 text-primary-100 opacity-40"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path d="M47.5,-57.2C59.1,-46.8,64.5,-29.5,67.3,-11.7C70.1,6.2,70.2,24.5,62.1,38.2C54,51.9,37.6,61,20.3,65.8C3,70.5,-15.2,70.9,-30.8,64.7C-46.4,58.5,-59.3,45.7,-66.2,30.2C-73.1,14.7,-73.9,-3.5,-68.5,-19.3C-63,-35,-51.3,-48.3,-37.8,-58.2C-24.3,-68.1,-9,-74.7,4.9,-80.4C18.8,-86.1,35.9,-67.6,47.5,-57.2Z" transform="translate(100 100)" />
          </svg>

          {/* Forma orgânica secundária — canto inferior direito */}
          <svg
            className="absolute -bottom-20 -right-12 h-72 w-72 text-ai-50 opacity-60"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path d="M39.5,-48.6C52.9,-38.2,66.8,-27.5,71.2,-13.6C75.6,0.3,70.5,17.4,61.4,31.2C52.3,44.9,39.2,55.3,24.3,60.8C9.5,66.3,-7.1,66.9,-22.1,62C-37.1,57.1,-50.5,46.7,-58.8,33.1C-67.1,19.5,-70.3,2.8,-66.9,-12C-63.5,-26.9,-53.5,-39.9,-41.2,-50.5C-28.9,-61,-14.4,-69.1,-0.5,-68.5C13.5,-67.9,26.1,-59,39.5,-48.6Z" transform="translate(100 100)" />
          </svg>

          {/* Círculo dourado sutil — acolhimento */}
          <div className="absolute left-1/4 top-1/3 h-3 w-3 rounded-full bg-alert/20" />
          <div className="absolute bottom-1/3 right-1/3 h-2 w-2 rounded-full bg-primary-200/40" />
        </div>

        {/* Conteúdo central do lado esquerdo */}
        <div className="relative z-10 max-w-md px-12 xl:px-16">
          {/* Ilustração de linha — interação terapeuta/criança */}
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
              {/* Mão adulta segurando mão infantil — ilustração de linha */}
              <ellipse cx="100" cy="160" rx="60" ry="8" className="text-charcoal/5" fill="currentColor" stroke="none" />
              {/* Blocos coloridos (terapia lúdica) */}
              <rect x="55" y="95" width="22" height="22" rx="4" className="text-primary/60" stroke="currentColor" strokeWidth="1.5" />
              <rect x="82" y="85" width="22" height="22" rx="4" className="text-mint/60" stroke="currentColor" strokeWidth="1.5" />
              <rect x="109" y="92" width="22" height="22" rx="4" className="text-ai/40" stroke="currentColor" strokeWidth="1.5" />
              {/* Mão do adulto (terapeuta) — linhas suaves */}
              <path d="M60 130 C60 125, 65 120, 70 118 C75 116, 85 115, 90 118 C95 121, 95 126, 95 130" className="text-charcoal/70" />
              <path d="M65 130 C65 133, 67 136, 70 137" className="text-charcoal/50" />
              <path d="M75 130 C75 134, 77 137, 80 138" className="text-charcoal/50" />
              {/* Mão da criança — menor, mais suave */}
              <path d="M108 128 C108 124, 112 121, 116 120 C120 119, 125 120, 128 123 C131 126, 131 130, 130 133" className="text-charcoal/60" />
              <path d="M112 133 C112 135, 114 137, 116 137" className="text-charcoal/40" />
              {/* Estrelas/sparkles de progresso */}
              <path d="M140 70 L142 75 L147 77 L142 79 L140 84 L138 79 L133 77 L138 75 Z" className="text-alert/60" fill="currentColor" stroke="none" />
              <path d="M55 65 L56 68 L59 69 L56 70 L55 73 L54 70 L51 69 L54 68 Z" className="text-primary/50" fill="currentColor" stroke="none" />
              <circle cx="165" cy="90" r="2" className="text-mint/50" fill="currentColor" stroke="none" />
            </svg>
          </div>

          {/* Frase de impacto — tipografia serifada premium */}
          <blockquote className="text-center">
            <p className="font-serif text-2xl font-medium leading-snug tracking-tight text-charcoal xl:text-3xl">
              O cuidado humano,
              <br />
              <span className="italic text-primary-dark">potencializado</span>
              <br />
              por tecnologia.
            </p>
          </blockquote>

          {/* Linha decorativa sutil */}
          <div className="mx-auto mt-8 h-px w-16 bg-charcoal/10" />

          {/* Subtítulo descritivo */}
          <p className="mt-6 text-center text-sm leading-relaxed text-charcoal-muted/70">
            Copiloto clínico para terapeutas infantis.
            <br />
            Relatórios inteligentes. Contexto individualizado.
          </p>
        </div>
      </aside>

      {/* Right: Login Form — rolável para o modo Portal não ficar cortado */}
      <main className="relative z-10 w-full min-h-dvh overflow-y-auto overscroll-contain px-6 lg:w-[45%] lg:bg-white">
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center py-10">
          {/* Mobile: Logo + Branding compacto */}
          <div className="mb-10 w-full text-center lg:hidden">
            <img
              src={BRAND_LOGO_SRC}
              alt="Unithery"
              className="mx-auto h-16 w-auto"
            />
          </div>

          {/* Desktop: Logo inline */}
          <div className="mb-10 hidden w-full lg:block">
            <img
              src={BRAND_LOGO_SRC}
              alt="Unithery"
              className="h-10 w-auto"
            />
          </div>

          {/* Heading */}
          <div className="mb-4 w-full">
            <h2 className="font-display text-2xl font-bold tracking-tight text-charcoal">
              {isFamilyMode ? 'Portal Unithery' : 'Boas-vindas de volta'}
            </h2>
            <p className="mt-2 text-sm text-charcoal-muted">
              {isFamilyMode
                ? 'Entre com o e-mail e a senha que você cadastrou'
                : 'Acesse sua conta para continuar'}
            </p>
          </div>

          <AuthLoginModeToggle mode={loginMode} onChange={handleLoginModeChange} />

          {googleEnabled && (
            <div className="mb-5 w-full space-y-4">
              <GoogleContinueButton
                onClick={() => void handleGoogleLogin()}
                disabled={isSubmitting}
                loading={isGoogleSubmitting}
              />
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-charcoal-muted/60">ou</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          )}

          {emailJustConfirmed && !isFamilyMode && (
            <div
              role="status"
              className="mb-5 flex w-full items-start gap-3 rounded-xl border border-mint/20 bg-mint/10 px-4 py-3"
            >
              <p className="text-sm text-mint-dark">
                E-mail confirmado com sucesso! Agora é só entrar com sua senha.
              </p>
            </div>
          )}

          {/* Error */}
          {(error || retryAfterSeconds != null) && (
            <div
              role="alert"
              className="mb-6 flex w-full items-start gap-3 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-error" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-error">
                {retryAfterSeconds != null ? <RateLimitMessage seconds={retryAfterSeconds} /> : error}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-charcoal"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-charcoal"
                >
                  Senha
                </label>
                {!isFamilyMode && (
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-primary hover:text-primary-dark"
                  >
                    Esqueceu a senha?
                  </Link>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-charcoal-muted/60 transition-colors hover:text-charcoal"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button — com efeito de profundidade material */}
            <LoadingButton
              type="submit"
              variant={isFamilyMode ? 'primary' : 'dark'}
              fullWidth
              loading={isSubmitting}
              className="relative mt-2 h-12"
            >
              {isFamilyMode ? 'Entrar no portal' : 'Entrar'}
            </LoadingButton>
          </form>

          {isFamilyMode ? (
            <p className="mt-8 w-full text-center text-sm text-charcoal-muted">
              Recebeu convite do terapeuta?{' '}
              <Link
                to="/portal/register"
                className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
              >
                Crie o seu acesso
              </Link>
            </p>
          ) : (
            <>
              <p className="mt-8 w-full text-center text-sm text-charcoal-muted">
                Não tem conta ainda?{' '}
                <Link
                  to="/register"
                  className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
                >
                  Cadastre-se
                </Link>
              </p>
              <p className="mt-3 w-full text-center text-sm text-charcoal-muted">
                Recebeu convite do terapeuta?{' '}
                <Link
                  to="/portal/register"
                  className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
                >
                  Crie o seu acesso
                </Link>
              </p>
            </>
          )}
          <div className="pb-2 pt-8 text-center lg:hidden">
            <p className="text-xs text-charcoal-muted/40">
              © 2026 Unithery · Privacidade · Termos
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
