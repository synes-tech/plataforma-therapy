import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { supabase } from '@shared/lib/supabase';
import {
  isRecoveryConfirmType,
  mapAuthConfirmOtpType,
  resolveAuthConfirmRedirectPath,
} from './auth-confirm.utils';

type Phase = 'ready' | 'loading' | 'error';

export default function AuthConfirmContainer() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [message, setMessage] = useState('');
  const [rawType, setRawType] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState('/');

  const tokenHashRef = useRef<string | null>(null);
  const otpTypeRef = useRef(mapAuthConfirmOtpType('email'));
  const verifyingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    const redirectTo = params.get('redirect_to');

    if (!tokenHash || !type) {
      setPhase('error');
      setMessage('Este link é inválido ou está incompleto.');
      return;
    }

    tokenHashRef.current = tokenHash;
    otpTypeRef.current = mapAuthConfirmOtpType(type);
    setRawType(type);
    setRedirectPath(resolveAuthConfirmRedirectPath(redirectTo));
  }, []);

  async function handleConfirm() {
    if (verifyingRef.current || !tokenHashRef.current) return;
    verifyingRef.current = true;
    setPhase('loading');
    setMessage('Validando…');

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHashRef.current,
      type: otpTypeRef.current,
    });

    if (error) {
      setPhase('error');
      setMessage(
        error.message.includes('expired') || error.message.includes('invalid')
          ? 'Este link expirou ou já foi usado. Solicite um novo e-mail.'
          : error.message,
      );
      verifyingRef.current = false;
      return;
    }

    window.location.replace(redirectPath);
  }

  const isRecovery = isRecoveryConfirmType(rawType);
  const title =
    phase === 'loading'
      ? 'Validando…'
      : phase === 'error'
        ? 'Não foi possível confirmar'
        : isRecovery
          ? 'Redefinir senha'
          : 'Confirme seu e-mail';

  const lead =
    phase === 'ready'
      ? isRecovery
        ? 'Clique no botão abaixo para validar o link de recuperação e continuar para a nova senha.'
        : 'Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.'
      : message;

  return (
    <div className="relative flex min-h-dvh">
      <main className="relative z-10 flex w-full flex-col items-center justify-center px-6 bg-white">
        <div className="flex w-full max-w-sm flex-col text-center">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="mx-auto mb-10 h-16 w-auto lg:h-10" />

          <h1 className="font-display text-xl font-bold text-charcoal">{title}</h1>
          <p className="mt-2 text-sm text-charcoal-muted">{lead}</p>

          {phase === 'ready' && (
            <LoadingButton
              type="button"
              variant="dark"
              fullWidth
              className="mt-6 h-12"
              onClick={() => void handleConfirm()}
            >
              {isRecovery ? 'Continuar para nova senha' : 'Confirmar e-mail'}
            </LoadingButton>
          )}

          {phase === 'loading' && (
            <p className="mt-6 text-sm text-charcoal-muted">Aguarde um instante…</p>
          )}

          {phase === 'error' && (
            <div className="mt-6 flex flex-col gap-3">
              {isRecovery ? (
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                >
                  Solicitar novo link de recuperação
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                >
                  Criar nova conta
                </Link>
              )}
              <Link to="/login" className="text-sm text-charcoal-muted hover:text-charcoal">
                Voltar ao login
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
