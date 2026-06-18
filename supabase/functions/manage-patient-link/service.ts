import { createServiceClient } from '../_shared/supabase.ts';
import { hardDeletePatientData } from '../_shared/hard-delete-patient.ts';
import { assertCanUnlinkToBackup } from '../_shared/paywall.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { ManagePatientLinkPayload, ManagePatientLinkResponse } from './types.ts';

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function managePatientLink(
  payload: ManagePatientLinkPayload,
  caller: AuthenticatedUser,
): Promise<ManagePatientLinkResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  const { data: patient, error: fetchError } = await supabase
    .from('patients')
    .select('id, name, status_vinculo, clinic_id, professional_id')
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    throw new AppError({
      code: 'PATIENT_FETCH_FAILED',
      message: fetchError.message,
      statusCode: 500,
    });
  }

  if (!patient || patient.professional_id !== ctx.caller_professional_id) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado na sua carteira',
      statusCode: 404,
    });
  }

  if (payload.acao === 'unlink') {
    if (patient.status_vinculo === 'desvinculado') {
      throw new AppError({
        code: 'ALREADY_UNLINKED',
        message: 'Este paciente já está desvinculado',
        statusCode: 409,
      });
    }

    await assertCanUnlinkToBackup(ctx.clinic_id, ctx.caller_professional_id);

    const { error: updateError } = await supabase
      .from('patients')
      .update({
        status_vinculo: 'desvinculado',
        data_desvinculacao: new Date().toISOString(),
      })
      .eq('id', payload.patient_id);

    if (updateError) {
      throw new AppError({
        code: 'UNLINK_FAILED',
        message: updateError.message,
        statusCode: 500,
      });
    }

    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      clinic_id: patient.clinic_id,
      action: 'patient.unlink',
      resource_type: 'patient',
      resource_id: patient.id,
      metadata: { name: patient.name },
    });

    return {
      patient_id: patient.id,
      acao: 'unlink',
      message: 'Paciente desvinculado. O histórico foi preservado no backup.',
    };
  }

  const confirm = payload.confirm_name?.trim() ?? '';
  if (!confirm || normalizeName(confirm) !== normalizeName(patient.name as string)) {
    throw new AppError({
      code: 'CONFIRM_NAME_MISMATCH',
      message: 'Digite o nome do paciente exatamente como exibido para confirmar a exclusão',
      statusCode: 400,
    });
  }

  try {
    await hardDeletePatientData(patient.id, patient.clinic_id as string);
  } catch (err) {
    throw new AppError({
      code: 'DELETE_FAILED',
      message: err instanceof Error ? err.message : 'Falha ao excluir paciente',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: patient.clinic_id,
    action: 'patient.hard_delete',
    resource_type: 'patient',
    resource_id: patient.id,
    metadata: { name: patient.name, permanent: true },
  });

  return {
    patient_id: patient.id,
    acao: 'delete',
    message: 'Paciente e todos os dados associados foram excluídos permanentemente',
  };
}
