import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import {
  countActivePatientsForProfessional,
  FREEMIUM_PATIENT_LIMIT,
  requiresPaywall,
} from '../_shared/paywall.ts';

export interface PaywallPlanCard {
  id: string;
  nome: string;
  preco_mensal_cents: number;
  descricao_curta: string | null;
  destaque: string | null;
  features: string[];
  recomendado: boolean;
}

export interface PaywallStateResponse {
  requires_paywall: boolean;
  patient_count: number;
  freemium_patient_limit: number;
  account_type: 'solo' | 'corporate';
  subscription_status: string;
  trial_ends_at: string | null;
  plans: PaywallPlanCard[];
}

export async function getPaywallState(caller: AuthenticatedUser): Promise<PaywallStateResponse> {
  if (!caller.clinic_id) {
    throw new AppError({
      code: 'NO_CLINIC',
      message: 'Usuário sem clínica associada',
      statusCode: 403,
    });
  }

  const supabase = createServiceClient();

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('subscription_status, payment_method_on_file, account_type, is_solo_professional, trial_ends_at')
    .eq('id', caller.clinic_id)
    .is('deleted_at', null)
    .single();

  if (clinicError || !clinic) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada',
      statusCode: 404,
    });
  }

  const billing = {
    subscription_status: clinic.subscription_status as string,
    payment_method_on_file: Boolean(clinic.payment_method_on_file),
  };

  const isSolo =
    clinic.is_solo_professional === true || clinic.account_type === 'solo';
  const accountType: 'solo' | 'corporate' = isSolo ? 'solo' : 'corporate';
  const tipoPerfil = isSolo ? 'autonomo' : 'clinica';

  let patientCount = 0;

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (professional) {
      patientCount = await countActivePatientsForProfessional(professional.id);
    }
  } else if (caller.role === 'clinic_admin') {
    const { count } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', caller.clinic_id)
      .eq('status', 'active')
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null);
    patientCount = count ?? 0;
  }

  const { data: planRows } = await supabase
    .from('planos')
    .select('id, nome, preco_mensal_cents, descricao_curta, destaque, features, recomendado')
    .eq('tipo_perfil', tipoPerfil)
    .eq('ativo', true)
    .neq('id', 'enterprise')
    .order('sort_order', { ascending: true });

  const plans: PaywallPlanCard[] = (planRows ?? []).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    preco_mensal_cents: row.preco_mensal_cents as number,
    descricao_curta: (row.descricao_curta as string | null) ?? null,
    destaque: (row.destaque as string | null) ?? null,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    recomendado: Boolean(row.recomendado),
  }));

  return {
    requires_paywall: requiresPaywall(billing),
    patient_count: patientCount,
    freemium_patient_limit: FREEMIUM_PATIENT_LIMIT,
    account_type: accountType,
    subscription_status: billing.subscription_status,
    trial_ends_at: (clinic.trial_ends_at as string | null) ?? null,
    plans,
  };
}
