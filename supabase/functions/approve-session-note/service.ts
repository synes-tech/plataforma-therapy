import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { formatClinicalReportText } from '../_shared/session-note-format.ts';
import type { ApproveSessionNotePayload, ApproveSessionNoteResponse } from './types.ts';

export async function approveSessionNote(
  payload: ApproveSessionNotePayload,
  caller: AuthenticatedUser,
): Promise<ApproveSessionNoteResponse> {
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
    .select('id, patient_id, professional_id, clinic_id, status, content, schedule_id')
    .eq('id', payload.session_note_id)
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

  if (note.status === 'archived') {
    throw new AppError({
      code: 'NOTE_ARCHIVED',
      message: 'Relatórios arquivados não podem ser aprovados',
      statusCode: 422,
    });
  }

  const sharedWithFamily = payload.compartilhar_familia === true;
  const shareMode = sharedWithFamily ? payload.share_mode ?? null : null;
  const existingContent =
    note.content && typeof note.content === 'object' && !Array.isArray(note.content)
      ? (note.content as Record<string, unknown>)
      : {};

  const clinicalRawText = formatClinicalReportText(existingContent);
  if (clinicalRawText.length < 10) {
    throw new AppError({
      code: 'EMPTY_NOTE',
      message: 'Relatório sem conteúdo suficiente para salvar',
      statusCode: 422,
    });
  }

  const now = new Date().toISOString();

  let familyText: string | null = null;
  if (sharedWithFamily) {
    if (shareMode === 'refined') {
      familyText = payload.family_text!.trim();
    } else {
      familyText = clinicalRawText;
    }
  }

  const mergedContent: Record<string, unknown> = {
    ...existingContent,
    clinical_raw_text: clinicalRawText,
    clinical_raw_saved_at: now,
    family_text: familyText,
    family_share_mode: shareMode,
    family_shared_at: sharedWithFamily ? now : null,
  };

  const { error: updateError } = await supabase
    .from('session_notes')
    .update({
      content: mergedContent,
      status: 'approved',
      visivel_familia: sharedWithFamily,
      approved_at: now,
      approved_by: caller.id,
      updated_at: now,
    })
    .eq('id', note.id);

  if (updateError) {
    throw new AppError({
      code: 'APPROVE_FAILED',
      message: updateError.message,
      statusCode: 500,
    });
  }

  let scheduleCompleted = false;
  const scheduleId = payload.schedule_id ?? note.schedule_id ?? null;

  if (scheduleId) {
    const { data: schedule } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, status, professional_id')
      .eq('id', scheduleId)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (schedule && schedule.patient_id === note.patient_id) {
      if (note.schedule_id !== scheduleId) {
        await supabase
          .from('session_notes')
          .update({ schedule_id: scheduleId })
          .eq('id', note.id);
      }

      if (schedule.status !== 'completed') {
        const { error: scheduleError } = await supabase
          .from('therapist_schedule')
          .update({
            status: 'completed',
            completed_at: now,
            session_note_id: note.id,
          })
          .eq('id', scheduleId);

        if (!scheduleError) {
          scheduleCompleted = true;
        }
      } else {
        scheduleCompleted = true;
      }
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: note.clinic_id,
    action: sharedWithFamily
      ? shareMode === 'refined'
        ? 'session_note.approved_shared_refined'
        : 'session_note.approved_shared_as_is'
      : 'session_note.approved_private',
    resource_type: 'session_note',
    resource_id: note.id,
    metadata: {
      patient_id: note.patient_id,
      visivel_familia: sharedWithFamily,
      share_mode: shareMode,
      has_distinct_family_text:
        sharedWithFamily && shareMode === 'refined' && familyText !== clinicalRawText,
      clinical_raw_preserved: clinicalRawText.length >= 10,
      schedule_id: scheduleId,
      schedule_completed: scheduleCompleted,
    },
  });

  const message = sharedWithFamily
    ? shareMode === 'refined'
      ? 'Versão refinada enviada para a família; o relatório clínico bruto permanece privado'
      : 'Relatório enviado para a família como gerado'
    : 'Relatório salvo no prontuário (uso interno)';

  return {
    id: note.id,
    status: 'approved',
    visivel_familia: sharedWithFamily,
    share_mode: shareMode,
    clinical_raw_preserved: true,
    approved_at: now,
    schedule_completed: scheduleCompleted,
    message,
  };
}
