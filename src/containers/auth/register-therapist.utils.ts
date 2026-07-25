import { resolveTherapistSpecialty } from '@features/register/therapist-specialties';
import type { RegisterTherapistFormData } from '@containers/auth/RegisterTherapistView';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterTherapistPhase1(form: RegisterTherapistFormData): string | null {
  if (!form.name.trim()) return 'Informe seu nome completo.';
  if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) {
    return 'Informe um e-mail válido.';
  }
  if (form.email.trim().toLowerCase() !== form.confirm_email.trim().toLowerCase()) {
    return 'Os e-mails não coincidem.';
  }
  if (form.password.length < 6) return 'A senha deve ter no mínimo 6 caracteres.';
  if (form.password !== form.confirm_password) return 'As senhas não coincidem.';
  return null;
}

export function validateRegisterTherapistPhase2(form: RegisterTherapistFormData): string | null {
  if (!form.specialty_id) return 'Selecione sua especialidade.';
  if (form.specialty_id === 'outros' && !form.specialty_other.trim()) {
    return 'Informe sua especialidade em "Outros".';
  }
  return null;
}

export function validateRegisterTherapistForm(form: RegisterTherapistFormData): string | null {
  return validateRegisterTherapistPhase1(form) ?? validateRegisterTherapistPhase2(form);
}

export function buildSoloRegisterPayload(
  form: RegisterTherapistFormData,
  emailRedirectTo?: string,
) {
  const email = form.email.trim().toLowerCase();
  return {
    account_type: 'solo' as const,
    clinic_email: email,
    clinic_phone: form.phone.trim() || undefined,
    admin_name: form.name.trim(),
    admin_email: email,
    admin_password: form.password,
    specialty: resolveTherapistSpecialty(form.specialty_id, form.specialty_other),
    email_redirect_to: emailRedirectTo,
  };
}

export function buildSignupEmailRedirectUrl(): string {
  const origin = window.location.origin.replace(/\/$/, '');
  return `${origin}/login?confirmed=1`;
}
