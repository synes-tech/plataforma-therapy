import { createUserClient, createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { UploadAudioPayload, UploadAudioResponse } from './types.ts';

export async function initiateAudioUpload(
  payload: UploadAudioPayload,
  caller: AuthenticatedUser,
  token: string,
): Promise<UploadAudioResponse> {
  const supabase = createUserClient(token);
  const serviceClient = createServiceClient();
  const clinicId = caller.clinic_id;

  if (!clinicId) {
    throw new AppError({ code: 'NO_CLINIC', message: 'User not associated with a clinic', statusCode: 400 });
  }

  // 1. Get professional record
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new ForbiddenError('User is not a professional');
  }

  // 2. Verify patient belongs to this professional
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', payload.patient_id)
    .eq('professional_id', professional.id)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new ForbiddenError('Patient not found or not assigned to you');
  }

  let scheduleId: string | undefined;
  if (payload.schedule_id) {
    const { data: schedule } = await serviceClient
      .from('therapist_schedule')
      .select('id, patient_id, status, started_at')
      .eq('id', payload.schedule_id)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .single();

    if (!schedule || schedule.patient_id !== payload.patient_id) {
      throw new ForbiddenError('Agendamento inválido para este paciente.');
    }

    if (schedule.status === 'cancelled' || schedule.status === 'no_show') {
      throw new AppError({
        code: 'INVALID_SCHEDULE',
        message: 'Não é possível gravar áudio para um agendamento cancelado.',
        statusCode: 400,
      });
    }

    if (schedule.status === 'completed') {
      throw new AppError({
        code: 'SCHEDULE_COMPLETED',
        message: 'Este agendamento já foi concluído.',
        statusCode: 409,
      });
    }

    scheduleId = schedule.id;

    if (schedule.status === 'scheduled' || schedule.status === 'not_completed') {
      await serviceClient
        .from('therapist_schedule')
        .update({
          status: 'in_progress',
          ...(schedule.started_at ? {} : { started_at: new Date().toISOString() }),
        })
        .eq('id', schedule.id);
    }
  }

  // 3. Generate storage path (WAV — formato aceito pela Files API do Gemini)
  const timestamp = Date.now();
  const storagePath = `${clinicId}/${payload.patient_id}/${timestamp}.wav`;

  // 4. Create audio_recording record
  const { data: recording, error: recordingError } = await serviceClient
    .from('audio_recordings')
    .insert({
      patient_id: payload.patient_id,
      professional_id: professional.id,
      clinic_id: clinicId,
      storage_path: storagePath,
      duration_seconds: payload.duration_seconds,
      mime_type: 'audio/wav',
      recording_type: payload.recording_type,
      status: 'uploading',
      schedule_id: scheduleId ?? null,
    })
    .select('id')
    .single();

  if (recordingError || !recording) {
    throw new AppError({ code: 'RECORDING_CREATE_FAILED', message: recordingError?.message ?? 'Failed', statusCode: 500 });
  }

  // 5. Create signed upload URL (client uploads directly to Storage)
  const { data: signedUrl, error: signError } = await serviceClient.storage
    .from('audio-recordings')
    .createSignedUploadUrl(storagePath);

  if (signError || !signedUrl) {
    throw new AppError({ code: 'UPLOAD_URL_FAILED', message: signError?.message ?? 'Failed to create upload URL', statusCode: 500 });
  }

  // 6. Create the AI job (pending — will trigger after upload completes)
  const { data: job } = await serviceClient
    .from('ai_jobs')
    .insert({
      patient_id: payload.patient_id,
      clinic_id: clinicId,
      professional_id: professional.id,
      job_type: 'transcribe',
      status: 'pending',
      input_data: {
        audio_recording_id: recording.id,
        patient_id: payload.patient_id,
        storage_path: storagePath,
        recording_type: payload.recording_type,
        schedule_id: scheduleId ?? null,
      },
    })
    .select('id')
    .single();

  // 7. Audit log
  await serviceClient.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'audio.upload_initiated',
    resource_type: 'audio_recording',
    resource_id: recording.id,
    metadata: { recording_type: payload.recording_type, patient_id: payload.patient_id, schedule_id: scheduleId ?? null },
  });

  return {
    audio_recording_id: recording.id,
    upload_url: signedUrl.signedUrl,
    job_id: job!.id,
    message: 'Upload URL generated. Upload the file, then processing will begin automatically.',
  };
}
