import { useEffect, useState } from 'react';
import type { MultiFactorResolver } from 'firebase/auth';
import { LoadingButton } from '@containers/loading';
import { StandardModal } from '@shared/ui/StandardModal';
import {
  disposeMfaRecaptcha,
  mapFirebaseAuthError,
  mfaHintLabel,
  sendMfaSignInSms,
} from '@shared/lib/firebase-mfa';

const RECAPTCHA_ID = 'mfa-login-recaptcha';

interface MfaSmsChallengeModalProps {
  isOpen: boolean;
  resolver: MultiFactorResolver | null;
  onClose: () => void;
  onVerify: (verificationId: string, code: string) => Promise<void>;
}

export function MfaSmsChallengeModal({
  isOpen,
  resolver,
  onClose,
  onVerify,
}: MfaSmsChallengeModalProps) {
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const hintLabel = resolver?.hints[0] ? mfaHintLabel(resolver.hints[0]) : 'seu telefone';

  useEffect(() => {
    if (!isOpen || !resolver) return;
    setCode('');
    setError(null);
    setVerificationId(null);
    let cancelled = false;

    void (async () => {
      setSending(true);
      try {
        const id = await sendMfaSignInSms(resolver, RECAPTCHA_ID);
        if (!cancelled) setVerificationId(id);
      } catch (err) {
        if (!cancelled) setError(mapFirebaseAuthError(err));
      } finally {
        if (!cancelled) setSending(false);
      }
    })();

    return () => {
      cancelled = true;
      disposeMfaRecaptcha();
    };
  }, [isOpen, resolver]);

  async function handleResend() {
    if (!resolver) return;
    setError(null);
    setSending(true);
    try {
      disposeMfaRecaptcha();
      const id = await sendMfaSignInSms(resolver, RECAPTCHA_ID);
      setVerificationId(id);
      setCode('');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (!verificationId || code.trim().length < 6) {
      setError('Informe o código de 6 dígitos do SMS.');
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await onVerify(verificationId, code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : mapFirebaseAuthError(err));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Verificação em duas etapas"
      size="md"
      closeOnBackdropClick={!verifying}
      closeOnEscape={!verifying}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={verifying}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-60 md:w-auto"
          >
            Cancelar
          </button>
          <LoadingButton
            type="button"
            variant="dark"
            loading={verifying}
            disabled={sending || !verificationId}
            onClick={() => void handleVerify()}
            className="h-11 w-full px-6 md:w-auto md:min-w-[9rem]"
          >
            Confirmar
          </LoadingButton>
        </>
      }
    >
      <div id={RECAPTCHA_ID} className="hidden" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-charcoal-muted">
        Enviamos um código SMS para <span className="font-medium text-charcoal">{hintLabel}</span>.
        Digite o código para concluir o acesso.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      )}

      <label htmlFor="mfa-sms-code" className="mb-1.5 mt-5 block text-sm font-medium text-charcoal">
        Código SMS
      </label>
      <input
        id="mfa-sms-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        value={code}
        disabled={sending || verifying || !verificationId}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
        placeholder={sending ? 'Enviando SMS…' : '000000'}
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-lg tracking-[0.3em] text-charcoal placeholder:tracking-normal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50"
      />

      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={sending || verifying}
        className="mt-4 text-sm font-medium text-primary hover:text-primary-dark disabled:opacity-50"
      >
        {sending ? 'Enviando…' : 'Reenviar código'}
      </button>
    </StandardModal>
  );
}
