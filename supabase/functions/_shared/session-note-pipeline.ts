import { createServiceClient } from './supabase.ts';
import { vertexEmbed, EMBED_MODEL } from './vertex.ts';
import type { SessionInputMode } from './session-report-prompts.ts';
import { buildSummaryMarkdown, type StructuredSessionReport } from './session-report-prompts.ts';

export interface PersistSessionDraftParams {
  patient_id: string;
  professional_id: string;
  clinic_id: string;
  schedule_id?: string | null;
  audio_recording_id?: string | null;
  transcription_id?: string | null;
  structured: StructuredSessionReport;
  anotacoes_texto?: string | null;
  input_mode: SessionInputMode;
  llm_model: string;
  llm_tokens_used: number;
  llm_latency_ms: number;
}

export interface PersistSessionDraftResult {
  session_note_id: string;
  embeddings_count: number;
}

export async function persistSessionDraft(
  params: PersistSessionDraftParams,
): Promise<PersistSessionDraftResult> {
  const supabase = createServiceClient();
  const transcription = params.structured.transcription ?? '';
  const summaryMarkdown =
    params.structured.summary_markdown?.trim() || buildSummaryMarkdown(params.structured);

  const content = {
    subjective: params.structured.subjective,
    objective: params.structured.objective,
    assessment: params.structured.assessment,
    plan: params.structured.plan,
    summary_markdown: summaryMarkdown,
    transcription,
    input_mode: params.input_mode,
    ...(params.anotacoes_texto?.trim()
      ? { therapist_annotations: params.anotacoes_texto.trim() }
      : {}),
  };

  const { data: sessionNote, error: noteError } = await supabase
    .from('session_notes')
    .insert({
      patient_id: params.patient_id,
      professional_id: params.professional_id,
      clinic_id: params.clinic_id,
      audio_recording_id: params.audio_recording_id ?? null,
      transcription_id: params.transcription_id ?? null,
      schedule_id: params.schedule_id ?? null,
      anotacoes_texto: params.anotacoes_texto?.trim() || null,
      input_mode: params.input_mode,
      status: 'draft',
      content,
      ai_generated: true,
      llm_model: params.llm_model,
      llm_tokens_used: params.llm_tokens_used,
      llm_latency_ms: params.llm_latency_ms,
    })
    .select('id')
    .single();

  if (noteError || !sessionNote) {
    throw new Error(noteError?.message ?? 'Failed to create session note');
  }

  const chunks = [
    `Relato subjetivo: ${params.structured.subjective}`,
    `Observação objetiva: ${params.structured.objective}`,
    `Avaliação clínica: ${params.structured.assessment}`,
    `Plano terapêutico: ${params.structured.plan}`,
    params.anotacoes_texto?.trim()
      ? `Anotações do terapeuta: ${params.anotacoes_texto.trim().slice(0, 2000)}`
      : null,
    transcription ? `Transcrição: ${transcription.slice(0, 2000)}` : null,
  ].filter((chunk): chunk is string => !!chunk && chunk.length > 30);

  let embeddingsCount = 0;

  if (chunks.length > 0) {
    const embeddings = await vertexEmbed(chunks, 'RETRIEVAL_DOCUMENT');
    const embeddingRecords = chunks.map((chunk, idx) => ({
      patient_id: params.patient_id,
      clinic_id: params.clinic_id,
      document_type: 'session_note' as const,
      source_id: sessionNote.id,
      content: chunk,
      embedding: JSON.stringify(embeddings[idx]),
      metadata: {
        session_note_id: sessionNote.id,
        section: ['subjective', 'objective', 'assessment', 'plan', 'annotations', 'transcription'][idx] ??
          'other',
        input_mode: params.input_mode,
        created_at: new Date().toISOString(),
        word_count: chunk.split(/\s+/).filter(Boolean).length,
        embed_model: EMBED_MODEL,
      },
    }));

    await supabase.from('patient_embeddings').insert(embeddingRecords);
    embeddingsCount = embeddingRecords.length;
  }

  return {
    session_note_id: sessionNote.id,
    embeddings_count: embeddingsCount,
  };
}
