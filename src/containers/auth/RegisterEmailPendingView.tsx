import { Link } from 'react-router-dom';
import { useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { callFunction } from '@shared/lib/api';
import { buildSignupEmailRedirectUrl } from './register-therapist.utils';

interface RegisterEmailPendingViewProps {
  email: string;
}

export function RegisterEmailPendingView({ email }: RegisterEmailPendingViewProps) {
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendDone, setResendDone] = useState(false);

  async function handleResend() {
    setResendError(null);
    setResending(true);
    try {
      await callFunction('resend-signup-confirmation', {
        email: email.trim().toLowerCase(),
        email_redirect_to: buildSignupEmailRedirectUrl(),
      });
      setResendDone(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Não foi possível reenviar.');
    } finally {
      setResending(false);
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
        <div className="flex w-full max-w-sm flex-col text-center lg:text-left">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="mx-auto mb-10 h-16 w-auto lg:mx-0 lg:h-10" />

          <div
            role="status"
            className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-6"
          >
            <svg
              className="mx-auto mb-4 h-12 w-12 text-primary lg:mx-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 00-1.07-1.916l-7.5-4.615a2.25 2.25 0 00-2.36 0L3.32 8.91a2.25 2.25 0 00-1.07 1.916V6.75"
              />
            </svg>
            <h1 className="font-display text-xl font-bold text-charcoal">Confirme seu e-mail</h1>
            <p className="mt-3 text-sm leading-relaxed text-charcoal-muted">
              Enviamos um link de confirmação para{' '}
              <span className="font-medium text-charcoal">{email}</span>.
              Abra sua caixa de entrada e clique em <strong>Confirmar e-mail</strong> para
              ativar sua conta.
            </p>
          </div>

          <p className="text-sm text-charcoal-muted">
            Não encontrou? Verifique a pasta de spam ou lixo eletrônico.
          </p>

          {resendError && (
            <p role="alert" className="mt-4 text-sm text-error">
              {resendError}
            </p>
          )}
          {resendDone && (
            <p className="mt-4 text-sm text-primary">Novo e-mail enviado. Verifique sua caixa de entrada.</p>
          )}

          <LoadingButton
            type="button"
            variant="secondary"
            fullWidth
            className="mt-4 h-11"
            loading={resending}
            onClick={() => void handleResend()}
          >
            Reenviar e-mail de confirmação
          </LoadingButton>

          <Link
            to="/login"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98]"
          >
            Ir para o login
          </Link>
        </div>
      </main>
    </div>
  );
}
