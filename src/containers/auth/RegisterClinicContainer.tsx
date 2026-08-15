import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AccountType } from '@features/register/account-type';
import { PRODUCT_LAUNCH } from '@features/register/product-launch';
import { useAuthStore } from '@shared/lib/auth-store';
import {
  isFirebaseAuthConfigured,
  signInWithGooglePopup,
  signOutFirebase,
} from '@shared/lib/firebase';
import { mapFirebaseAuthError } from '@shared/lib/firebase-mfa';
import {
  RegisterOnboardingView,
  type RegisterOnboardingFormData,
} from './RegisterOnboardingView';
import {
  RegisterTherapistView,
  type RegisterTherapistFormData,
} from './RegisterTherapistView';
import {
  buildSoloRegisterPayload,
  buildSignupEmailRedirectUrl,
  validateRegisterTherapistForm,
  validateRegisterTherapistPhase1,
} from './register-therapist.utils';
import { RegisterEmailPendingView } from './RegisterEmailPendingView';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const INITIAL_LEGACY_FORM: RegisterOnboardingFormData = {
  clinic_name: '',
  clinic_email: '',
  clinic_phone: '',
  clinic_document: '',
  admin_name: '',
  admin_email: '',
  admin_password: '',
  specialty: '',
};

const INITIAL_THERAPIST_FORM: RegisterTherapistFormData = {
  name: '',
  phone: '',
  email: '',
  confirm_email: '',
  password: '',
  confirm_password: '',
  specialty_id: '',
  specialty_other: '',
};

function validateStep1(form: RegisterOnboardingFormData, isSolo: boolean): string | null {
  if (!isSolo && !form.clinic_name.trim()) return 'Informe o nome da clínica.';
  if (!form.clinic_email.trim()) return 'Informe o e-mail de contato.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clinic_email)) {
    return 'Informe um e-mail de contato válido.';
  }
  return null;
}

export default function RegisterClinicContainer() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const hydrateFromFirebase = useAuthStore((s) => s.hydrateFromFirebase);
  const useTherapistForm = PRODUCT_LAUNCH.soloProfessionalOnly;
  const googleEnabled = isFirebaseAuthConfigured();

  const [accountType, setAccountType] = useState<AccountType>('solo');
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [legacyForm, setLegacyForm] = useState<RegisterOnboardingFormData>(INITIAL_LEGACY_FORM);
  const [therapistForm, setTherapistForm] = useState<RegisterTherapistFormData>(INITIAL_THERAPIST_FORM);
  const [therapistStep, setTherapistStep] = useState<1 | 2>(1);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const isSolo = PRODUCT_LAUNCH.soloProfessionalOnly || accountType === 'solo';

  function handleAccountTypeChange(type: AccountType) {
    if (PRODUCT_LAUNCH.soloProfessionalOnly) return;
    setAccountType(type);
  }

  function updateLegacyField(field: keyof RegisterOnboardingFormData, value: string) {
    setLegacyForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateTherapistField(field: keyof RegisterTherapistFormData, value: string) {
    setTherapistForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleMobileNext() {
    const stepError = validateStep1(legacyForm, isSolo);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    setMobileStep(2);
  }

  function handleMobileBack() {
    setError(null);
    setMobileStep(1);
  }

  async function submitRegisterPayload(
    payload: Record<string, unknown>,
    loginEmail: string,
    loginPassword: string,
  ): Promise<boolean> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/register-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        email_redirect_to: buildSignupEmailRedirectUrl(),
      }),
    });

    const data = await response.json();

    if (!data.success) {
      setError(data.error?.message ?? 'Erro ao registrar. Tente novamente.');
      return false;
    }

    if (data.data?.requires_email_confirmation) {
      setPendingEmail(loginEmail.trim().toLowerCase());
      return true;
    }

    await login(loginEmail, loginPassword);
    navigate('/dashboard', { replace: true });
    return true;
  }

  function handleTherapistNext() {
    setError(null);
    const validationError = validateRegisterTherapistPhase1(therapistForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    setTherapistStep(2);
  }

  function handleTherapistBack() {
    setError(null);
    setTherapistStep(1);
  }

  async function handleGoogleRegister() {
    setError(null);
    if (!termsAccepted) {
      setError('Para criar sua conta com Google, você precisa ler e aceitar os Termos de Uso.');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      const firebaseUser = await signInWithGooglePopup();
      const tokenResult = await firebaseUser.getIdTokenResult(true);
      const hasRole = Boolean(
        tokenResult.claims.role
        ?? (tokenResult.claims.app_metadata as Record<string, unknown> | undefined)?.role,
      );

      if (hasRole) {
        await hydrateFromFirebase();
        navigate('/dashboard', { replace: true });
        return;
      }

      const idToken = await firebaseUser.getIdToken();
      const email = (firebaseUser.email ?? '').trim().toLowerCase();
      const name = (firebaseUser.displayName ?? therapistForm.name).trim() || 'Terapeuta';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/register-clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: 'solo',
          clinic_email: email,
          clinic_phone: therapistForm.phone.trim() || undefined,
          admin_name: name,
          admin_email: email,
          google_id_token: idToken,
        }),
      });

      const data = await response.json() as {
        success?: boolean;
        error?: { message?: string };
      };

      if (!data.success) {
        await signOutFirebase().catch(() => undefined);
        setError(data.error?.message ?? 'Não foi possível criar a conta com Google.');
        return;
      }

      await hydrateFromFirebase();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      await signOutFirebase().catch(() => undefined);
      setError(err instanceof Error ? mapFirebaseAuthError(err) : 'Erro ao cadastrar com Google.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  async function handleTherapistSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateRegisterTherapistForm(therapistForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!termsAccepted) {
      setError('Para criar sua conta, você precisa ler e aceitar os Termos de Uso.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildSoloRegisterPayload(therapistForm, buildSignupEmailRedirectUrl());
      await submitRegisterPayload(payload, payload.admin_email, payload.admin_password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de conexão. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLegacySubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const stepError = validateStep1(legacyForm, isSolo);
    if (stepError) {
      setMobileStep(1);
      setError(stepError);
      return;
    }

    if (!legacyForm.admin_name.trim()) {
      setError('Informe seu nome completo.');
      setMobileStep(2);
      return;
    }
    if (!legacyForm.admin_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legacyForm.admin_email)) {
      setError('Informe um e-mail de login válido.');
      setMobileStep(2);
      return;
    }
    if (legacyForm.admin_password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      setMobileStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      await submitRegisterPayload(
        {
          account_type: accountType,
          clinic_name: isSolo ? undefined : legacyForm.clinic_name.trim(),
          clinic_email: legacyForm.clinic_email.trim(),
          clinic_phone: legacyForm.clinic_phone.trim() || undefined,
          clinic_document: isSolo ? undefined : legacyForm.clinic_document.trim() || undefined,
          admin_name: legacyForm.admin_name.trim(),
          admin_email: legacyForm.admin_email.trim(),
          admin_password: legacyForm.admin_password,
          specialty: isSolo ? legacyForm.specialty.trim() || undefined : undefined,
        },
        legacyForm.admin_email.trim(),
        legacyForm.admin_password,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de conexão. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingEmail) {
    return <RegisterEmailPendingView email={pendingEmail} />;
  }

  if (useTherapistForm) {
    return (
      <RegisterTherapistView
        step={therapistStep}
        form={therapistForm}
        isSubmitting={isSubmitting}
        isGoogleSubmitting={isGoogleSubmitting}
        googleEnabled={googleEnabled}
        error={error}
        termsAccepted={termsAccepted}
        onTermsAcceptedChange={setTermsAccepted}
        onFieldChange={updateTherapistField}
        onNext={handleTherapistNext}
        onBack={handleTherapistBack}
        onSubmit={handleTherapistSubmit}
        onGoogleRegister={() => void handleGoogleRegister()}
      />
    );
  }

  return (
    <RegisterOnboardingView
      accountType={accountType}
      onAccountTypeChange={handleAccountTypeChange}
      form={legacyForm}
      mobileStep={mobileStep}
      isSubmitting={isSubmitting}
      error={error}
      onFieldChange={updateLegacyField}
      onMobileNext={handleMobileNext}
      onMobileBack={handleMobileBack}
      onSubmit={handleLegacySubmit}
    />
  );
}
