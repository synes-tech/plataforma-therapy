import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import type { AcknowledgeClinicalAlertPayload } from './schema.ts';
import type { AcknowledgeClinicalAlertResponse } from './types.ts';

export async function acknowledgeClinicalAlert(
  caller: AuthenticatedUser,
  payload: AcknowledgeClinicalAlertPayload,
): Promise<AcknowledgeClinicalAlertResponse> {
  const supabase = createServiceClient();

  const { data: existing, error: readError } = await supabase
    .from('clinical_alerts')
    .select('id, patient_id, clinic_id, professional_id, status')
    .eq('id', payload.alert_id)
    .maybeSingle();

  if (readError) {
    throw new AppError({ code: 'ALERT_READ_FAILED', message: readError.message, statusCode: 500 });
  }
  if (!existing) {
    throw new AppError({ code: 'NOT_FOUND', message: 'Alerta não encontrado', statusCode: 404 });
  }

  await verifyPatientAccess(existing.patient_id as string, caller);

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing.professional_id && professional && existing.professional_id !== professional.id) {
      throw new ForbiddenError('Este alerta não é da sua carteira');
    }
  }

  if (existing.status === 'ACKNOWLEDGED') {
    return {
      id: existing.id as string,
      status: 'ACKNOWLEDGED',
      acknowledged_at: new Date().toISOString(),
    };
  }

  const acknowledgedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('clinical_alerts')
    .update({
      status: 'ACKNOWLEDGED',
      acknowledged_at: acknowledgedAt,
      acknowledged_by: caller.id,
    })
    .eq('id', payload.alert_id)
    .select('id, status, acknowledged_at')
    .single();

  if (error || !updated) {
    throw new AppError({
      code: 'ALERT_ACK_FAILED',
      message: error?.message ?? 'Falha ao marcar o alerta',
      statusCode: 500,
    });
  }

  return {
    id: updated.id as string,
    status: 'ACKNOWLEDGED',
    acknowledged_at: (updated.acknowledged_at as string) ?? acknowledgedAt,
  };
}
