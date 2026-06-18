import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { AppError, NotFoundError } from '../_shared/errors.ts';
import type { UpdateReportInput } from './schema.ts';
import type { UpdateReportOutput } from './types.ts';

export async function updateReport(
  supabase: SupabaseClient,
  professionalId: string,
  userId: string,
  input: UpdateReportInput,
): Promise<UpdateReportOutput> {
  const { session_note_id, content, approve } = input;

  // Fetch existing note and validate ownership
  const { data: note, error: fetchError } = await supabase
    .from('session_notes')
    .select('id, professional_id, content, status')
    .eq('id', session_note_id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !note) {
    throw new NotFoundError('Relatório clínico');
  }

  // Ownership check (defense in depth)
  if (note.professional_id !== professionalId) {
    throw new AppError({
      code: 'ACCESS_DENIED',
      message: 'Você não tem permissão para editar este relatório.',
      statusCode: 403,
    });
  }

  // Cannot edit an archived report
  if (note.status === 'archived') {
    throw new AppError({
      code: 'REPORT_ARCHIVED',
      message: 'Relatórios arquivados não podem ser editados.',
      statusCode: 422,
    });
  }

  // Merge content: only update fields that were sent
  const existingContent = (note.content ?? {}) as Record<string, string>;
  const mergedContent = {
    subjective: content.subjective ?? existingContent.subjective ?? '',
    objective: content.objective ?? existingContent.objective ?? '',
    assessment: content.assessment ?? existingContent.assessment ?? '',
    plan: content.plan ?? existingContent.plan ?? '',
  };

  const now = new Date().toISOString();

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    content: mergedContent,
    updated_at: now,
  };

  if (approve) {
    updatePayload.status = 'approved';
    updatePayload.approved_at = now;
    updatePayload.approved_by = userId;
  } else if (note.status === 'approved') {
    // If editing an approved report, revert to draft
    updatePayload.status = 'draft';
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
  }

  const { error: updateError } = await supabase
    .from('session_notes')
    .update(updatePayload)
    .eq('id', session_note_id);

  if (updateError) {
    throw new AppError({
      code: 'UPDATE_FAILED',
      message: updateError.message,
      statusCode: 500,
    });
  }

  return {
    id: session_note_id,
    status: approve ? 'approved' : 'draft',
    updated_at: now,
    approved_at: approve ? now : null,
  };
}
