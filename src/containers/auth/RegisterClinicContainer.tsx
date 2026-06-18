import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AccountType } from '@features/register/account-type';
import { useAuthStore } from '@shared/lib/auth-store';
import {
  RegisterOnboardingView,
  type RegisterOnboardingFormData,
} from './RegisterOnboardingView';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const INITIAL_FORM: RegisterOnboardingFormData = {
  clinic_name: '',
  clinic_email: '',
  clinic_phone: '',
  clinic_document: '',
  admin_name: '',
  admin_email: '',
  admin_password: '',
  specialty: '',
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
  const [accountType, setAccountType] = useState<AccountType>('solo');
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RegisterOnboardingFormData>(INITIAL_FORM);

  const isSolo = accountType === 'solo';

  function updateField(field: keyof RegisterOnboardingFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleMobileNext() {
    const stepError = validateStep1(form, isSolo);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const stepError = validateStep1(form, isSolo);
    if (stepError) {
      setMobileStep(1);
      setError(stepError);
      return;
    }

    if (!form.admin_name.trim()) {
      setError('Informe seu nome completo.');
      setMobileStep(2);
      return;
    }
    if (!form.admin_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) {
      setError('Informe um e-mail de login válido.');
      setMobileStep(2);
      return;
    }
    if (form.admin_password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      setMobileStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/register-clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: accountType,
          clinic_name: isSolo ? undefined : form.clinic_name.trim(),
          clinic_email: form.clinic_email.trim(),
          clinic_phone: form.clinic_phone.trim() || undefined,
          clinic_document: isSolo ? undefined : form.clinic_document.trim() || undefined,
          admin_name: form.admin_name.trim(),
          admin_email: form.admin_email.trim(),
          admin_password: form.admin_password,
          specialty: isSolo ? form.specialty.trim() || undefined : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message ?? 'Erro ao registrar. Tente novamente.');
        return;
      }

      await login(form.admin_email.trim(), form.admin_password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de conexão. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RegisterOnboardingView
      accountType={accountType}
      onAccountTypeChange={setAccountType}
      form={form}
      mobileStep={mobileStep}
      isSubmitting={isSubmitting}
      error={error}
      onFieldChange={updateField}
      onMobileNext={handleMobileNext}
      onMobileBack={handleMobileBack}
      onSubmit={handleSubmit}
    />
  );
}
