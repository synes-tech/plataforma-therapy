import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { resolveClinicId } from '../_shared/clinic.ts';
import type { PlanControlStateResponse } from './types.ts';
import { isBillingExemptEmail } from '../_shared/billing-exempt.ts';

export const BACKUP_PACK_SIZE = 5;
export const BACKUP_PRICE_CENTS_PER_PACK = 1990;

const SOLO_PLANS = new Set([
  'free',
  'standard',
  'advanced',
  'premium',
  // legado
  'inicial',
  'intermediario',
  'consultorio',
]);

const ADDON_BY_PLAN: Record<string, string> = {
  standard: 'modulo_sa',
  advanced: 'modulo_sa',
  premium: 'modulo_p',
};

export async function getPlanControlState(
  caller: AuthenticatedUser,
): Promise<PlanControlStateResponse> {
  const supabase = createServiceClient();
  const clinicId = await resolveClinicId(supabase, caller);

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select(
      'id, subscription_plan, subscription_status, is_solo_professional, trial_ends_at, payment_method_on_file, quantidade_backup_pacientes, billing_cycle, trial_used, commitment_ends_at, stripe_subscription_id, billing_exempt, email',
    )
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
  const isSolo = clinic.is_solo_professional === true || SOLO_PLANS.has(planId);
  const billingExempt =
    clinic.billing_exempt === true || isBillingExemptEmail(clinic.email as string);

  const [
    { count: archivedCount, error: countError },
    { data: settings },
    { data: ownerProfessional },
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status_vinculo', 'desvinculado')
      .is('deleted_at', null),
    supabase
      .from('clinic_settings')
      .select('max_patients_per_professional')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    isSolo
      ? supabase
          .from('professionals')
          .select('id, patient_quota_bonus')
          .eq('clinic_id', clinicId)
          .eq('user_id', caller.id)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (countError) {
    throw new AppError({
      code: 'ARCHIVE_COUNT_FAILED',
      message: countError.message,
      statusCode: 500,
    });
  }

  let patientQuota: PlanControlStateResponse['patient_quota'] = null;

  // Módulo Adicional aplicável ao plano + módulos já contratados
  const addonId = ADDON_BY_PLAN[planId] ?? null;
  const [{ data: addonCatalogRow }, { data: activeAddonRows }] = await Promise.all([
    addonId
      ? supabase
          .from('plan_addons')
          .select('id, nome, pacientes_bonus, preco_mensal_cents, preco_anual_mensal_cents')
          .eq('id', addonId)
          .eq('ativo', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('clinic_addons')
      .select('addon_id, quantidade, billing_cycle, plan_addons(nome, pacientes_bonus, preco_mensal_cents, preco_anual_mensal_cents)')
      .eq('clinic_id', clinicId)
      .eq('status', 'active'),
  ]);

  if (isSolo && ownerProfessional?.id) {
    const planBase = Number(settings?.max_patients_per_professional ?? 0);
    const bonus = Number(ownerProfessional.patient_quota_bonus ?? 0);

    const { count: activeCount } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', ownerProfessional.id)
      .eq('status', 'active')
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null);

    patientQuota = {
      plan_base_limit: billingExempt ? 0 : planBase,
      quota_bonus: billingExempt ? 0 : bonus,
      total_limit: billingExempt ? 0 : planBase + bonus,
      active_count: activeCount ?? 0,
      addon: billingExempt ? null : addonCatalogRow
        ? {
            addon_id: addonCatalogRow.id as string,
            nome: addonCatalogRow.nome as string,
            pacientes_bonus: Number(addonCatalogRow.pacientes_bonus),
            preco_mensal_cents: Number(addonCatalogRow.preco_mensal_cents),
            preco_anual_mensal_cents: addonCatalogRow.preco_anual_mensal_cents
              ? Number(addonCatalogRow.preco_anual_mensal_cents)
              : null,
          }
        : null,
    };
  }

  // Consumo do mês: sessões e interações de IA
  const [{ data: sessionQuota }, { data: aiQuota }] = await Promise.all([
    supabase.rpc('check_session_quota', { p_clinic_id: clinicId }),
    supabase.rpc('check_ai_interaction_quota', { p_clinic_id: clinicId }),
  ]);

  const sessions = (sessionQuota ?? null) as Record<string, unknown> | null;
  const ai = (aiQuota ?? null) as Record<string, unknown> | null;

  return {
    clinic: {
      id: clinic.id as string,
      subscription_plan: clinic.subscription_plan as string,
      subscription_status: billingExempt ? 'active' : (clinic.subscription_status as string),
      is_solo_professional: Boolean(clinic.is_solo_professional),
      trial_ends_at: (clinic.trial_ends_at as string | null) ?? null,
      payment_method_on_file: Boolean(clinic.payment_method_on_file),
      billing_cycle: (clinic.billing_cycle as 'monthly' | 'yearly') ?? 'monthly',
      trial_used: Boolean(clinic.trial_used),
      commitment_ends_at: (clinic.commitment_ends_at as string | null) ?? null,
      has_stripe_subscription: billingExempt ? false : Boolean(clinic.stripe_subscription_id),
      billing_exempt: billingExempt,
    },
    backup: {
      quantidade_backup_pacientes: Number(clinic.quantidade_backup_pacientes ?? 0),
      archived_count: archivedCount ?? 0,
      pack_size: BACKUP_PACK_SIZE,
      price_cents_per_pack: BACKUP_PRICE_CENTS_PER_PACK,
    },
    patient_quota: patientQuota,
    usage: {
      sessions:
        sessions && !sessions.error
          ? {
              unlimited: Boolean(sessions.unlimited),
              total_used: (sessions.total_used as number | null) ?? null,
              total_limit: (sessions.total_limit as number | null) ?? null,
              patient_recommended: (sessions.patient_recommended as number | null) ?? null,
              blocked_total: Boolean(sessions.blocked_total),
            }
          : null,
      ai:
        ai && !ai.error
          ? {
              unlimited: Boolean(ai.unlimited),
              used: (ai.used as number | null) ?? null,
              limit: (ai.limit as number | null) ?? null,
              warn: Boolean(ai.warn),
              blocked: Boolean(ai.blocked),
            }
          : null,
    },
    active_addons: (activeAddonRows ?? []).map((row) => {
      const catalog = row.plan_addons as unknown as {
        nome: string;
        pacientes_bonus: number;
        preco_mensal_cents: number;
        preco_anual_mensal_cents: number | null;
      } | null;
      return {
        addon_id: row.addon_id as string,
        nome: catalog?.nome ?? (row.addon_id as string),
        quantidade: Number(row.quantidade),
        pacientes_bonus_per_module: Number(catalog?.pacientes_bonus ?? 5),
        billing_cycle: (row.billing_cycle as 'monthly' | 'yearly') ?? 'monthly',
        preco_mensal_cents: Number(catalog?.preco_mensal_cents ?? 0),
        preco_anual_mensal_cents: catalog?.preco_anual_mensal_cents
          ? Number(catalog.preco_anual_mensal_cents)
          : null,
      };
    }),
  };
}
