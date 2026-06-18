import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { vertexChat, CHAT_MODEL, type ChatMessage } from '../_shared/vertex.ts';
import { anonymizeForLLM } from '../query-copilot/guardrails.ts';
import { ANAMNESIS_AI_INSTRUCTIONS } from '../_shared/patient-ai-context.ts';
import type {
  GeneratePatientSummaryPayload,
  GeneratePatientSummaryResponse,
  SummaryContextRow,
} from './types.ts';

const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `Você é um supervisor clínico especializado em terapia infantil (TEA/TDAH).
Sua função é preparar um BRIEFING EXECUTIVO para o terapeuta antes da consulta.

REGRAS INVIOLÁVEIS:
- Aja apenas com base nos dados fornecidos. Não invente informações.
- Nunca sugira medicações, alterações de dosagem ou novos diagnósticos.
- Se faltar dado para uma seção, declare explicitamente a lacuna.
- Tom profissional, direto e acionável — português brasileiro.
- Não inclua nomes de pacientes ou dados identificáveis.

${ANAMNESIS_AI_INSTRUCTIONS}

FORMATO DE SAÍDA (Markdown limpo, sem blocos de código):
## Alertas críticos
(Liste riscos, crises recentes, regressões ou sinais de piora. Se não houver, escreva "Nenhum alerta crítico identificado no período analisado.")

## Evolução recente
(Resumo da trajetória clínica com base nas últimas sessões e métricas semanais.)

## Foco sugerido para hoje
(3 a 5 pontos práticos para orientar a sessão de hoje.)`;

function buildUserPrompt(ctx: SummaryContextRow, totalSessions: number): string {
  const parts = [
    `Total de sessões no prontuário: ${totalSessions}`,
    `Sessões incluídas neste briefing: até 10 mais recentes + primeira sessão com conteúdo (quando distinta).`,
    '',
    '=== PERFIL / DIAGNÓSTICO INICIAL ===',
    anonymizeForLLM(ctx.patient_profile ?? ''),
  ];

  if (ctx.initial_session?.trim()) {
    parts.push('', '=== PRIMEIRA SESSÃO REGISTRADA (linha de base) ===', anonymizeForLLM(ctx.initial_session));
  }

  if (ctx.recent_sessions?.trim()) {
    parts.push('', '=== ÚLTIMAS SESSÕES (cronológico) ===', anonymizeForLLM(ctx.recent_sessions));
  }

  if (ctx.diary_summary?.trim()) {
    parts.push('', '=== DIÁRIO DA FAMÍLIA (14 dias) ===', anonymizeForLLM(ctx.diary_summary));
  }

  if (ctx.evolution_summary?.trim()) {
    parts.push('', '=== EVOLUÇÃO SEMANAL AGREGADA ===', anonymizeForLLM(ctx.evolution_summary));
  }

  parts.push('', 'Gere o briefing executivo no formato Markdown especificado.');
  return parts.join('\n');
}

async function verifyPatientAccess(
  supabase: ReturnType<typeof createServiceClient>,
  patientId: string,
  caller: AuthenticatedUser,
): Promise<{ clinic_id: string }> {
  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id, clinic_id')
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  if (caller.role === 'professional') {
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
  } else if (caller.role === 'clinic_admin') {
    if (caller.clinic_id !== patient.clinic_id) {
      throw new ForbiddenError('Paciente não pertence à sua clínica');
    }
  }

  return { clinic_id: patient.clinic_id };
}

/**
 * Executive Summary — BFF: auth → contexto SQL → Vertex AI → Markdown
 */
export async function generatePatientSummary(
  payload: GeneratePatientSummaryPayload,
  caller: AuthenticatedUser,
): Promise<GeneratePatientSummaryResponse> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  await verifyPatientAccess(supabase, payload.patient_id, caller);

  const { data: contextRaw, error: contextError } = await supabase.rpc(
    'build_patient_summary_context',
    { p_patient_id: payload.patient_id },
  );

  if (contextError) {
    throw new AppError({
      code: 'CONTEXT_FETCH_FAILED',
      message: contextError.message,
      statusCode: 500,
    });
  }

  const ctx = contextRaw as SummaryContextRow;

  if (!ctx?.found) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const totalSessions = ctx.session_count ?? 0;

  if (!ctx.has_clinical_data) {
    throw new AppError({
      code: 'NO_CLINICAL_DATA',
      message: 'Este paciente ainda não possui sessões ou registros clínicos suficientes para gerar um resumo.',
      statusCode: 422,
    });
  }

  const messages: ChatMessage[] = [
    { role: 'user', content: buildUserPrompt(ctx, totalSessions) },
  ];

  let summaryMarkdown: string;
  let tokensUsed: number;
  let answerIncomplete = false;

  try {
    const llm = await vertexChat(messages, {
      system: EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
      temperature: 0.25,
      maxOutputTokens: 4096,
      thinkingBudget: 1024,
    });
    summaryMarkdown = llm.text.trim();
    tokensUsed = llm.tokens;
    answerIncomplete = llm.truncated;
  } catch (e) {
    throw new AppError({
      code: 'LLM_ERROR',
      message: e instanceof Error ? e.message : 'Erro ao gerar resumo executivo',
      statusCode: 502,
    });
  }

  if (!summaryMarkdown) {
    throw new AppError({
      code: 'LLM_EMPTY',
      message: 'A IA não retornou conteúdo para o resumo.',
      statusCode: 502,
    });
  }

  const sessionsIncluded = Math.min(totalSessions, 10);

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: caller.clinic_id,
    action: 'ai.executive_summary',
    resource_type: 'ai_interaction',
    resource_id: payload.patient_id,
    metadata: {
      tokens_used: tokensUsed,
      total_sessions: totalSessions,
      sessions_included: sessionsIncluded,
      latency_ms: Date.now() - startTime,
      model: CHAT_MODEL,
      answer_incomplete: answerIncomplete,
    },
  });

  return {
    summary_markdown: summaryMarkdown,
    generated_at: new Date().toISOString(),
    tokens_used: tokensUsed,
    latency_ms: Date.now() - startTime,
    answer_incomplete: answerIncomplete,
    scope: {
      sessions_included: sessionsIncluded,
      total_sessions: totalSessions,
    },
  };
}
