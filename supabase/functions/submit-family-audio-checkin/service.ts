import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import { extractFamilyDiaryCheckinFromTranscript } from '../_shared/family-diary-checkin-extract.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  SubmitFamilyAudioCheckinPayload,
  SubmitFamilyAudioCheckinResponse,
} from './types.ts';

function assertStoragePathForPatient(
  storagePath: string,
  clinicId: string,
  patientId: string,
): void {
  const parts = storagePath.split('/');
  if (
    parts.length !== 4 ||
    parts[0] !== clinicId ||
    parts[1] !== patientId ||
    parts[2] !== 'family'
  ) {
    throw new ForbiddenError('Caminho de áudio inválido para este paciente');
  }
}

export async function submitFamilyAudioCheckin(
  payload: SubmitFamilyAudioCheckinPayload,
  caller: AuthenticatedUser,
  token: string,
): Promise<SubmitFamilyAudioCheckinResponse> {
  const clinicId = caller.clinic_id;
  if (!clinicId) {
    throw new AppError({ code: 'NO_CLINIC', message: 'Usuário sem clínica associada', statusCode: 400 });
  }

  await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  assertStoragePathForPatient(payload.audio_note_url, clinicId, payload.patient_id);

  const transcricao = payload.transcricao.trim();
  const { extracted, tokens } = await extractFamilyDiaryCheckinFromTranscript(transcricao);

  const { submitDiary } = await import('../submit-diary/service.ts');
  const submitResult = await submitDiary(
    {
      patient_id: payload.patient_id,
      entry_date: payload.entry_date,
      mood_score: extracted.mood_score,
      sleep_quality: extracted.sleep_quality,
      crisis_occurred: extracted.crisis_occurred,
      crisis_level: extracted.crisis_occurred ? extracted.crisis_level ?? 3 : undefined,
      categories: extracted.categories,
      notes: extracted.notes || transcricao.slice(0, 1000),
      audio_note_url: payload.audio_note_url,
      transcricao,
    },
    caller,
    token,
  );

  const serviceClient = createServiceClient();
  await serviceClient.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'family_audio.checkin_submitted',
    resource_type: 'diary_entry',
    resource_id: submitResult.diary_entry_id,
    metadata: {
      patient_id: payload.patient_id,
      tokens_used: tokens,
      mood_score: extracted.mood_score,
      crisis_occurred: extracted.crisis_occurred,
      duration_seconds: payload.duration_seconds,
    },
  });

  return {
    diary_entry_id: submitResult.diary_entry_id,
    message: submitResult.message,
    extracted,
  };
}
