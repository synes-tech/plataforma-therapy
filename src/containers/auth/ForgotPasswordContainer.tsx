import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { isFirebaseAuthConfigured, sendFirebasePasswordReset } from '@shared/lib/firebase';
import { callPublicFunction } from '@shared/lib/api';
import { getRetryAfterSeconds, isRateLimitedError } from '@shared/lib/rate-limit-message';
import { RateLimitMessage } from '@shared/ui/RateLimitMessage';

function resetPasswordRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

export default function ForgotPasswordContainer() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRetryAfterSeconds(null);
    setIsSubmitting(true);

    try {
      if (!isFirebaseAuthConfigured()) {
        throw new Error('Recuperação de senha indisponível neste ambiente.');
      }
      await callPublicFunction('guard-auth-rate', {
        action: 'password_reset',
        email: email.trim().toLowerCase(),
      });
      await sendFirebasePasswordReset(email.trim(), resetPasswordRedirectUrl());
      setSuccess(true);
    } catch (err) {
      if (isRateLimitedError(err)) {
        setRetryAfterSeconds(getRetryAfterSeconds(err));
      } else {
        setError(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail.');
      }
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
              Esqueceu a senha?
            </h1>
            <p className="mt-2 text-sm text-charcoal-muted">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          {success ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-5 py-5">
              <p className="text-sm font-medium text-charcoal">E-mail enviado</p>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
                Se existir uma conta com <strong className="text-charcoal">{email.trim()}</strong>,
                você receberá instruções para criar uma nova senha. Verifique também a caixa de spam.
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:text-primary-dark"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              {(error || retryAfterSeconds != null) && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
                >
                  {retryAfterSeconds != null ? <RateLimitMessage seconds={retryAfterSeconds} /> : error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-charcoal">
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

                <LoadingButton
                  type="submit"
                  variant="dark"
                  fullWidth
                  loading={isSubmitting}
                  className="h-12"
                >
                  Enviar link de recuperação
                </LoadingButton>
              </form>

              <p className="mt-8 text-center text-sm text-charcoal-muted lg:text-left">
                Lembrou a senha?{' '}
                <Link to="/login" className="font-medium text-primary hover:text-primary-dark">
                  Voltar ao login
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
