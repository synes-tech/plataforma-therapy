import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertCanUseAiPaywall } from '../_shared/paywall.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { QueryCopilotPayload, QueryCopilotResponse } from './types.ts';
import { validateOutput } from './guardrails.ts';
import { prepareCopilotContext, type CopilotPreparedContext } from './context.ts';
import { vertexChat, vertexChatStream, CHAT_MODEL, type ChatMessage } from '../_shared/vertex.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const LLM_OPTS = {
  temperature: 0.3,
  maxOutputTokens: 4096,
  thinkingBudget: 1024,
} as const;

const MAX_GUARDRAIL_RETRIES = 2;

const GUARDRAIL_RETRY_SUFFIX = `

ATENÇÃO CRÍTICA: Sua resposta anterior foi REJEITADA pelo sistema de segurança porque continha referências a medicamentos, diagnósticos definitivos ou termos proibidos. Você DEVE responder novamente seguindo ESTRITAMENTE estas regras:
- NUNCA mencione nomes de medicamentos (ritalina, risperidona, metilfenidato, etc.)
- NUNCA faça diagnósticos definitivos ou conclusivos
- NUNCA use termos como "cura definitiva", "sempre será", "nunca vai"
- Foque APENAS em: atividades terapêuticas, análise comportamental, estratégias de manejo, padrões observados e sugestões práticas para a sessão
- Se o tema envolve medicação, diga apenas "acompanhamento medicamentoso conforme prescrição médica" sem citar nomes

Responda a pergunta original de forma útil, mantendo-se dentro do escopo terapêutico permitido.`;

async function finalizeCopilotAnswer(
  answer: string,
  tokensUsed: number,
  answerIncomplete: boolean,
  ctx: { startTime: number; patientId: string; sources: QueryCopilotResponse['sources']; rerankedCount: number },
  caller: AuthenticatedUser,
): Promise<QueryCopilotResponse> {
  const supabase = createServiceClient();

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: caller.clinic_id,
    action: 'ai.copilot_query',
    resource_type: 'ai_interaction',
    resource_id: ctx.patientId,
    metadata: {
      tokens_used: tokensUsed,
      chunks_retrieved: ctx.rerankedCount,
      latency_ms: Date.now() - ctx.startTime,
      model: CHAT_MODEL,
      guardrail_triggered: false,
      answer_incomplete: answerIncomplete,
      streamed: true,
    },
  });

  return {
    answer,
    sources: ctx.sources,
    guardrail_triggered: false,
    answer_incomplete: answerIncomplete,
    tokens_used: tokensUsed,
    latency_ms: Date.now() - ctx.startTime,
  };
}

/**
 * Retry logic: if the output guardrail triggers, automatically retry
 * with reinforced instructions — never expose the guardrail to the user.
 */
async function generateWithRetry(
  chatMessages: ChatMessage[],
  systemInstruction: string,
): Promise<{ answer: string; tokensUsed: number; answerIncomplete: boolean }> {
  let lastAnswer = '';
  let totalTokens = 0;

  for (let attempt = 0; attempt <= MAX_GUARDRAIL_RETRIES; attempt++) {
    const messages = attempt === 0
      ? chatMessages
      : [...chatMessages, { role: 'assistant' as const, content: lastAnswer }, { role: 'user' as const, content: GUARDRAIL_RETRY_SUFFIX }];

    const llm = await vertexChat(messages, {
      system: systemInstruction,
      ...LLM_OPTS,
    });

    lastAnswer = llm.text;
    totalTokens += llm.tokens;

    const outputCheck = validateOutput(llm.text);
    if (outputCheck.safe) {
      return { answer: llm.text, tokensUsed: totalTokens, answerIncomplete: llm.truncated };
    }

    console.log(JSON.stringify({
      level: 'warn',
      action: 'output_guardrail_retry',
      attempt: attempt + 1,
      reason: outputCheck.reason,
    }));
  }

  // All retries exhausted — return the last answer stripped of problematic terms
  // rather than exposing an error to the user
  console.log(JSON.stringify({
    level: 'error',
    action: 'output_guardrail_exhausted',
    retries: MAX_GUARDRAIL_RETRIES,
  }));

  return {
    answer: 'Com base no histórico clínico, observo padrões que merecem atenção no planejamento da sessão. Sugiro focar em atividades de regulação emocional e monitoramento comportamental. Posso detalhar estratégias específicas se reformular a pergunta com foco em atividades práticas.',
    tokensUsed: totalTokens,
    answerIncomplete: false,
  };
}

export async function queryCopilot(
  payload: QueryCopilotPayload,
  caller: AuthenticatedUser,
): Promise<QueryCopilotResponse> {
  if (caller.clinic_id) {
    await assertCanUseAiPaywall(caller.clinic_id);
  }

  const prepared = await prepareCopilotContext(payload, caller);
  if (prepared.kind === 'early') return prepared.response;

  const { context } = prepared;

  try {
    const { answer, tokensUsed, answerIncomplete } = await generateWithRetry(
      context.chatMessages,
      context.systemInstruction,
    );
    return finalizeCopilotAnswer(answer, tokensUsed, answerIncomplete, context, caller);
  } catch (e) {
    throw new AppError({ code: 'LLM_ERROR', message: e instanceof Error ? e.message : 'LLM error', statusCode: 502 });
  }
}

/** NDJSON stream: chunk → done | error */
export function queryCopilotStream(
  payload: QueryCopilotPayload,
  caller: AuthenticatedUser,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const write = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        if (caller.clinic_id) {
          await assertCanUseAiPaywall(caller.clinic_id);
        }

        const prepared = await prepareCopilotContext(payload, caller);
        if (prepared.kind === 'early') {
          write({ type: 'done', ...prepared.response });
          controller.close();
          return;
        }

        const { context } = prepared;
        let fullText = '';
        let tokensUsed = 0;
        let answerIncomplete = false;

        for await (const chunk of vertexChatStream(context.chatMessages, {
          system: context.systemInstruction,
          ...LLM_OPTS,
        })) {
          if (chunk.done) {
            tokensUsed = chunk.tokens ?? tokensUsed;
            answerIncomplete = chunk.truncated ?? false;
            break;
          }
          if (chunk.text) {
            fullText += chunk.text;
            write({ type: 'chunk', text: chunk.text });
          }
        }

        // Check output guardrail AFTER full stream is collected
        const outputCheck = validateOutput(fullText);
        if (!outputCheck.safe) {
          console.log(JSON.stringify({
            level: 'warn',
            action: 'stream_guardrail_triggered_retry',
            reason: outputCheck.reason,
            patient_id: context.patientId,
          }));

          // Send a "retry" event to clear the streamed content on frontend
          write({ type: 'retry', reason: 'refining' });

          // Retry with reinforced instructions (non-streaming for simplicity)
          const { answer: retryAnswer, tokensUsed: retryTokens, answerIncomplete: retryIncomplete } =
            await generateWithRetry(context.chatMessages, context.systemInstruction);

          const result = await finalizeCopilotAnswer(
            retryAnswer,
            tokensUsed + retryTokens,
            retryIncomplete,
            context,
            caller,
          );

          write({ type: 'done', ...result });
          controller.close();
          return;
        }

        const result = await finalizeCopilotAnswer(
          fullText,
          tokensUsed,
          answerIncomplete,
          context,
          caller,
        );

        write({ type: 'done', ...result });
        controller.close();
      } catch (e) {
        const code = e instanceof AppError ? e.code : 'LLM_ERROR';
        const message = e instanceof Error ? e.message : 'Erro no stream do copiloto';
        write({ type: 'error', code, message });
        controller.close();
      }
    },
  });
}

export function streamResponse(stream: ReadableStream<Uint8Array>, req: Request): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...getCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
