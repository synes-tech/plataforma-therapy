import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { vertexChat, CHAT_MODEL, type ChatMessage } from '../_shared/vertex.ts';
import { anonymizeForLLM } from '../query-copilot/guardrails.ts';
import { ANAMNESIS_AI_INSTRUCTIONS } from '../_shared/patient-ai-context.ts';
import type {
  GenerateProactiveSummaryPayload,
  GenerateProactiveSummaryResponse,
  ProactiveContextRow,
} from './types.ts';

const TTL_HOURS = 24;

const PROACTIVE_SYSTEM_PROMPT = `Você é um supervisor clínico especializado em terapia infantil (TEA/TDAH).
Prepare um RESUMO PROATIVO para o terapeuta antes da consulta, com foco especial no diário semanal preenchido pela família.

REGRAS INVIOLÁVEIS:
- Baseie-se APENAS nos dados fornecidos.
- Nunca sugira medicações ou novos diagnósticos.
- Priorize sinais do diário familiar (humor, sono, crises, notas dos pais).
- Tom profissional, direto — português brasileiro.
- Não inclua nomes ou dados identificáveis.

${ANAMNESIS_AI_INSTRUCTIONS}

FORMATO OBRIGATÓRIO (Markdown simples — adequado para impressão em PDF):
- Use apenas títulos ## e listas com hífen (-). Sem tabelas, código, links ou formatação complexa.
- Parágrafos curtos (máx. 4 linhas cada).

## Resumo Clínico
(Síntese em bullet points simples.)

## Sugestões de Atividades
(3 a 5 itens com hífen, uma linha cada.)

## Pontos de Atenção
(Alertas do diário familiar em bullet points.)`;

function buildUserPrompt(ctx: ProactiveContextRow): string {
  const parts = [
    '=== PERFIL CLÍNICO ===',
    anonymizeForLLM(ctx.patient_profile ?? ''),
  ];

  if (ctx.weekly_diary?.trim()) {
    parts.push('', '=== DIÁRIO SEMANAL DA FAMÍLIA (7 dias) ===', anonymizeForLLM(ctx.weekly_diary));
  } else {
    parts.push('', '=== DIÁRIO SEMANAL DA FAMÍLIA ===', 'Nenhum registro nos últimos 7 dias.');
  }

  if (ctx.recent_sessions?.trim()) {
    parts.push('', '=== ÚLTIMAS 3 SESSÕES (SOAP) ===', anonymizeForLLM(ctx.recent_sessions));
  }

  if (ctx.evolution_summary?.trim()) {
    parts.push('', '=== EVOLUÇÃO SEMANAL ===', anonymizeForLLM(ctx.evolution_summary));
  }

  parts.push('', 'Gere o resumo proativo nos 3 blocos Markdown especificados.');
  return parts.join('\n');
}

async function verifyPatientAccess(
  supabase: ReturnType<typeof createServiceClient>,
  patientId: string,
  caller: AuthenticatedUser,
): Promise<{ clinic_id: string; professional_id: string }> {
  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id, clinic_id, clinical_observations')
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

  return { clinic_id: patient.clinic_id, professional_id: patient.professional_id };
}

function isCacheFresh(updatedAt: string): boolean {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs < TTL_HOURS * 60 * 60 * 1000;
}

export async function generateProactiveSummary(
  payload: GenerateProactiveSummaryPayload,
  caller: AuthenticatedUser,
): Promise<GenerateProactiveSummaryResponse> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  const { clinic_id, professional_id } = await verifyPatientAccess(supabase, payload.patient_id, caller);

  if (!payload.force) {
    const { data: cached } = await supabase
      .from('patient_proactive_summaries')
      .select('summary_markdown, tokens_used, generated_at, updated_at, diary_entries_count')
      .eq('patient_id', payload.patient_id)
      .maybeSingle();

    if (cached && isCacheFresh(cached.updated_at)) {
      return {
        summary_markdown: cached.summary_markdown,
        generated_at: cached.generated_at,
        updated_at: cached.updated_at,
        from_cache: true,
        tokens_used: cached.tokens_used ?? 0,
        latency_ms: Date.now() - startTime,
        diary_entries_count: cached.diary_entries_count ?? 0,
      };
    }
  }

  const { data: contextRaw, error: contextError } = await supabase.rpc(
    'build_proactive_summary_context',
    { p_patient_id: payload.patient_id },
  );

  if (contextError) {
    const hint = contextError.message.includes('build_proactive_summary_context')
      ? 'Execute a migration 20260618100000_patient_proactive_summaries.sql no banco.'
      : undefined;
    throw new AppError({
      code: 'CONTEXT_FETCH_FAILED',
      message: contextError.message,
      statusCode: 500,
      details: hint ? { hint } : undefined,
    });
  }

  const ctx = contextRaw as ProactiveContextRow;
  if (!ctx?.found) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const hasData = ctx.has_diary_data
    || (ctx.recent_sessions?.trim().length ?? 0) > 0
    || (ctx.patient_profile?.trim().length ?? 0) > 0;

  if (!hasData) {
    throw new AppError({
      code: 'NO_CLINICAL_DATA',
      message: 'Ainda não há diário familiar ou sessões para gerar o resumo proativo.',
      statusCode: 422,
    });
  }

  const messages: ChatMessage[] = [{ role: 'user', content: buildUserPrompt(ctx) }];
  let summaryMarkdown: string;
  let tokensUsed: number;
  let answerIncomplete = false;

  try {
    const llm = await vertexChat(messages, {
      system: PROACTIVE_SYSTEM_PROMPT,
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
      message: e instanceof Error ? e.message : 'Erro ao gerar resumo proativo',
      statusCode: 502,
    });
  }

  if (!summaryMarkdown) {
    throw new AppError({ code: 'LLM_EMPTY', message: 'A IA não retornou conteúdo.', statusCode: 502 });
  }

  const now = new Date().toISOString();
  const diaryCount = ctx.diary_entries_count ?? 0;

  await supabase.from('patient_proactive_summaries').upsert({
    patient_id: payload.patient_id,
    professional_id,
    clinic_id,
    summary_markdown: summaryMarkdown,
    tokens_used: tokensUsed,
    diary_entries_count: diaryCount,
    generated_at: now,
    updated_at: now,
  }, { onConflict: 'patient_id' });

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: caller.clinic_id,
    action: 'ai.proactive_summary',
    resource_type: 'ai_interaction',
    resource_id: payload.patient_id,
    metadata: {
      tokens_used: tokensUsed,
      diary_entries_count: diaryCount,
      latency_ms: Date.now() - startTime,
      model: CHAT_MODEL,
      from_cache: false,
      answer_incomplete: answerIncomplete,
    },
  });

  return {
    summary_markdown: summaryMarkdown,
    generated_at: now,
    updated_at: now,
    from_cache: false,
    tokens_used: tokensUsed,
    latency_ms: Date.now() - startTime,
    answer_incomplete: answerIncomplete,
    diary_entries_count: diaryCount,
  };
}
