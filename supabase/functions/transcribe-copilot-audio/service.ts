import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { assertCanUseAiPaywall } from '../_shared/paywall.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import { vertexAudioToStructured } from '../_shared/vertex.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { InitiateCopilotAudioResponse, CompleteCopilotAudioResponse } from './types.ts';
import type { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { InitiateCopilotAudioSchema, CompleteCopilotAudioSchema } from './schema.ts';

const BUCKET = 'audio-recordings';

const COPILOT_TRANSCRIPTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcription: { type: 'STRING' },
  },
  required: ['transcription'],
  propertyOrdering: ['transcription'],
};

const COPILOT_TRANSCRIPTION_PROMPT = `Você recebeu o áudio de um psicólogo/terapeuta falando uma pergunta ou instrução para o copiloto clínico sobre um paciente em terapia infantil (TEA/TDAH).

Tarefas:
1. Transcreva fielmente em português brasileiro.
2. Entregue um texto limpo em prosa corrida (sem timestamps, sem marcadores).
3. Suavize hesitações longas e repetições, mantendo o sentido original.
4. Não invente informações que não estejam no áudio.

Responda APENAS no JSON do schema (campo "transcription").`;

type InitiatePayload = z.infer<typeof InitiateCopilotAudioSchema>;
type CompletePayload = z.infer<typeof CompleteCopilotAudioSchema>;

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
    parts[2] !== 'copilot'
  ) {
    throw new ForbiddenError('Caminho de armazenamento inválido para este paciente');
  }
}

export async function initiateCopilotAudio(
  payload: InitiatePayload,
  caller: AuthenticatedUser,
): Promise<InitiateCopilotAudioResponse> {
  const access = await verifyProfessionalPatientWrite(payload.patient_id, caller);
  await assertCanUseAiPaywall(access.clinic_id);

  const timestamp = Date.now();
  const storagePath = `${access.clinic_id}/${payload.patient_id}/copilot/${timestamp}.wav`;

  const supabase = createServiceClient();
  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !signed) {
    throw new AppError({
      code: 'UPLOAD_URL_FAILED',
      message: error?.message ?? 'Falha ao gerar URL de upload',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: access.clinic_id,
    action: 'copilot_audio.upload_initiated',
    resource_type: 'ai_interaction',
    resource_id: payload.patient_id,
    metadata: {
      patient_id: payload.patient_id,
      storage_path: storagePath,
      duration_seconds: payload.duration_seconds,
    },
  });

  return {
    step: 'initiate',
    upload_url: signed.signedUrl,
    storage_path: storagePath,
    mime_type: 'audio/wav',
  };
}

export async function completeCopilotAudio(
  payload: CompletePayload,
  caller: AuthenticatedUser,
): Promise<CompleteCopilotAudioResponse> {
  const access = await verifyProfessionalPatientWrite(payload.patient_id, caller);
  await assertCanUseAiPaywall(access.clinic_id);
  assertStoragePathForPatient(payload.storage_path, access.clinic_id, payload.patient_id);

  const supabase = createServiceClient();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(payload.storage_path);

  if (downloadError || !fileData) {
    throw new AppError({
      code: 'AUDIO_NOT_FOUND',
      message: 'Áudio não encontrado. Grave novamente.',
      statusCode: 404,
    });
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new AppError({
      code: 'AUDIO_EMPTY',
      message: 'O arquivo de áudio está vazio.',
      statusCode: 400,
    });
  }

  const { data: structured, tokens } = await vertexAudioToStructured<{ transcription: string }>(
    bytes,
    payload.mime_type,
    COPILOT_TRANSCRIPTION_PROMPT,
    COPILOT_TRANSCRIPTION_SCHEMA,
    { temperature: 0.1, maxOutputTokens: 2048 },
  );

  const transcription = (structured.transcription ?? '').trim();
  if (!transcription) {
    throw new AppError({
      code: 'TRANSCRIPTION_EMPTY',
      message: 'Não foi possível transcrever o áudio. Tente gravar novamente em ambiente silencioso.',
      statusCode: 422,
    });
  }

  await supabase.storage.from(BUCKET).remove([payload.storage_path]);

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: access.clinic_id,
    action: 'copilot_audio.transcribed',
    resource_type: 'ai_interaction',
    resource_id: payload.patient_id,
    metadata: {
      patient_id: payload.patient_id,
      tokens_used: tokens,
      duration_seconds: payload.duration_seconds,
      transcription_length: transcription.length,
    },
  });

  return {
    step: 'complete',
    transcription,
    duration_seconds: payload.duration_seconds,
  };
}
