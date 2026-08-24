import { useCallback, useEffect, useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { StandardModal } from '@shared/ui/StandardModal';
import { getFirebaseCurrentUser, isFirebaseAuthConfigured } from '@shared/lib/firebase';
import { useAuthStore } from '@shared/lib/auth-store';
import {
  disposeMfaRecaptcha,
  finishMfaPhoneEnrollment,
  listEnrolledPhoneFactors,
  mapFirebaseAuthError,
  normalizePhoneE164,
  startMfaPhoneEnrollment,
  unenrollMfaFactor,
  type EnrolledPhoneFactor,
} from '@shared/lib/firebase-mfa';

const RECAPTCHA_ID = 'mfa-enroll-recaptcha';

export function MfaSettingsSection() {
  const authProvider = useAuthStore((s) => s.authProvider);
  const firebaseReady = isFirebaseAuthConfigured() && authProvider === 'firebase';

  const [factors, setFactors] = useState<EnrolledPhoneFactor[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshFactors = useCallback(() => {
    const user = getFirebaseCurrentUser();
    setFactors(user ? listEnrolledPhoneFactors(user) : []);
  }, []);

  useEffect(() => {
    if (firebaseReady) refreshFactors();
  }, [firebaseReady, refreshFactors]);

  function closeModal() {
    setModalOpen(false);
    setPhone('');
    setCode('');
    setVerificationId(null);
    setError(null);
    disposeMfaRecaptcha();
  }

  async function handleSendCode() {
    const user = getFirebaseCurrentUser();
    if (!user) {
      setError('Sessão Firebase indisponível. Entre novamente com Google ou e-mail.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const e164 = normalizePhoneE164(phone);
      if (!e164.startsWith('+') || e164.length < 12) {
        throw new Error('Informe um celular válido com DDD (ex.: 11 99999-9999).');
      }
      disposeMfaRecaptcha();
      const id = await startMfaPhoneEnrollment(user, e164, RECAPTCHA_ID);
      setVerificationId(id);
      setInfo(null);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmEnroll() {
    const user = getFirebaseCurrentUser();
    if (!user || !verificationId) return;
    setError(null);
    setBusy(true);
    try {
      await finishMfaPhoneEnrollment(user, verificationId, code, 'Telefone');
      refreshFactors();
      setInfo('Autenticação em duas etapas ativada.');
      closeModal();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnenroll(factorUid: string) {
    const user = getFirebaseCurrentUser();
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      await unenrollMfaFactor(user, factorUid);
      refreshFactors();
      setInfo('Autenticação em duas etapas desativada neste telefone.');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseAuthConfigured()) {
    return null;
  }

  if (!firebaseReady) {
    return (
      <div className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
        <p className="text-sm font-medium text-charcoal">Autenticação em duas etapas</p>
        <p className="text-xs leading-relaxed text-charcoal-muted">
          Disponível após entrar com Google ou com a sessão Identity Platform.
        </p>
      </div>
    );
  }

  const enrolled = factors.length > 0;
  const phoneLabel = factors[0]?.phoneNumber || factors[0]?.displayName;

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal">Autenticação em duas etapas</p>
          <p className="mt-0.5 text-xs leading-relaxed text-charcoal-muted">
            {enrolled
              ? `SMS no próximo login${phoneLabel ? ` · ${phoneLabel}` : ''}.`
              : 'Peça um código por SMS além da senha ou do Google.'}
          </p>
          {info && <p className="mt-2 text-xs font-medium text-mint-dark">{info}</p>}
          {error && !modalOpen && <p className="mt-2 text-xs text-error">{error}</p>}
        </div>
        <div className="shrink-0">
          {!enrolled ? (
            <button
              type="button"
              onClick={() => {
                setInfo(null);
                setError(null);
                setModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50"
            >
              Ativar
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const first = factors[0];
                if (first) void handleUnenroll(first.uid);
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-error/20 bg-white px-4 text-sm font-medium text-error transition-colors hover:bg-error-light/40 disabled:opacity-60"
            >
              Desativar
            </button>
          )}
        </div>
      </div>

      <StandardModal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Ativar MFA por SMS"
        size="md"
        closeOnBackdropClick={!busy}
        closeOnEscape={!busy}
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={busy}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-60 md:w-auto"
            >
              Cancelar
            </button>
            {!verificationId ? (
              <LoadingButton
                type="button"
                variant="dark"
                loading={busy}
                onClick={() => void handleSendCode()}
                className="h-11 w-full px-6 md:w-auto md:min-w-[10rem]"
              >
                Enviar código
              </LoadingButton>
            ) : (
              <LoadingButton
                type="button"
                variant="dark"
                loading={busy}
                onClick={() => void handleConfirmEnroll()}
                className="h-11 w-full px-6 md:w-auto md:min-w-[10rem]"
              >
                Confirmar e ativar
              </LoadingButton>
            )}
          </>
        }
      >
        <div id={RECAPTCHA_ID} className="hidden" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-charcoal-muted">
          Use um celular com DDD brasileiro. Podem valer tarifas de SMS da operadora.
          O e-mail da conta precisa estar verificado.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
          >
            {error}
          </div>
        )}

        <label htmlFor="mfa-phone" className="mb-1.5 mt-5 block text-sm font-medium text-charcoal">
          Celular
        </label>
        <input
          id="mfa-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          disabled={Boolean(verificationId) || busy}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="11 99999-9999"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50"
        />

        {verificationId && (
          <>
            <label htmlFor="mfa-enroll-code" className="mb-1.5 mt-4 block text-sm font-medium text-charcoal">
              Código SMS
            </label>
            <input
              id="mfa-enroll-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="000000"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-lg tracking-[0.3em] text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </>
        )}
      </StandardModal>
    </div>
  );
}
