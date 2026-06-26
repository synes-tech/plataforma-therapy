import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  SaveSessionAnnotationsPayload,
  SaveSessionAnnotationsResponse,
} from './types.ts';

export async function saveSessionAnnotations(
  payload: SaveSessionAnnotationsPayload,
  caller: AuthenticatedUser,
): Promise<SaveSessionAnnotationsResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);
  const text = payload.anotacoes_texto?.trim() || null;
  const now = new Date().toISOString();

  if (!payload.audio_recording_id) {
    throw new AppError({
      code: 'RECORDING_REQUIRED',
      message: 'audio_recording_id é obrigatório para salvar anotações durante gravação',
      statusCode: 400,
    });
  }

  const { data: recording, error } = await supabase
    .from('audio_recordings')
    .select('id, patient_id, professional_id, schedule_id, status')
    .eq('id', payload.audio_recording_id)
    .eq('professional_id', ctx.caller_professional_id)
    .is('deleted_at', null)
    .single();

  if (error || !recording) {
    throw new ForbiddenError('Gravação não encontrada ou sem permissão.');
  }

  if (recording.patient_id !== ctx.patient_id) {
    throw new ForbiddenError('Gravação não pertence a este paciente.');
  }

  if (payload.schedule_id && recording.schedule_id && payload.schedule_id !== recording.schedule_id) {
    throw new AppError({
      code: 'SCHEDULE_MISMATCH',
      message: 'Agendamento não corresponde à gravação.',
      statusCode: 400,
    });
  }

  const { error: updateError } = await supabase
    .from('audio_recordings')
    .update({ anotacoes_texto: text })
    .eq('id', recording.id);

  if (updateError) {
    throw new AppError({
      code: 'SAVE_ANNOTATIONS_FAILED',
      message: updateError.message,
      statusCode: 500,
    });
  }

  return {
    audio_recording_id: recording.id,
    anotacoes_texto: text,
    saved_at: now,
  };
}
