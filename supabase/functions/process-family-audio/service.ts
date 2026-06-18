import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import { vertexAudioToStructured } from '../_shared/vertex.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  InitiateFamilyAudioResponse,
  CompleteFamilyAudioResponse,
} from './types.ts';
import type { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { InitiateFamilyAudioSchema, CompleteFamilyAudioSchema } from './schema.ts';

const BUCKET = 'family-diary-audio';

const DIARY_TRANSCRIPTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcricao: { type: 'STRING' },
  },
  required: ['transcricao'],
  propertyOrdering: ['transcricao'],
};

const DIARY_TRANSCRIPTION_PROMPT = `Você recebeu o áudio de um pai ou mãe relatando o dia do filho em contexto de terapia infantil (TEA/TDAH).

Tarefas:
1. Transcreva fielmente em português brasileiro.
2. Entregue um texto limpo e coeso em prosa corrida (sem timestamps, sem marcadores).
3. Suavize hesitações longas, repetições e ruídos de fala, mantendo o sentido original.
4. Não invente informações que não estejam no áudio.

Responda APENAS no JSON do schema (campo "transcricao").`;

type InitiatePayload = z.infer<typeof InitiateFamilyAudioSchema>;
type CompletePayload = z.infer<typeof CompleteFamilyAudioSchema>;

function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return map[mime] ?? 'webm';
}

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
    throw new ForbiddenError('Caminho de armazenamento inválido para este paciente');
  }
}

export async function initiateFamilyAudio(
  payload: InitiatePayload,
  caller: AuthenticatedUser,
): Promise<InitiateFamilyAudioResponse> {
  const clinicId = caller.clinic_id;
  if (!clinicId) {
    throw new AppError({ code: 'NO_CLINIC', message: 'Usuário sem clínica associada', statusCode: 400 });
  }

  await assertFamilyOwnsPatient(caller.id, payload.patient_id);

  const timestamp = Date.now();
  const ext = extensionForMime(payload.mime_type);
  const storagePath = `${clinicId}/${payload.patient_id}/family/${timestamp}.${ext}`;

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
    clinic_id: clinicId,
    action: 'family_audio.upload_initiated',
    resource_type: 'diary_entry',
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
    mime_type: payload.mime_type,
  };
}

export async function completeFamilyAudio(
  payload: CompletePayload,
  caller: AuthenticatedUser,
): Promise<CompleteFamilyAudioResponse> {
  const clinicId = caller.clinic_id;
  if (!clinicId) {
    throw new AppError({ code: 'NO_CLINIC', message: 'Usuário sem clínica associada', statusCode: 400 });
  }

  await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  assertStoragePathForPatient(payload.storage_path, clinicId, payload.patient_id);

  const supabase = createServiceClient();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(payload.storage_path);

  if (downloadError || !fileData) {
    throw new AppError({
      code: 'AUDIO_NOT_FOUND',
      message: 'Áudio não encontrado. Envie novamente.',
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

  const { data: structured, tokens } = await vertexAudioToStructured<{ transcricao: string }>(
    bytes,
    payload.mime_type,
    DIARY_TRANSCRIPTION_PROMPT,
    DIARY_TRANSCRIPTION_SCHEMA,
    { temperature: 0.15, maxOutputTokens: 2048 },
  );

  const transcricao = (structured.transcricao ?? '').trim();
  if (!transcricao) {
    throw new AppError({
      code: 'TRANSCRIPTION_EMPTY',
      message: 'Não foi possível transcrever o áudio. Tente gravar novamente em ambiente silencioso.',
      statusCode: 422,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'family_audio.transcribed',
    resource_type: 'diary_entry',
    metadata: {
      patient_id: payload.patient_id,
      storage_path: payload.storage_path,
      tokens_used: tokens,
      duration_seconds: payload.duration_seconds,
    },
  });

  return {
    step: 'complete',
    transcricao,
    audio_url: payload.storage_path,
    duration_seconds: payload.duration_seconds,
  };
}
