import { createServiceClient } from './supabase.ts';
import { extractDocumentText } from './document-extract.ts';
import { chunkTextForRag } from './text-chunking.ts';
import { EMBED_MODEL, vertexEmbed } from './vertex.ts';

const BUCKET = 'pacientes-anexos';

export interface ProcessPatientAttachmentParams {
  attachment_id: string;
  patient_id: string;
  clinic_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
}

import { summarizePatientAttachmentText } from './patient-attachment-summary.ts';

export interface ProcessPatientAttachmentResult {
  extracted_char_count: number;
  embeddings_count: number;
  ai_summary: string;
}

async function storeEmbeddings(
  supabase: ReturnType<typeof createServiceClient>,
  params: ProcessPatientAttachmentParams,
  chunks: string[],
): Promise<number> {
  if (chunks.length === 0) return 0;

  const embeddings = await vertexEmbed(chunks, 'RETRIEVAL_DOCUMENT');
  const records = chunks.map((chunk, index) => ({
    patient_id: params.patient_id,
    clinic_id: params.clinic_id,
    document_type: 'patient_attachment' as const,
    source_id: params.attachment_id,
    content: chunk,
    embedding: JSON.stringify(embeddings[index]),
    metadata: {
      attachment_id: params.attachment_id,
      file_name: params.file_name,
      mime_type: params.mime_type,
      chunk_index: index,
      word_count: chunk.split(/\s+/).filter(Boolean).length,
      embed_model: EMBED_MODEL,
      created_at: new Date().toISOString(),
    },
  }));

  const { error: insertError } = await supabase.from('patient_embeddings').insert(records);
  if (insertError) throw new Error(insertError.message);
  return records.length;
}

export async function processPatientAttachment(
  params: ProcessPatientAttachmentParams,
): Promise<ProcessPatientAttachmentResult> {
  const supabase = createServiceClient();

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(params.storage_path);

  if (downloadError || !fileBlob) {
    throw new Error(downloadError?.message ?? 'Falha ao baixar anexo do storage');
  }

  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const extractedText = await extractDocumentText(bytes, params.mime_type, params.file_name);
  const chunks = chunkTextForRag(extractedText);

  await supabase
    .from('patient_embeddings')
    .delete()
    .eq('patient_id', params.patient_id)
    .eq('document_type', 'patient_attachment')
    .eq('source_id', params.attachment_id);

  const [embeddingsCount, ai_summary] = await Promise.all([
    storeEmbeddings(supabase, params, chunks),
    summarizePatientAttachmentText(extractedText, params.file_name),
  ]);

  return {
    extracted_char_count: extractedText.length,
    embeddings_count: embeddingsCount,
    ai_summary,
  };
}
