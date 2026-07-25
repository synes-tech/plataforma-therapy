import { createServiceClient } from './supabase.ts';
import type { AuthenticatedUser } from './auth.ts';

/** E-mails com acesso administrativo isento de billing/cotas (separados por vírgula). */
function billingExemptEmails(): Set<string> {
  const raw = Deno.env.get('PLATFORM_BILLING_EXEMPT_EMAILS') ?? 'joao@synes.tech';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isBillingExemptEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return billingExemptEmails().has(email.trim().toLowerCase());
}

export async function isClinicBillingExempt(clinicId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('clinics')
    .select('billing_exempt, email')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return false;
  if (data.billing_exempt === true) return true;
  return isBillingExemptEmail(data.email as string);
}

export async function isUserBillingExempt(user: AuthenticatedUser): Promise<boolean> {
  if (isBillingExemptEmail(user.email)) return true;
  if (user.clinic_id) return isClinicBillingExempt(user.clinic_id);
  return false;
}
