import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { getFamilyPatientLink } from '../_shared/family-access.ts';
import {
  deriveProfileType,
  normalizeModules,
  type ClinicalModule,
  type PatientProfileType,
} from '../_shared/patient-profile.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { GetPortalContextResponse, PortalSubscription } from './types.ts';

/** Status do Stripe que dão acesso ao produto. `past_due` mantém o acesso na régua de cobrança. */
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

interface PatientRow {
  id: string;
  name: string;
  birth_date: string | null;
  profile_type: PatientProfileType | null;
  active_modules: ClinicalModule[] | null;
}

interface SubscriptionRow {
  status: string;
  plan_code: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function isSubscriptionActive(status: string): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export async function getPortalContext(caller: AuthenticatedUser): Promise<GetPortalContextResponse> {
  const link = await getFamilyPatientLink(caller.id);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('patients')
    .select('id, name, birth_date, profile_type, active_modules')
    .eq('id', link.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError({ code: 'PORTAL_CONTEXT_FAILED', message: error.message, statusCode: 500 });
  }
  if (!data) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const patient = data as PatientRow;
  const profileType = patient.profile_type ?? deriveProfileType(patient.birth_date);

  // A assinatura é do paciente, não da conta: um cuidador que abre o portal precisa saber
  // que existe um plano ativo, mesmo sem poder usar o chat.
  const { data: subRow } = await supabase
    .from('patient_subscriptions')
    .select('status, plan_code, trial_end, current_period_end, cancel_at_period_end')
    .eq('patient_id', link.patient_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let subscription: PortalSubscription | null = null;
  if (subRow) {
    const row = subRow as SubscriptionRow;
    subscription = {
      status: row.status,
      plan_code: row.plan_code,
      active: isSubscriptionActive(row.status),
      trial_end: row.trial_end,
      current_period_end: row.current_period_end,
      cancel_at_period_end: row.cancel_at_period_end ?? false,
    };
  }

  // O chat do Acompanhante fala com quem vive o quadro, em primeira pessoa. Não faz sentido
  // — nem é seguro — entregá-lo a um cuidador falando *sobre* outra pessoa.
  const isSelfAdult = link.access_level === 'SELF' && profileType === 'ADULT';

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      first_name: firstName(patient.name),
      profile_type: profileType,
      active_modules: normalizeModules(patient.active_modules),
      birth_date: patient.birth_date,
    },
    access: {
      level: link.access_level,
      link_id: link.link_id,
      relationship: link.relationship,
      is_primary_contact: link.is_primary_contact,
    },
    subscription,
    capabilities: {
      companion_chat: isSelfAdult && Boolean(subscription?.active),
      can_subscribe: isSelfAdult && !subscription?.active,
    },
  };
}
