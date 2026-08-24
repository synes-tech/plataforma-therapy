import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendSesEmail } from './aws-ses.ts';
import { createServiceClient } from './supabase.ts';
import {
  buildBillingPlanChangedEmail,
  buildBillingWelcomeEmail,
} from './billing-email-templates.ts';

async function loadBillingMailTarget(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<{ to: string; ownerName: string; clinicName: string } | null> {
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name, email')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();

  const to = typeof clinic?.email === 'string' ? clinic.email.trim().toLowerCase() : '';
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;

  const [{ data: admin }, { data: pro }] = await Promise.all([
    supabase
      .from('clinic_admins')
      .select('name')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('professionals')
      .select('name')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    to,
    ownerName: (admin?.name as string) || (pro?.name as string) || (clinic?.name as string) || 'profissional',
    clinicName: (clinic?.name as string) || 'seu consultório',
  };
}

export async function notifyBillingWelcome(params: {
  clinicId: string;
  planId: string;
  billingCycle?: 'monthly' | 'yearly' | null;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const target = await loadBillingMailTarget(supabase, params.clinicId);
  if (!target) {
    console.log('[billing-email] welcome skipped — sem e-mail da clínica', params.clinicId);
    return false;
  }

  const content = buildBillingWelcomeEmail({
    ownerName: target.ownerName,
    clinicName: target.clinicName,
    planId: params.planId,
    billingCycle: params.billingCycle,
  });

  await sendSesEmail({
    to: target.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  console.log(`[billing-email] welcome sent clinic=${params.clinicId} to=${target.to}`);
  return true;
}

export async function notifyBillingPlanChanged(params: {
  clinicId: string;
  previousPlanId: string | null;
  nextPlanId: string;
  billingCycle?: 'monthly' | 'yearly' | null;
}): Promise<boolean> {
  if (params.previousPlanId === params.nextPlanId) return false;
  if (params.nextPlanId === 'free') return false;

  const supabase = createServiceClient();
  const target = await loadBillingMailTarget(supabase, params.clinicId);
  if (!target) {
    console.log('[billing-email] plan_changed skipped — sem e-mail da clínica', params.clinicId);
    return false;
  }

  const content = buildBillingPlanChangedEmail({
    ownerName: target.ownerName,
    clinicName: target.clinicName,
    previousPlanId: params.previousPlanId,
    nextPlanId: params.nextPlanId,
    billingCycle: params.billingCycle,
  });

  await sendSesEmail({
    to: target.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  console.log(`[billing-email] plan_changed sent clinic=${params.clinicId} to=${target.to}`);
  return true;
}
