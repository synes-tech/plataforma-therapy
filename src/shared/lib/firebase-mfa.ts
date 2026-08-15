import {
  getMultiFactorResolver,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  type AuthError,
  type MultiFactorError,
  type MultiFactorInfo,
  type MultiFactorResolver,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseAuthConfigured } from './firebase';

export class MfaRequiredError extends Error {
  readonly resolver: MultiFactorResolver;

  constructor(resolver: MultiFactorResolver) {
    super('MFA_REQUIRED');
    this.name = 'MfaRequiredError';
    this.resolver = resolver;
  }
}

export interface EnrolledPhoneFactor {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
}

let recaptcha: RecaptchaVerifier | null = null;
let recaptchaContainerId: string | null = null;

function asAuthError(err: unknown): AuthError | null {
  if (err && typeof err === 'object' && 'code' in err) {
    return err as AuthError;
  }
  return null;
}

export function isMfaRequiredError(err: unknown): err is MfaRequiredError {
  return err instanceof MfaRequiredError;
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = asAuthError(err)?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um momento e tente novamente.';
    case 'auth/invalid-verification-code':
      return 'Código inválido. Confira o SMS e tente novamente.';
    case 'auth/code-expired':
      return 'Código expirado. Solicite um novo SMS.';
    case 'auth/invalid-phone-number':
      return 'Número de telefone inválido. Use o formato +55…';
    case 'auth/requires-recent-login':
      return 'Por segurança, saia e entre novamente antes de alterar o MFA.';
    case 'auth/unverified-email':
      return 'Confirme seu e-mail antes de ativar a autenticação em duas etapas.';
    case 'auth/second-factor-already-in-use':
      return 'Este telefone já está vinculado a outra conta.';
    case 'auth/maximum-second-factor-count-exceeded':
      return 'Limite de fatores MFA atingido nesta conta.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Login com Google cancelado.';
    default:
      if (err instanceof Error && err.message && err.message !== 'MFA_REQUIRED') {
        return err.message;
      }
      return 'Falha na autenticação. Tente novamente.';
  }
}

/** Normaliza telefone BR para E.164 (+55…). Aceita já com +. */
export function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return `+${digits}`;
  }
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

export function listEnrolledPhoneFactors(user: User): EnrolledPhoneFactor[] {
  return multiFactor(user).enrolledFactors
    .filter((f) => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID)
    .map((f) => ({
      uid: f.uid,
      displayName: f.displayName ?? null,
      phoneNumber: 'phoneNumber' in f
        ? String((f as { phoneNumber?: string }).phoneNumber ?? '') || null
        : null,
    }));
}

function clearRecaptcha(): void {
  if (recaptcha) {
    try {
      recaptcha.clear();
    } catch {
      /* ignore */
    }
  }
  recaptcha = null;
  recaptchaContainerId = null;
}

async function ensureRecaptcha(containerId: string): Promise<RecaptchaVerifier> {
  const auth = getFirebaseAuth();
  if (recaptcha && recaptchaContainerId === containerId) {
    return recaptcha;
  }
  clearRecaptcha();
  const el = document.getElementById(containerId);
  if (!el) {
    throw new Error('Container reCAPTCHA não encontrado.');
  }
  el.innerHTML = '';
  recaptcha = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  recaptchaContainerId = containerId;
  await recaptcha.render();
  return recaptcha;
}

export async function signInWithEmailFirebase(
  email: string,
  password: string,
): Promise<UserCredential> {
  if (!isFirebaseAuthConfigured()) {
    throw new Error('Firebase Auth não configurado.');
  }
  const auth = getFirebaseAuth();
  try {
    return await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  } catch (err) {
    if (asAuthError(err)?.code === 'auth/multi-factor-auth-required') {
      throw new MfaRequiredError(getMultiFactorResolver(auth, err as MultiFactorError));
    }
    throw err;
  }
}

export function captureMfaFromError(err: unknown): MfaRequiredError | null {
  if (!isFirebaseAuthConfigured()) return null;
  if (asAuthError(err)?.code !== 'auth/multi-factor-auth-required') return null;
  return new MfaRequiredError(
    getMultiFactorResolver(getFirebaseAuth(), err as MultiFactorError),
  );
}

export async function sendMfaSignInSms(
  resolver: MultiFactorResolver,
  containerId: string,
  hintIndex = 0,
): Promise<string> {
  const hint = resolver.hints[hintIndex];
  if (!hint || hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID) {
    throw new Error('Nenhum telefone MFA disponível nesta conta.');
  }
  const verifier = await ensureRecaptcha(containerId);
  const provider = new PhoneAuthProvider(getFirebaseAuth());
  return provider.verifyPhoneNumber(
    { multiFactorHint: hint, session: resolver.session },
    verifier,
  );
}

export async function completeMfaSignIn(
  resolver: MultiFactorResolver,
  verificationId: string,
  code: string,
): Promise<UserCredential> {
  const cred = PhoneAuthProvider.credential(verificationId, code.trim());
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  return resolver.resolveSignIn(assertion);
}

export function mfaHintLabel(hint: MultiFactorInfo): string {
  if ('phoneNumber' in hint && hint.phoneNumber) {
    return String(hint.phoneNumber);
  }
  return hint.displayName || 'Telefone cadastrado';
}

export async function startMfaPhoneEnrollment(
  user: User,
  phoneNumber: string,
  containerId: string,
): Promise<string> {
  if (!user.emailVerified) {
    const err = new Error('Confirme seu e-mail antes de ativar a autenticação em duas etapas.');
    (err as Error & { code?: string }).code = 'auth/unverified-email';
    throw err;
  }
  const session = await multiFactor(user).getSession();
  const verifier = await ensureRecaptcha(containerId);
  const provider = new PhoneAuthProvider(getFirebaseAuth());
  return provider.verifyPhoneNumber(
    { phoneNumber: normalizePhoneE164(phoneNumber), session },
    verifier,
  );
}

export async function finishMfaPhoneEnrollment(
  user: User,
  verificationId: string,
  code: string,
  displayName = 'Telefone',
): Promise<void> {
  const cred = PhoneAuthProvider.credential(verificationId, code.trim());
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  await multiFactor(user).enroll(assertion, displayName);
  clearRecaptcha();
}

export async function unenrollMfaFactor(user: User, factorUid: string): Promise<void> {
  const factor = multiFactor(user).enrolledFactors.find((f) => f.uid === factorUid);
  if (!factor) {
    throw new Error('Fator MFA não encontrado.');
  }
  await multiFactor(user).unenroll(factor);
}

export function disposeMfaRecaptcha(): void {
  clearRecaptcha();
}
