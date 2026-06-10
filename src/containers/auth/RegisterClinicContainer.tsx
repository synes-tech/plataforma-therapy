import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanSelector } from '@features/plans/PlanSelector';
import {
  type PlanId,
  isSoloPlan,
} from '@features/register/constants';
import {
  RegisterFormView,
  type RegisterFormData,
} from '@features/register/RegisterFormView';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const INITIAL_FORM: RegisterFormData = {
  clinic_name: '',
  clinic_email: '',
  clinic_phone: '',
  clinic_document: '',
  admin_name: '',
  admin_email: '',
  admin_password: '',
  specialty: '',
};

function validateStep1(form: RegisterFormData): string | null {
  if (!form.clinic_name.trim()) return 'Informe o nome do consultório ou clínica.';
  if (!form.clinic_email.trim()) return 'Informe o e-mail de contato.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clinic_email)) {
    return 'Informe um e-mail de contato válido.';
  }
  return null;
}

export default function RegisterClinicContainer() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<RegisterFormData>(INITIAL_FORM);

  const isSolo = selectedPlan ? isSoloPlan(selectedPlan) : false;

  function updateField(field: keyof RegisterFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleBackToPlans() {
    setSelectedPlan(null);
    setMobileStep(1);
    setError(null);
  }

  function handleMobileNext() {
    const stepError = validateStep1(form);
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

    const stepError = validateStep1(form);
    if (stepError) {
      setMobileStep(1);
      setError(stepError);
      return;
    }

    if (!selectedPlan) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/register-clinic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          plan: selectedPlan,
          specialty: isSolo ? form.specialty : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message ?? 'Erro ao registrar. Tente novamente.');
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!selectedPlan) {
    return <PlanSelector onSelect={(plan) => setSelectedPlan(plan)} />;
  }

  if (success) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="absolute inset-0">
          <div className="h-1/2 bg-white" />
          <div
            className="h-1/2"
            style={{
              background:
                'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
            }}
          />
        </div>
        <img
          src={BRAND_LOGO_SRC}
          alt="Therapy.AI"
          className="relative z-10 mb-8 h-10 w-auto"
        />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-50">
            <svg className="h-7 w-7 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-serif text-xl font-medium text-charcoal">
            {isSolo ? 'Consultório criado!' : 'Clínica registrada!'}
          </h2>
          <p className="mt-2 text-sm text-charcoal-muted">Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  return (
    <RegisterFormView
      plan={selectedPlan}
      form={form}
      mobileStep={mobileStep}
      isSubmitting={isSubmitting}
      error={error}
      onFieldChange={updateField}
      onBackToPlans={handleBackToPlans}
      onMobileNext={handleMobileNext}
      onMobileBack={handleMobileBack}
      onSubmit={handleSubmit}
    />
  );
}
