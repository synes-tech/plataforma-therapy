import { createServiceClient } from '../_shared/supabase.ts';
import { vertexAudioToStructured, CHAT_MODEL } from '../_shared/vertex.ts';
import type { ProcessClinicalReturnInput, CleanTranscription, ProcessClinicalReturnResult } from './types.ts';

const TRANSCRIPTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcription: { type: 'STRING' },
    cleaned_text: { type: 'STRING' },
  },
  required: ['transcription', 'cleaned_text'],
  propertyOrdering: ['transcription', 'cleaned_text'],
};

const CLEAN_TRANSCRIPTION_PROMPT = `Você é um assistente de transcrição clínica especializado em terapia infantil.
Você recebeu o ÁUDIO de um retorno clínico ditado por um terapeuta.

Tarefas:
1. Transcreva o áudio fielmente em português brasileiro (campo "transcription").
2. Produza uma versão LIMPA e profissional da transcrição (campo "cleaned_text"):
   - Remova TODOS os vícios de linguagem: "éééé", "hmmm", "ahn", "tipo assim", "né", "então", repetições involuntárias.
   - Corrija concordância verbal e nominal quando necessário.
   - Mantenha o texto em linguagem clínica profissional e fluida.
   - NÃO altere o conteúdo semântico — apenas limpe a forma.
   - NÃO adicione informações que não estejam no áudio.
   - Mantenha termos técnicos (TEA, TDAH, praxia, etc.) exatamente como falados.
   - Formate em parágrafos quando houver mudança de assunto.

REGRAS:
- Se o áudio estiver inaudível ou vazio, retorne strings vazias.
- Tom profissional e objetivo.
- Máximo de fidelidade ao conteúdo original.

Responda APENAS no JSON do schema fornecido.`;

export async function processClinicalReturn(input: ProcessClinicalReturnInput): Promise<ProcessClinicalReturnResult> {
  const supabase = createServiceClient();

  // Mark job as processing
  await supabase
    .from('ai_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), attempts: 1 })
    .eq('id', input.job_id);

  await supabase
    .from('audio_recordings')
    .update({ status: 'processing' })
    .eq('id', input.audio_recording_id);

  try {
    // Fetch recording details
    const { data: recording } = await supabase
      .from('audio_recordings')
      .select('storage_path, professional_id, clinic_id, mime_type')
      .eq('id', input.audio_recording_id)
      .single();

    if (!recording) throw new Error('Audio recording not found');

    // Download audio from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-recordings')
      .download(recording.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download audio: ${downloadError?.message}`);
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const startTime = Date.now();

    console.log(JSON.stringify({
      level: 'info',
      action: 'clinical_return_transcription_start',
      patient_id: input.patient_id,
      job_id: input.job_id,
    }));

    // Call Gemini for transcription + cleaning
    const { data: result, tokens } = await vertexAudioToStructured<CleanTranscription>(
      bytes,
      recording.mime_type ?? 'audio/wav',
      CLEAN_TRANSCRIPTION_PROMPT,
      TRANSCRIPTION_SCHEMA,
      { temperature: 0.1, maxOutputTokens: 8192 },
    );

    const latencyMs = Date.now() - startTime;

    // Save transcription record (stores the cleaned version as raw_text)
    const { data: transcriptionRecord } = await supabase
      .from('audio_transcriptions')
      .insert({
        audio_recording_id: input.audio_recording_id,
        patient_id: input.patient_id,
        clinic_id: recording.clinic_id,
        raw_text: result.cleaned_text || result.transcription,
        word_count: (result.cleaned_text || result.transcription).split(/\s+/).filter(Boolean).length,
        processing_duration_ms: latencyMs,
        model_version: CHAT_MODEL,
      })
      .select('id')
      .single();

    // Update recording status
    await supabase
      .from('audio_recordings')
      .update({ status: 'transcribed' })
      .eq('id', input.audio_recording_id);

    // Mark job complete
    await supabase
      .from('ai_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output_data: {
          transcription_id: transcriptionRecord!.id,
          cleaned_text: result.cleaned_text,
          raw_transcription: result.transcription,
          tokens_used: tokens,
          latency_ms: latencyMs,
        },
      })
      .eq('id', input.job_id);

    console.log(JSON.stringify({
      level: 'info',
      action: 'clinical_return_transcription_complete',
      patient_id: input.patient_id,
      job_id: input.job_id,
      tokens_used: tokens,
      latency_ms: latencyMs,
      word_count: (result.cleaned_text || '').split(/\s+/).filter(Boolean).length,
    }));

    return {
      transcription_id: transcriptionRecord!.id,
      cleaned_text: result.cleaned_text,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase
      .from('ai_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.job_id);

    await supabase
      .from('audio_recordings')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', input.audio_recording_id);

    console.error(JSON.stringify({
      level: 'error',
      action: 'clinical_return_transcription_failed',
      patient_id: input.patient_id,
      job_id: input.job_id,
      error: errorMessage,
    }));

    throw error;
  }
}
