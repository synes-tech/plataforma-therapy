import { createServiceClient } from './supabase.ts';
import { AppError } from './errors.ts';
import { isClinicBillingExempt } from './billing-exempt.ts';

export interface PlanoRow {
  id: string;
  nome: string;
  tipo_perfil: 'autonomo' | 'clinica';
  preco_mensal_cents: number;
  limite_profissionais: number | null;
  limite_pacientes_por_prof: number | null;
}

export interface ClinicPlanLimits {
  plan_id: string;
  plan_name: string;
  max_professionals: number | null;
  max_patients_per_professional: number | null;
}

const UNLIMITED_FALLBACK = 9999;

export async function getClinicPlanLimits(clinicId: string): Promise<ClinicPlanLimits> {
  const supabase = createServiceClient();

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('subscription_plan')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .single();

  if (clinicError || !clinic) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada',
      statusCode: 404,
    });
  }

  const planId = clinic.subscription_plan as string;

  const { data: plano, error: planoError } = await supabase
    .from('planos')
    .select('id, nome, limite_profissionais, limite_pacientes_por_prof')
    .eq('id', planId)
    .eq('ativo', true)
    .single();

  if (planoError || !plano) {
    const { data: settings } = await supabase
      .from('clinic_settings')
      .select('max_professionals, max_patients_per_professional')
      .eq('clinic_id', clinicId)
      .single();

    return {
      plan_id: planId,
      plan_name: planId,
      max_professionals: settings?.max_professionals ?? 5,
      max_patients_per_professional: settings?.max_patients_per_professional ?? 30,
    };
  }

  return {
    plan_id: plano.id,
    plan_name: plano.nome,
    max_professionals: plano.limite_profissionais,
    max_patients_per_professional: plano.limite_pacientes_por_prof,
  };
}

export async function assertCanAddProfessional(clinicId: string): Promise<void> {
  const limits = await getClinicPlanLimits(clinicId);
  const max = limits.max_professionals;

  if (max === null) return;

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .is('deleted_at', null);

  if ((count ?? 0) >= max) {
    throw new AppError({
      code: 'QUOTA_EXCEEDED',
      message: `Limite de profissionais do plano ${limits.plan_name} atingido (${max}). Faça upgrade para continuar.`,
      statusCode: 403,
    });
  }
}

export async function assertCanAddPatient(
  clinicId: string,
  professionalId: string,
): Promise<void> {
  if (await isClinicBillingExempt(clinicId)) return;

  const limits = await getClinicPlanLimits(clinicId);

  const supabase = createServiceClient();

  const { data: profData } = await supabase
    .from('professionals')
    .select('max_patients_override, patient_quota_bonus')
    .eq('id', professionalId)
    .single();

  const planBase =
    profData?.max_patients_override ??
    limits.max_patients_per_professional ??
    UNLIMITED_FALLBACK;

  const bonus = Number(profData?.patient_quota_bonus ?? 0);
  const maxPatients = planBase + bonus;

  if (limits.max_patients_per_professional === null && profData?.max_patients_override == null && bonus === 0) {
    return;
  }

  const { count } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', professionalId)
    .eq('status', 'active')
    .eq('status_vinculo', 'ativo')
    .is('deleted_at', null);

  if ((count ?? 0) >= maxPatients) {
    throw new AppError({
      code: 'QUOTA_EXCEEDED',
      message: `Limite de pacientes do plano ${limits.plan_name} atingido (${maxPatients} ativos por profissional). Faça upgrade para continuar.`,
      statusCode: 403,
    });
  }
}

export async function applyPlanoToClinicSettings(
  clinicId: string,
  _planId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.rpc('sync_clinic_settings_from_plano', {
    p_clinic_id: clinicId,
  });

  if (error) {
    throw new AppError({
      code: 'CLINIC_SETTINGS_SYNC_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }
}
