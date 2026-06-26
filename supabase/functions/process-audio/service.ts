import { createServiceClient } from '../_shared/supabase.ts';
import {
  vertexAudioToStructured,
  CHAT_MODEL,
} from '../_shared/vertex.ts';
import {
  buildAudioSoapPrompt,
  buildSummaryMarkdown,
  resolveSessionInputMode,
  SOAP_RESPONSE_SCHEMA,
  type StructuredSessionReport,
} from '../_shared/session-report-prompts.ts';
import { persistSessionDraft } from '../_shared/session-note-pipeline.ts';
import type { ProcessAudioInput, ProcessAudioResult } from './types.ts';

async function transcribeAndStructure(
  storagePath: string,
  mimeType: string,
  annotations?: string | null,
): Promise<{ structured: StructuredSessionReport; tokensUsed: number; latencyMs: number; model: string }> {
  const supabase = createServiceClient();
  const startTime = Date.now();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('audio-recordings')
    .download(storagePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download audio: ${downloadError?.message}`);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const prompt = buildAudioSoapPrompt(annotations);

  const { data: structured, tokens } = await vertexAudioToStructured<StructuredSessionReport>(
    bytes,
    mimeType,
    prompt,
    SOAP_RESPONSE_SCHEMA,
    { temperature: 0.1, maxOutputTokens: 4096 },
  );

  return { structured, tokensUsed: tokens, latencyMs: Date.now() - startTime, model: CHAT_MODEL };
}

export async function processAudio(input: ProcessAudioInput): Promise<ProcessAudioResult> {
  const supabase = createServiceClient();

  await supabase
    .from('ai_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), attempts: 1 })
    .eq('id', input.job_id);

  await supabase
    .from('audio_recordings')
    .update({ status: 'processing' })
    .eq('id', input.audio_recording_id);

  try {
    const { data: recording } = await supabase
      .from('audio_recordings')
      .select('storage_path, professional_id, clinic_id, recording_type, mime_type, schedule_id, anotacoes_texto')
      .eq('id', input.audio_recording_id)
      .single();

    if (!recording) throw new Error('Audio recording not found');

    const mergedAnnotations =
      input.anotacoes_texto?.trim() || recording.anotacoes_texto?.trim() || null;
    const inputMode = resolveSessionInputMode(true, !!mergedAnnotations);

    if (mergedAnnotations && mergedAnnotations !== recording.anotacoes_texto) {
      await supabase
        .from('audio_recordings')
        .update({ anotacoes_texto: mergedAnnotations })
        .eq('id', input.audio_recording_id);
    }

    console.log(JSON.stringify({
      level: 'info',
      action: 'gemini_audio_start',
      patient_id: input.patient_id,
      input_mode: inputMode,
    }));

    const { structured, tokensUsed, latencyMs, model } = await transcribeAndStructure(
      recording.storage_path,
      recording.mime_type ?? 'audio/wav',
      mergedAnnotations,
    );

    const transcription = structured.transcription ?? '';
    const summaryMarkdown = structured.summary_markdown?.trim() || buildSummaryMarkdown(structured);

    const { data: transcriptionRecord } = await supabase
      .from('audio_transcriptions')
      .insert({
        audio_recording_id: input.audio_recording_id,
        patient_id: input.patient_id,
        clinic_id: recording.clinic_id,
        raw_text: transcription,
        word_count: transcription.split(/\s+/).filter(Boolean).length,
        processing_duration_ms: latencyMs,
        model_version: model,
      })
      .select('id')
      .single();

    await supabase
      .from('audio_recordings')
      .update({ status: 'transcribed' })
      .eq('id', input.audio_recording_id);

    const { session_note_id, embeddings_count } = await persistSessionDraft({
      patient_id: input.patient_id,
      professional_id: recording.professional_id,
      clinic_id: recording.clinic_id,
      schedule_id: recording.schedule_id,
      audio_recording_id: input.audio_recording_id,
      transcription_id: transcriptionRecord!.id,
      structured: { ...structured, summary_markdown: summaryMarkdown },
      anotacoes_texto: mergedAnnotations,
      input_mode: inputMode,
      llm_model: model,
      llm_tokens_used: tokensUsed,
      llm_latency_ms: latencyMs,
    });

    await supabase
      .from('ai_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output_data: {
          transcription_id: transcriptionRecord!.id,
          session_note_id,
          embeddings_count,
          input_mode: inputMode,
        },
      })
      .eq('id', input.job_id);

    console.log(JSON.stringify({
      level: 'info',
      action: 'process_audio_complete',
      patient_id: input.patient_id,
      job_id: input.job_id,
      input_mode: inputMode,
      embeddings_count,
      total_tokens: tokensUsed,
      model,
    }));

    return {
      transcription_id: transcriptionRecord!.id,
      session_note_id,
      embeddings_count,
      input_mode: inputMode,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase
      .from('ai_jobs')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', input.job_id);

    await supabase
      .from('audio_recordings')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', input.audio_recording_id);

    throw error;
  }
}
