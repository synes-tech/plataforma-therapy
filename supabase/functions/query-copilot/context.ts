import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  QueryCopilotPayload,
  QueryCopilotResponse,
  RetrievedChunk,
  SourceReference,
} from './types.ts';
import { validateInput, anonymizeForLLM } from './guardrails.ts';
import { vertexEmbedSingle, type ChatMessage } from '../_shared/vertex.ts';
import {
  buildCopilotSystemInstruction,
  DIARY_CONTEXT_LIMIT,
  SESSION_CONTEXT_LIMIT,
  SESSION_INVENTORY_LIMIT,
  type DiaryEntryRow,
  type PatientBaseRow,
  type SessionInventoryRow,
  type SessionNoteRow,
} from './patient-context.ts';

/** Perguntas factuais de quantidade/histórico — reduzem o viés de recência no RAG. */
function isSessionHistoryQuestion(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /quantas?\s+sess/.test(m) ||
    /n[uú]mero\s+de\s+sess/.test(m) ||
    /total\s+de\s+sess/.test(m) ||
    /hist[oó]rico\s+de\s+sess/.test(m) ||
    /quantas?\s+vezes/.test(m) ||
    /em\s+quais?\s+meses?/.test(m) ||
    /j[aá]\s+(foram\s+)?realizad/.test(m) ||
    /sess[oõ]es?\s+(foram\s+)?realizad/.test(m)
  );
}

export interface CopilotPreparedContext {
  startTime: number;
  patientId: string;
  systemInstruction: string;
  chatMessages: ChatMessage[];
  sources: SourceReference[];
  rerankedCount: number;
}

export type CopilotPrepareResult =
  | { kind: 'early'; response: QueryCopilotResponse }
  | { kind: 'ready'; context: CopilotPreparedContext };

const PATIENT_SELECT = `
  id, name, birth_date, professional_id, diagnoses, clinical_observations,
  nome_social, nome_responsavel, escolaridade_ocupacao, queixa_principal, medicamentos, acompanhamento_multi,
  composicao_familiar, responsaveis, objetivos_terapeuticos, hiperfocos_interesses, informacoes_adicionais
`;

export async function prepareCopilotContext(
  payload: QueryCopilotPayload,
  caller: AuthenticatedUser,
): Promise<CopilotPrepareResult> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  const inputCheck = validateInput(payload.message);
  if (!inputCheck.safe) {
    return {
      kind: 'early',
      response: {
        answer: 'Não foi possível processar sua mensagem. Por favor, reformule a pergunta.',
        sources: [],
        guardrail_triggered: true,
        tokens_used: 0,
        latency_ms: Date.now() - startTime,
      },
    };
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select(PATIENT_SELECT)
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (patientError || !patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found', statusCode: 404 });
  }

  const typedPatient = patient as PatientBaseRow;

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, name, crp, specialty')
    .eq('user_id', caller.id)
    .eq('id', typedPatient.professional_id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new ForbiddenError('You do not have access to this patient');
  }

  const historyQuestion = isSessionHistoryQuestion(payload.message);

  const [queryEmbedding, recentDiariesResult, recentSessionsResult, sessionInventoryResult] =
    await Promise.all([
      vertexEmbedSingle(payload.message, 'RETRIEVAL_QUERY'),
      supabase
        .from('diary_entries')
        .select('entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, categories, notes')
        .eq('patient_id', payload.patient_id)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
        .limit(DIARY_CONTEXT_LIMIT),
      supabase
        .from('session_notes')
        .select('created_at, status, content')
        .eq('patient_id', payload.patient_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(SESSION_CONTEXT_LIMIT),
      supabase
        .from('session_notes')
        .select('created_at, status')
        .eq('patient_id', payload.patient_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(SESSION_INVENTORY_LIMIT),
    ]);

  const { data: semanticResults } = await supabase.rpc('search_patient_embeddings', {
    p_patient_id: payload.patient_id,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: historyQuestion ? 25 : 15,
    p_match_threshold: 0.55,
  });

  const retrievedChunks: RetrievedChunk[] = (semanticResults ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    document_type: r.document_type as string,
    metadata: r.metadata as Record<string, unknown>,
    similarity: r.similarity as number,
    created_at: r.created_at as string,
  }));

  const now = Date.now();
  // Em perguntas de histórico/quantidade, prioriza similaridade e quase não pune sessões antigas.
  const similarityWeight = historyQuestion ? 0.9 : 0.7;
  const recencyWeight = historyQuestion ? 0.1 : 0.3;
  const recencyHalfLifeDays = historyQuestion ? 365 : 30;
  const topK = historyQuestion ? 8 : 5;

  const reranked = retrievedChunks
    .map((chunk) => {
      const ageInDays = (now - new Date(chunk.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.exp(-ageInDays / recencyHalfLifeDays);
      return {
        ...chunk,
        finalScore: chunk.similarity * similarityWeight + recencyBoost * recencyWeight,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);

  const ragContext = reranked
    .map((chunk, i) => {
      const fileName =
        chunk.document_type === 'patient_attachment' &&
        typeof chunk.metadata?.file_name === 'string'
          ? ` | ${chunk.metadata.file_name}`
          : '';
      return `[Fonte ${i + 1} | ${chunk.document_type}${fileName} | ${chunk.created_at.split('T')[0]}]\n${anonymizeForLLM(chunk.content)}`;
    })
    .join('\n\n---\n\n');

  const diaryEntries = (recentDiariesResult.data ?? []) as DiaryEntryRow[];
  const sessionNotes = (recentSessionsResult.data ?? []) as SessionNoteRow[];
  const sessionInventory = (sessionInventoryResult.data ?? []) as SessionInventoryRow[];

  const systemInstruction = buildCopilotSystemInstruction({
    patient: typedPatient,
    diaryEntries,
    sessionNotes,
    sessionInventory,
    ragContext,
    professional: professional
      ? {
          name: professional.name,
          crp: professional.crp,
          specialty: professional.specialty,
        }
      : undefined,
  });

  const chatMessages: ChatMessage[] = [];
  if (payload.conversation_history) {
    for (const msg of payload.conversation_history.slice(-6)) {
      chatMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }
  }
  chatMessages.push({ role: 'user', content: anonymizeForLLM(payload.message) });

  const sources: SourceReference[] = reranked.map((chunk) => ({
    content_preview: chunk.content.slice(0, 100) + '...',
    document_type: chunk.document_type,
    created_at: chunk.created_at,
    similarity: Math.round(chunk.similarity * 100) / 100,
  }));

  return {
    kind: 'ready',
    context: {
      startTime,
      patientId: payload.patient_id,
      systemInstruction,
      chatMessages,
      sources,
      rerankedCount: reranked.length,
    },
  };
}
