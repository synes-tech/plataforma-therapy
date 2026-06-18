import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { PdfExportPayload, PdfExportData } from './types.ts';

async function verifyPatientAccess(
  supabase: ReturnType<typeof createServiceClient>,
  patientId: string,
  caller: AuthenticatedUser,
): Promise<void> {
  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id, clinic_id')
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .eq('id', patient.professional_id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new ForbiddenError('Você não tem acesso a este paciente');
    }
  } else if (caller.role === 'clinic_admin') {
    if (caller.clinic_id !== patient.clinic_id) {
      throw new ForbiddenError('Paciente não pertence à sua clínica');
    }
  }
}

export async function getPdfData(
  payload: PdfExportPayload,
  caller: AuthenticatedUser,
): Promise<PdfExportData> {
  const supabase = createServiceClient();

  await verifyPatientAccess(supabase, payload.patient_id, caller);

  const { data, error } = await supabase.rpc('get_patient_pdf_export_data', {
    p_patient_id: payload.patient_id,
  });

  if (error) {
    throw new AppError({ code: 'PDF_DATA_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  const row = data as PdfExportData;
  if (!row?.found) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  return row;
}
