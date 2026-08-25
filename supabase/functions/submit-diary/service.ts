import { createUserClient, createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError, ValidationError } from '../_shared/errors.ts';
import { resolveEntryDate, validateDiaryEntryDate } from '../_shared/diary-entry-date.ts';
import { getFamilyPatientLink } from '../_shared/family-access.ts';
import { normalizeCategories, normalizeDiaryPayload } from '../_shared/portal-diary.ts';
import { notifyProfessionalOfCrisis } from '../_shared/companion/crisis-email.ts';
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

  // 4. O modo do diário vem do vínculo, nunca do cliente. Deixar o PWA declarar que é um
  // auto-relato permitiria a um cuidador gravar entradas assinadas como se fossem do
  // paciente — e o prontuário perderia a distinção entre observação e primeira pessoa.
  const link = await getFamilyPatientLink(caller.id);
  if (link.patient_id !== payload.patient_id) {
    throw new ForbiddenError('You are not authorized to submit entries for this patient');
  }

  const { payload: dynamicPayload, errors: payloadErrors } = normalizeDiaryPayload(
    link.access_level,
    payload.payload,
  );
  if (Object.keys(payloadErrors).length > 0) {
    throw new ValidationError(payloadErrors);
  }

  // 5. Insert diary entry (RLS will also validate)
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
      categories: normalizeCategories(link.access_level, payload.categories),
      notes: payload.notes ?? payload.transcricao ?? null,
      audio_note_url: payload.audio_note_url ?? null,
      transcricao: payload.transcricao ?? null,
      payload: dynamicPayload,
      author_access_level: link.access_level,
      portal_link_id: link.link_id,
      author_user_id: caller.id,
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

  // 6. Audit log
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
      access_level: link.access_level,
    },
  });

  // 7. Crise no check-in: o trigger grava crisis_alerts e o e-mail avisa o psicólogo.
  if (payload.crisis_occurred) {
    const reported = (payload.notes ?? payload.transcricao ?? '').trim();
    await notifyProfessionalOfCrisis({
      patientId: payload.patient_id,
      clinicId,
      kind: 'checkin_crisis',
      reportedText: reported || `Crise marcada no check-in${payload.crisis_level ? ` (nível ${payload.crisis_level}/5)` : ''}.`,
      crisisLevel: payload.crisis_level ?? null,
      entryDate,
    });
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
