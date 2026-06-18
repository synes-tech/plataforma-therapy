import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { resolveClinicId } from '../_shared/clinic.ts';
import type { PlanControlStateResponse } from './types.ts';

export const BACKUP_PACK_SIZE = 5;
export const BACKUP_PRICE_CENTS_PER_PACK = 1990;

export async function getPlanControlState(
  caller: AuthenticatedUser,
): Promise<PlanControlStateResponse> {
  const supabase = createServiceClient();
  const clinicId = await resolveClinicId(supabase, caller);

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select(
      'id, subscription_plan, subscription_status, is_solo_professional, trial_ends_at, payment_method_on_file, quantidade_backup_pacientes',
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

  const { count: archivedCount, error: countError } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status_vinculo', 'desvinculado')
    .is('deleted_at', null);

  if (countError) {
    throw new AppError({
      code: 'ARCHIVE_COUNT_FAILED',
      message: countError.message,
      statusCode: 500,
    });
  }

  return {
    clinic: {
      id: clinic.id as string,
      subscription_plan: clinic.subscription_plan as string,
      subscription_status: clinic.subscription_status as string,
      is_solo_professional: Boolean(clinic.is_solo_professional),
      trial_ends_at: (clinic.trial_ends_at as string | null) ?? null,
      payment_method_on_file: Boolean(clinic.payment_method_on_file),
    },
    backup: {
      quantidade_backup_pacientes: Number(clinic.quantidade_backup_pacientes ?? 0),
      archived_count: archivedCount ?? 0,
      pack_size: BACKUP_PACK_SIZE,
      price_cents_per_pack: BACKUP_PRICE_CENTS_PER_PACK,
    },
  };
}
