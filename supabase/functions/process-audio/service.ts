import { createServiceClient } from '../_shared/supabase.ts';
import {
  vertexAudioToStructured,
  vertexEmbed,
  CHAT_MODEL,
  EMBED_MODEL,
} from '../_shared/vertex.ts';
import type { ProcessAudioInput, SOAPNote, ProcessAudioResult } from './types.ts';

interface StructuredSession extends SOAPNote {
  transcription: string;
}

const SOAP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcription: { type: 'STRING' },
    subjective: { type: 'STRING' },
    objective: { type: 'STRING' },
    assessment: { type: 'STRING' },
    plan: { type: 'STRING' },
  },
  required: ['transcription', 'subjective', 'objective', 'assessment', 'plan'],
  propertyOrdering: ['transcription', 'subjective', 'objective', 'assessment', 'plan'],
};

const SOAP_PROMPT = `Você é um assistente clínico especializado em terapia infantil (TEA e TDAH).
Você recebeu o ÁUDIO de uma sessão ditada pelo terapeuta.

Tarefas:
1. Transcreva o áudio fielmente em português brasileiro (campo "transcription").
2. Estruture o conteúdo no formato SOAP (Subjective, Objective, Assessment, Plan).

REGRAS:
- Extraia apenas informações presentes no áudio. NÃO invente dados.
- Se uma seção não tiver dados suficientes, escreva "Não relatado nesta sessão.".
- Não sugira medicações, dosagens ou diagnósticos novos.
- Tom profissional e objetivo; cada seção SOAP com 2 a 5 frases concisas.

Responda APENAS no JSON do schema fornecido.`;

// ============================================================
// STEP 1: Transcribe + structure via Vertex AI (audio inline base64)
// ============================================================
async function transcribeAndStructure(
  storagePath: string,
  mimeType: string,
): Promise<{ structured: StructuredSession; tokensUsed: number; latencyMs: number; model: string }> {
  const supabase = createServiceClient();
  const startTime = Date.now();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('audio-recordings')
    .download(storagePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download audio: ${downloadError?.message}`);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  const { data: structured, tokens } = await vertexAudioToStructured<StructuredSession>(
    bytes,
    mimeType,
    SOAP_PROMPT,
    SOAP_SCHEMA,
    { temperature: 0.1, maxOutputTokens: 4096 },
  );

  return { structured, tokensUsed: tokens, latencyMs: Date.now() - startTime, model: CHAT_MODEL };
}

// ============================================================
// MAIN: Orchestrate the full pipeline
// ============================================================
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
      .select('storage_path, professional_id, clinic_id, recording_type, mime_type')
      .eq('id', input.audio_recording_id)
      .single();

    if (!recording) throw new Error('Audio recording not found');

    // STEP 1: Transcribe + structure in one multimodal Gemini call
    console.log(JSON.stringify({ level: 'info', action: 'gemini_audio_start', patient_id: input.patient_id }));
    const { structured, tokensUsed, latencyMs, model } = await transcribeAndStructure(
      recording.storage_path,
      recording.mime_type ?? 'audio/wav',
    );

    const transcription = structured.transcription ?? '';
    const soap: SOAPNote = {
      subjective: structured.subjective,
      objective: structured.objective,
      assessment: structured.assessment,
      plan: structured.plan,
    };

    // Save transcription
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

    // STEP 2: Save session note as DRAFT (requires therapist approval)
    const { data: sessionNote } = await supabase
      .from('session_notes')
      .insert({
        patient_id: input.patient_id,
        professional_id: recording.professional_id,
        clinic_id: recording.clinic_id,
        audio_recording_id: input.audio_recording_id,
        transcription_id: transcriptionRecord!.id,
        status: 'draft',
        content: soap,
        ai_generated: true,
        llm_model: model,
        llm_tokens_used: tokensUsed,
        llm_latency_ms: latencyMs,
      })
      .select('id')
      .single();

    // STEP 3: Generate embeddings for RAG (Gemini, RETRIEVAL_DOCUMENT)
    console.log(JSON.stringify({ level: 'info', action: 'embeddings_start', patient_id: input.patient_id }));

    const chunks = [
      `Relato subjetivo: ${soap.subjective}`,
      `Observação objetiva: ${soap.objective}`,
      `Avaliação clínica: ${soap.assessment}`,
      `Plano terapêutico: ${soap.plan}`,
      `Transcrição completa: ${transcription.slice(0, 2000)}`,
    ].filter((chunk) => chunk.length > 30);

    const embeddings = await vertexEmbed(chunks, 'RETRIEVAL_DOCUMENT');

    const embeddingRecords = chunks.map((chunk, idx) => ({
      patient_id: input.patient_id,
      clinic_id: recording.clinic_id,
      document_type: 'session_note' as const,
      source_id: sessionNote!.id,
      content: chunk,
      embedding: JSON.stringify(embeddings[idx]),
      metadata: {
        session_note_id: sessionNote!.id,
        section: ['subjective', 'objective', 'assessment', 'plan', 'full_transcription'][idx],
        created_at: new Date().toISOString(),
        word_count: chunk.split(/\s+/).filter(Boolean).length,
        embed_model: EMBED_MODEL,
      },
    }));

    await supabase.from('patient_embeddings').insert(embeddingRecords);

    await supabase
      .from('ai_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output_data: {
          transcription_id: transcriptionRecord!.id,
          session_note_id: sessionNote!.id,
          embeddings_count: embeddingRecords.length,
        },
      })
      .eq('id', input.job_id);

    console.log(JSON.stringify({
      level: 'info',
      action: 'process_audio_complete',
      patient_id: input.patient_id,
      job_id: input.job_id,
      embeddings_count: embeddingRecords.length,
      total_tokens: tokensUsed,
      model,
    }));

    return {
      transcription_id: transcriptionRecord!.id,
      session_note_id: sessionNote!.id,
      embeddings_count: embeddingRecords.length,
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
