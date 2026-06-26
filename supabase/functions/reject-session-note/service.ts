import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { RejectSessionNotePayload, RejectSessionNoteResponse } from './types.ts';

export async function rejectSessionNote(
  payload: RejectSessionNotePayload,
  caller: AuthenticatedUser,
): Promise<RejectSessionNoteResponse> {
  const supabase = createServiceClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new ForbiddenError('Profissional não encontrado');
  }

  const { data: note, error: noteError } = await supabase
    .from('session_notes')
    .select('id, patient_id, professional_id, clinic_id, status, schedule_id')
    .eq('id', payload.session_note_id)
    .eq('patient_id', payload.patient_id)
    .eq('professional_id', professional.id)
    .is('deleted_at', null)
    .single();

  if (noteError || !note) {
    throw new AppError({
      code: 'NOTE_NOT_FOUND',
      message: 'Relatório não encontrado ou sem permissão',
      statusCode: 404,
    });
  }

  if (note.status !== 'draft') {
    throw new AppError({
      code: 'NOTE_NOT_DRAFT',
      message: 'Apenas relatórios pendentes de aprovação podem ser reprovados',
      statusCode: 422,
    });
  }

  const now = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from('session_notes')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', note.id);

  if (deleteError) {
    throw new AppError({
      code: 'REJECT_FAILED',
      message: deleteError.message,
      statusCode: 500,
    });
  }

  await supabase
    .from('patient_embeddings')
    .delete()
    .eq('patient_id', note.patient_id)
    .eq('document_type', 'session_note')
    .eq('source_id', note.id);

  if (note.schedule_id) {
    await supabase
      .from('therapist_schedule')
      .update({ session_note_id: null })
      .eq('id', note.schedule_id)
      .eq('session_note_id', note.id);
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: note.clinic_id,
    action: 'session_note.rejected_deleted',
    resource_type: 'session_note',
    resource_id: note.id,
    metadata: {
      patient_id: note.patient_id,
      schedule_id: note.schedule_id,
      previous_status: note.status,
    },
  });

  return {
    id: note.id,
    message: 'Relatório reprovado e removido com sucesso',
  };
}
