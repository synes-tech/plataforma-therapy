import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  QueryCopilotPayload,
  QueryCopilotResponse,
  RetrievedChunk,
  SourceReference,
} from './types.ts';
import { validateInput, validateOutput, anonymizeForLLM } from './guardrails.ts';
import { vertexChat, vertexEmbedSingle, CHAT_MODEL, type ChatMessage } from '../_shared/vertex.ts';

/**
 * Copilot Query — Full RAG Pipeline
 *
 * Follows Agente 3 (IA Generativa) architecture:
 * 1. Input Guardrails (Agente 6 - Segurança)
 * 2. Generate query embedding
 * 3. Hybrid Search: pgvector semantic + full-text keyword (Agente 3 - Section 4.2)
 * 4. Metadata Filtering by patient_id (CRITICAL isolation - Agente 3 - Section 3.1)
 * 5. Reranking (Agente 3 - Section 4.4)
 * 6. Build context + meta-prompt (Agente 3 - Section 5)
 * 7. LLM call with temperature control (Agente 3 - Section 5.2)
 * 8. Output Guardrails (Agente 6)
 * 9. Return with sources (Grounding - Agente 3 - Section 3.4)
 */
export async function queryCopilot(
  payload: QueryCopilotPayload,
  caller: AuthenticatedUser,
): Promise<QueryCopilotResponse> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  // ============================================================
  // STEP 0: Input Guardrails
  // ============================================================
  const inputCheck = validateInput(payload.message);
  if (!inputCheck.safe) {
    return {
      answer: 'Não foi possível processar sua mensagem. Por favor, reformule a pergunta.',
      sources: [],
      guardrail_triggered: true,
      tokens_used: 0,
      latency_ms: Date.now() - startTime,
    };
  }

  // ============================================================
  // STEP 1: Verify patient access
  // ============================================================
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name, professional_id')
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found', statusCode: 404 });
  }

  // Verify caller owns this patient
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

  // ============================================================
  // STEP 2: Generate query embedding (Gemini, RETRIEVAL_QUERY)
  // ============================================================
  const queryEmbedding = await vertexEmbedSingle(payload.message, 'RETRIEVAL_QUERY');

  // ============================================================
  // STEP 3: Hybrid Search (Semantic + Keyword)
  // Agente 3 - Section 4.2: Combine pgvector with ts_rank
  // ============================================================
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

  // ============================================================
  // STEP 4: Reranking (simple scoring by recency + similarity)
  // Agente 3 - Section 4.4
  // ============================================================
  const now = Date.now();
  const reranked = retrievedChunks
    .map((chunk) => {
      const ageInDays = (now - new Date(chunk.created_at).getTime()) / (1000 * 60 * 60 * 24);
      // Boost recent items: exponential decay over 30 days
      const recencyBoost = Math.exp(-ageInDays / 30);
      const finalScore = chunk.similarity * 0.7 + recencyBoost * 0.3;
      return { ...chunk, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5); // Top 5 after reranking

  // ============================================================
  // STEP 5: Get recent diary entries (short-term context)
  // Agente 3 - Section 3.3: Copiloto Clínico Dinâmico
  // ============================================================
  const { data: recentDiaries } = await supabase
    .from('diary_entries')
    .select('entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, categories, notes')
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .limit(7);

  // ============================================================
  // STEP 6: Build context + meta-prompt
  // Agente 3 - Section 5.1: 4-layer prompt structure
  // ============================================================
  const ragContext = reranked
    .map((chunk, i) => `[Fonte ${i + 1} | ${chunk.document_type} | ${chunk.created_at.split('T')[0]}]\n${anonymizeForLLM(chunk.content)}`)
    .join('\n\n---\n\n');

  const diaryContext = recentDiaries && recentDiaries.length > 0
    ? recentDiaries.map((d) =>
        `Data: ${d.entry_date} | Humor: ${d.mood_score}/5 | Sono: ${d.sleep_quality}/5${d.crisis_occurred ? ` | CRISE nível ${d.crisis_level}` : ''}${d.notes ? ` | Nota: ${d.notes}` : ''}`
      ).join('\n')
    : 'Sem registros de diário na última semana.';

  // System prompt — Agente 3 - Section 5.3
  const systemPrompt = `Você é um copiloto clínico especializado em terapia infantil (TEA e TDAH).
Seu papel é auxiliar o terapeuta com sugestões de atividades, análise comportamental e resumos de contexto.

REGRAS INVIOLÁVEIS:
- Nunca sugira medicações, alterações de dosagem ou diagnósticos novos.
- Sempre cite a fonte dos dados que embasam sua análise (ex: "Conforme relatado no diário de 04/06...").
- Se não houver dados suficientes no histórico deste paciente, diga EXPLICITAMENTE: "Não tenho informações suficientes no histórico deste paciente para responder."
- Responda em português brasileiro, tom profissional mas acessível.
- Se o terapeuta perguntar algo fora do escopo clínico, redirecione educadamente.
- NÃO invente dados. NÃO extrapole além do que está documentado.

FORMATO DE RESPOSTA:
1. Resumo do contexto relevante (2-3 linhas)
2. Sua análise ou sugestão (detalhada)
3. Fontes utilizadas (liste quais documentos embasam)`;

  // System instruction (instruções + contexto RAG + diário) → systemInstruction do Gemini
  const systemInstruction = `${systemPrompt}

=== CONTEXTO DO PACIENTE (Histórico RAG) ===
${ragContext || 'Nenhum histórico disponível para este paciente.'}

=== DIÁRIO DA FAMÍLIA (Última semana) ===
${diaryContext}`;

  // Histórico de conversa (últimas N) + mensagem atual
  const chatMessages: ChatMessage[] = [];
  if (payload.conversation_history) {
    for (const msg of payload.conversation_history.slice(-6)) {
      chatMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
  }
  chatMessages.push({ role: 'user', content: anonymizeForLLM(payload.message) });

  // ============================================================
  // STEP 7: LLM Call (Gemini)
  // Agente 3 - Section 5.2: Temperature 0.3 for analysis + suggestions
  // ============================================================
  let answer: string;
  let tokensUsed: number;
  try {
    const llm = await vertexChat(chatMessages, {
      system: systemInstruction,
      temperature: 0.3,
      maxOutputTokens: 1500,
    });
    answer = llm.text;
    tokensUsed = llm.tokens;
  } catch (e) {
    throw new AppError({ code: 'LLM_ERROR', message: e instanceof Error ? e.message : 'LLM error', statusCode: 502 });
  }

  // ============================================================
  // STEP 8: Output Guardrails
  // Agente 6 - Section 5.4: Output Sanitization
  // ============================================================
  const outputCheck = validateOutput(answer);
  if (!outputCheck.safe) {
    console.log(JSON.stringify({
      level: 'warn',
      action: 'output_guardrail_triggered',
      reason: outputCheck.reason,
      patient_id: payload.patient_id,
    }));

    return {
      answer: 'A IA gerou uma resposta que foi filtrada por conter conteúdo fora do escopo permitido (ex: sugestão de medicação). Por favor, reformule sua pergunta focando em atividades terapêuticas ou análise comportamental.',
      sources: [],
      guardrail_triggered: true,
      tokens_used: tokensUsed,
      latency_ms: Date.now() - startTime,
    };
  }

  // ============================================================
  // STEP 9: Build sources for grounding (Agente 3 - Section 3.4)
  // ============================================================
  const sources: SourceReference[] = reranked.map((chunk) => ({
    content_preview: chunk.content.slice(0, 100) + '...',
    document_type: chunk.document_type,
    created_at: chunk.created_at,
    similarity: Math.round(chunk.similarity * 100) / 100,
  }));

  // ============================================================
  // STEP 10: Log interaction (Agente 3 - Section 6.3)
  // ============================================================
  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: caller.clinic_id,
    action: 'ai.copilot_query',
    resource_type: 'ai_interaction',
    resource_id: payload.patient_id,
    metadata: {
      tokens_used: tokensUsed,
      chunks_retrieved: reranked.length,
      latency_ms: Date.now() - startTime,
      model: CHAT_MODEL,
      guardrail_triggered: false,
    },
  });

  return {
    answer,
    sources,
    guardrail_triggered: false,
    tokens_used: tokensUsed,
    latency_ms: Date.now() - startTime,
  };
}
