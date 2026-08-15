import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { confirmFirebasePasswordReset, isFirebaseAuthConfigured } from '@shared/lib/firebase';

function readOobCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('oobCode') ?? params.get('oob_code');
}

export default function ResetPasswordContainer() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const code = readOobCode();
    setOobCode(code);
    setCheckingSession(false);
  }, []);

  const ready = Boolean(oobCode) && isFirebaseAuthConfigured();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!oobCode) {
      setError('Link inválido ou expirado.');
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmFirebasePasswordReset(oobCode, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setIsSubmitting(false);
    }
  }

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

      <main className="relative z-10 flex w-full flex-col items-center justify-center px-6 lg:bg-white">
        <div className="flex w-full max-w-sm flex-col">
          <div className="mb-10 text-center lg:text-left">
            <img src={BRAND_LOGO_SRC} alt="Unithery" className="mx-auto h-16 w-auto lg:mx-0 lg:h-10" />
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal">
              Nova senha
            </h1>
            <p className="mt-2 text-sm text-charcoal-muted">
              Escolha uma nova senha para acessar sua conta.
            </p>
          </div>

          {checkingSession ? (
            <p className="text-sm text-charcoal-muted">Validando link de recuperação…</p>
          ) : !ready ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5">
              <p className="text-sm font-medium text-charcoal">Link inválido ou expirado</p>
              <p className="mt-2 text-sm text-charcoal-muted">
                Solicite um novo e-mail de recuperação para continuar.
              </p>
              <Link
                to="/forgot-password"
                className="mt-5 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:text-primary-dark"
              >
                Solicitar novo link
              </Link>
            </div>
          ) : success ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-5 py-5">
              <p className="text-sm font-medium text-charcoal">Senha atualizada</p>
              <p className="mt-2 text-sm text-charcoal-muted">
                Sua senha foi redefinida com sucesso. Redirecionando para o login…
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-charcoal">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
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

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-medium text-charcoal"
                  >
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  />
                </div>

                <LoadingButton
                  type="submit"
                  variant="dark"
                  fullWidth
                  loading={isSubmitting}
                  className="h-12"
                >
                  Salvar nova senha
                </LoadingButton>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
