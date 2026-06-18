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
import { ANAMNESIS_AI_INSTRUCTIONS, formatAnamnesisBlock } from '../_shared/patient-ai-context.ts';

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

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      id, name, professional_id, diagnoses, clinical_observations,
      nome_social, escolaridade_ocupacao, queixa_principal, medicamentos, acompanhamento_multi,
      composicao_familiar, responsaveis, objetivos_terapeuticos, hiperfocos_interesses, informacoes_adicionais
    `)
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found', statusCode: 404 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', caller.id)
    .eq('id', patient.professional_id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new ForbiddenError('You do not have access to this patient');
  }

  const queryEmbedding = await vertexEmbedSingle(payload.message, 'RETRIEVAL_QUERY');

  const { data: semanticResults } = await supabase.rpc('search_patient_embeddings', {
    p_patient_id: payload.patient_id,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: 15,
    p_match_threshold: 0.6,
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
  const reranked = retrievedChunks
    .map((chunk) => {
      const ageInDays = (now - new Date(chunk.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.exp(-ageInDays / 30);
      return { ...chunk, finalScore: chunk.similarity * 0.7 + recencyBoost * 0.3 };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);

  const { data: recentDiaries } = await supabase
    .from('diary_entries')
    .select('entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, categories, notes')
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .limit(7);

  const ragContext = reranked
    .map((chunk, i) => `[Fonte ${i + 1} | ${chunk.document_type} | ${chunk.created_at.split('T')[0]}]\n${anonymizeForLLM(chunk.content)}`)
    .join('\n\n---\n\n');

  const diaryContext = recentDiaries && recentDiaries.length > 0
    ? recentDiaries.map((d) =>
        `Data: ${d.entry_date} | Humor: ${d.mood_score}/5 | Sono: ${d.sleep_quality}/5${d.crisis_occurred ? ` | CRISE nível ${d.crisis_level}` : ''}${d.notes ? ` | Nota: ${d.notes}` : ''}`
      ).join('\n')
    : 'Sem registros de diário na última semana.';

  const systemPrompt = `Você é um copiloto clínico especializado em terapia infantil (TEA e TDAH).
Seu papel é auxiliar o terapeuta com sugestões de atividades, análise comportamental e resumos de contexto.

REGRAS INVIOLÁVEIS:
- Nunca sugira medicações, alterações de dosagem ou diagnósticos novos.
- Sempre cite a fonte dos dados que embasam sua análise (ex: "Conforme relatado no diário de 04/06...").
- Se não houver dados suficientes no histórico deste paciente, diga EXPLICITAMENTE: "Não tenho informações suficientes no histórico deste paciente para responder."
- Responda em português brasileiro, tom profissional mas acessível.
- Se o terapeuta perguntar algo fora do escopo clínico, redirecione educadamente.
- NÃO invente dados. NÃO extrapole além do que está documentado.

${ANAMNESIS_AI_INSTRUCTIONS}

FORMATO DE RESPOSTA:
1. Resumo do contexto relevante (2-3 linhas)
2. Sua análise ou sugestão (detalhada)
3. Fontes utilizadas (liste quais documentos embasam)`;

  const anamnesisBlock = formatAnamnesisBlock(patient);

  const systemInstruction = `${systemPrompt}

=== ANAMNESE DO PACIENTE ===
${anamnesisBlock}

=== CONTEXTO DO PACIENTE (Histórico RAG) ===
${ragContext || 'Nenhum histórico disponível para este paciente.'}

=== DIÁRIO DA FAMÍLIA (Última semana) ===
${diaryContext}`;

  const chatMessages: ChatMessage[] = [];
  if (payload.conversation_history) {
    for (const msg of payload.conversation_history.slice(-6)) {
      chatMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
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
