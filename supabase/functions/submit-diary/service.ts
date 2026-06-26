import { createUserClient, createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { resolveEntryDate, validateDiaryEntryDate } from '../_shared/diary-entry-date.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { SubmitDiaryPayload, SubmitDiaryResponse } from './types.ts';

export async function submitDiary(
  payload: SubmitDiaryPayload,
  caller: AuthenticatedUser,
  token: string,
): Promise<SubmitDiaryResponse> {
  const supabase = createUserClient(token);
  const serviceClient = createServiceClient();
  const clinicId = caller.clinic_id;

  if (!clinicId) {
    throw new AppError({ code: 'NO_CLINIC', message: 'User not associated with a clinic', statusCode: 400 });
  }

  // 1. Get family member record for current user
  const { data: familyMember } = await serviceClient
    .from('family_members')
    .select('id, patient_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!familyMember) {
    throw new ForbiddenError('User is not a registered family member');
  }

  // 2. Verify the patient_id matches what the family member is linked to
  if (familyMember.patient_id !== payload.patient_id) {
    throw new ForbiddenError('You are not authorized to submit entries for this patient');
  }

  // 3. Validate crisis_level is present if crisis occurred
  if (payload.crisis_occurred && !payload.crisis_level) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'crisis_level is required when crisis_occurred is true',
      statusCode: 400,
    });
  }

  // 4. Insert diary entry (RLS will also validate)
  const entryDate = resolveEntryDate(payload.entry_date);
  validateDiaryEntryDate(entryDate);

  const { data: entry, error } = await serviceClient
    .from('diary_entries')
    .insert({
      patient_id: payload.patient_id,
      clinic_id: clinicId,
      family_member_id: familyMember.id,
      entry_date: entryDate,
      mood_score: payload.mood_score,
      sleep_quality: payload.sleep_quality,
      crisis_occurred: payload.crisis_occurred,
      crisis_level: payload.crisis_occurred ? payload.crisis_level : null,
      categories: payload.categories,
      notes: payload.notes ?? payload.transcricao ?? null,
      audio_note_url: payload.audio_note_url ?? null,
      transcricao: payload.transcricao ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError({
        code: 'DIARY_CREATE_FAILED',
        message:
          'Não foi possível salvar o check-in. Se o erro persistir, peça ao suporte para aplicar a atualização de múltiplos registros por dia.',
        statusCode: 500,
      });
    }
    throw new AppError({ code: 'DIARY_CREATE_FAILED', message: error.message, statusCode: 500 });
  }

  // 5. Audit log
  await serviceClient.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'diary.submit',
    resource_type: 'diary_entry',
    resource_id: entry!.id,
    metadata: {
      patient_id: payload.patient_id,
      mood_score: payload.mood_score,
      crisis_occurred: payload.crisis_occurred,
    },
  });

  // 6. Notify professional via Realtime (crisis alert was auto-created by DB trigger)
  if (payload.crisis_occurred && payload.crisis_level && payload.crisis_level >= 3) {
    // The DB trigger already created the crisis_alert.
    // The professional's frontend subscribes to crisis_alerts table via Realtime.
    console.log(JSON.stringify({
      level: 'info',
      action: 'crisis_alert_generated',
      patient_id: payload.patient_id,
      crisis_level: payload.crisis_level,
      trace_id: crypto.randomUUID(),
    }));
  }

  return {
    diary_entry_id: entry!.id,
    message: 'Diário registrado com sucesso',
  };
}
