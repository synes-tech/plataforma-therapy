import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingButton } from '@containers/loading';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { applyFirebaseEmailActionCode, isFirebaseAuthConfigured } from '@shared/lib/firebase';

type Phase = 'ready' | 'loading' | 'error' | 'success';

export default function AuthConfirmContainer() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<string | null>(null);
  const oobCodeRef = useRef<string | null>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oobCode = params.get('oobCode') ?? params.get('oob_code') ?? params.get('token_hash');
    const actionMode = params.get('mode') ?? params.get('type');

    if (!oobCode || !isFirebaseAuthConfigured()) {
      setPhase('error');
      setMessage('Este link é inválido ou está incompleto.');
      return;
    }

    oobCodeRef.current = oobCode;
    setMode(actionMode);
  }, []);

  async function handleConfirm() {
    if (verifyingRef.current || !oobCodeRef.current) return;
    verifyingRef.current = true;
    setPhase('loading');
    setMessage('Validando…');

    try {
      await applyFirebaseEmailActionCode(oobCodeRef.current);
      setPhase('success');
      setMessage('E-mail confirmado com sucesso. Você já pode entrar.');
      window.setTimeout(() => {
        window.location.replace('/login?confirmed=1');
      }, 1500);
    } catch (err) {
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Não foi possível confirmar.';
      setMessage(
        /expired|invalid|EXPIRED|INVALID/i.test(msg)
          ? 'Este link expirou ou já foi usado. Solicite um novo e-mail.'
          : msg,
      );
      verifyingRef.current = false;
    }
  }

  const isRecovery = mode === 'resetPassword' || mode === 'recovery';
  const title =
    phase === 'loading'
      ? 'Validando…'
      : phase === 'error'
        ? 'Não foi possível confirmar'
        : phase === 'success'
          ? 'Confirmado'
          : isRecovery
            ? 'Redefinir senha'
            : 'Confirme seu e-mail';

  const lead =
    phase === 'ready'
      ? isRecovery
        ? 'Clique no botão abaixo para validar o link de recuperação.'
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
              {isRecovery ? 'Continuar' : 'Confirmar e-mail'}
            </LoadingButton>
          )}

          {phase === 'loading' && (
            <p className="mt-6 text-sm text-charcoal-muted">Aguarde um instante…</p>
          )}

          {(phase === 'error' || phase === 'success') && (
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
