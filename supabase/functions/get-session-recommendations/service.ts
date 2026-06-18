import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { assertCanUseAiPaywall } from '../_shared/paywall.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { vertexChat, type ChatMessage } from '../_shared/vertex.ts';
import type { RecommendationsPayload, RecommendationsResponse, Recommendation } from './types.ts';
import {
  buildContextFromData,
  sessionFetchLimit,
  needsSessions,
  needsDiary,
  DIARY_WEEK_DAYS,
  type RecommendationContextFlags,
} from './context-builder.ts';

const PATIENT_PROFILE_SELECT = `
  id, name, professional_id, diagnoses, clinical_observations,
  nome_social, escolaridade_ocupacao, queixa_principal, medicamentos, acompanhamento_multi,
  composicao_familiar, responsaveis, objetivos_terapeuticos, hiperfocos_interesses, informacoes_adicionais
`;

function buildSystemPrompt(
  flags: RecommendationContextFlags,
  contextText: string,
  activeSources: string[],
  isRegenerate: boolean,
  previousBlock: string,
): string {
  const focusInstructions: string[] = [];

  if (flags.use_profile) {
    focusInstructions.push(
      'FICHA CLÍNICA: alinhe atividades aos hiperfocos, objetivos terapêuticos e queixa principal.',
    );
  }
  if (flags.use_family_diary) {
    focusInstructions.push(
      'DIÁRIO FAMILIAR: priorize comportamentos em casa, humor, sono e crises relatadas pela família.',
    );
  }
  if (flags.use_last_session) {
    focusInstructions.push(
      'ÚLTIMA SESSÃO: continue o plano terapêutico e aborde pendências da sessão mais recente.',
    );
  }
  if (flags.use_history) {
    focusInstructions.push(
      'HISTÓRICO DE SESSÕES: identifique padrões de evolução ao longo das sessões anteriores.',
    );
  }

  return `Você é um assistente clínico especializado em terapia infantil (TEA/TDAH).
Gere recomendações práticas e acionáveis para a PRÓXIMA sessão terapêutica.

FONTES ATIVAS NESTA REQUISIÇÃO: ${activeSources.join(', ') || 'nenhuma'}

INSTRUÇÕES DE FOCO (use APENAS as fontes fornecidas abaixo — ignore seções ausentes ou vazias):
${focusInstructions.map((l) => `- ${l}`).join('\n')}

Se uma seção não foi incluída ou está vazia, NÃO invente dados. Baseie-se exclusivamente no que foi enviado.
${previousBlock}

REGRAS DE SAÍDA:
- Retorne EXATAMENTE um JSON válido (sem markdown, sem blocos de código)
- Estrutura: { "summary": "string", "recommendations": [...] }
- Cada recomendação: { "title": "string curto", "description": "detalhamento", "category": "activity|observation|follow_up|alert", "priority": "high|medium|low" }
- Máximo 5 recomendações, ordenadas por prioridade
- Nunca sugira medicações ou diagnósticos novos

=== DADOS CLÍNICOS SELECIONADOS ===
${contextText || 'Nenhum dado disponível para as fontes selecionadas.'}`;
}

export async function getSessionRecommendations(
  payload: RecommendationsPayload,
  caller: AuthenticatedUser,
): Promise<RecommendationsResponse> {
  const startTime = Date.now();
  const supabase = createServiceClient();
  const flags = payload.context;
  const isRegenerate = payload.regenerate === true;

  const { data: patient } = await supabase
    .from('patients')
    .select(PATIENT_PROFILE_SELECT)
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', caller.id)
    .eq('id', patient.professional_id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new ForbiddenError('Você não tem acesso a este paciente');
  }

  if (caller.clinic_id) {
    await assertCanUseAiPaywall(caller.clinic_id);
  }

  let diary: Array<{
    entry_date: string;
    mood_score: number;
    sleep_quality: number;
    crisis_occurred: boolean;
    crisis_level: number | null;
    notes: string | null;
  }> = [];

  if (needsDiary(flags)) {
    const since = new Date(Date.now() - DIARY_WEEK_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data } = await supabase
      .from('diary_entries')
      .select('entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, notes')
      .eq('patient_id', payload.patient_id)
      .is('deleted_at', null)
      .gte('entry_date', since)
      .order('entry_date', { ascending: false });

    diary = data ?? [];
  }

  let sessions: Array<{ content: Record<string, string>; status: string; created_at: string }> = [];

  if (needsSessions(flags)) {
    const limit = sessionFetchLimit(flags);
    const { data } = await supabase
      .from('session_notes')
      .select('content, status, created_at')
      .eq('patient_id', payload.patient_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    sessions = (data ?? []).map((n) => ({
      content: n.content as Record<string, string>,
      status: n.status,
      created_at: n.created_at,
    }));
  }

  const built = buildContextFromData(flags, { patient, diary, sessions });
  const contextText = built.blocks.join('\n\n');

  const previousBlock = isRegenerate
    ? `
MODO ALTERNATIVO (REGENERAR):
Gere abordagens alternativas e diferentes das sugeridas anteriormente.
NÃO repita as mesmas atividades ou observações.

=== VERSÃO ANTERIOR (NÃO REPETIR) ===
Resumo anterior: ${payload.previous_summary ?? 'N/A'}
Recomendações anteriores:
${(payload.previous_recommendations ?? []).map((r, i) => `${i + 1}. [${r.category}] ${r.title}: ${r.description}`).join('\n') || 'Nenhuma'}
`
    : '';

  const systemPrompt = buildSystemPrompt(
    flags,
    contextText,
    built.activeSources,
    isRegenerate,
    previousBlock,
  );

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: isRegenerate
        ? 'Gere uma NOVA versão alternativa das recomendações para a próxima sessão em formato JSON.'
        : 'Gere as recomendações para a próxima sessão em formato JSON com base apenas nas fontes fornecidas.',
    },
  ];

  let answer: string;
  let tokensUsed: number;

  try {
    const llm = await vertexChat(messages, {
      system: systemPrompt,
      temperature: isRegenerate ? 0.55 : 0.25,
      maxOutputTokens: 2048,
    });
    answer = llm.text;
    tokensUsed = llm.tokens;
  } catch (e) {
    throw new AppError({
      code: 'LLM_ERROR',
      message: e instanceof Error ? e.message : 'Erro ao gerar recomendações',
      statusCode: 502,
    });
  }

  let parsed: { summary: string; recommendations: Recommendation[] };

  try {
    const cleaned = answer.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      summary: 'Recomendações geradas com base no contexto selecionado.',
      recommendations: [{
        title: 'Análise do copiloto',
        description: answer.slice(0, 500),
        category: 'observation',
        priority: 'medium',
      }],
    };
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: caller.clinic_id,
    action: 'ai.session_recommendations',
    resource_type: 'ai_interaction',
    resource_id: payload.patient_id,
    metadata: {
      tokens_used: tokensUsed,
      recommendations_count: parsed.recommendations.length,
      latency_ms: Date.now() - startTime,
      regenerate: isRegenerate,
      context_sources: built.activeSources,
    },
  });

  return {
    recommendations: parsed.recommendations,
    summary: parsed.summary,
    generated_at: new Date().toISOString(),
    tokens_used: tokensUsed,
    latency_ms: Date.now() - startTime,
  };
}
