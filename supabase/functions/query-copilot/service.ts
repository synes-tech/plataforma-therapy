import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertCanUseAiPaywall } from '../_shared/paywall.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { QueryCopilotPayload, QueryCopilotResponse } from './types.ts';
import { validateOutput } from './guardrails.ts';
import { prepareCopilotContext } from './context.ts';
import { vertexChat, vertexChatStream, CHAT_MODEL } from '../_shared/vertex.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const LLM_OPTS = {
  temperature: 0.3,
  maxOutputTokens: 4096,
  thinkingBudget: 1024,
} as const;

async function finalizeCopilotAnswer(
  answer: string,
  tokensUsed: number,
  answerIncomplete: boolean,
  ctx: { startTime: number; patientId: string; sources: QueryCopilotResponse['sources']; rerankedCount: number },
  caller: AuthenticatedUser,
): Promise<QueryCopilotResponse> {
  const supabase = createServiceClient();

  const outputCheck = validateOutput(answer);
  if (!outputCheck.safe) {
    console.log(JSON.stringify({
      level: 'warn',
      action: 'output_guardrail_triggered',
      reason: outputCheck.reason,
      patient_id: ctx.patientId,
    }));

    return {
      answer: 'A IA gerou uma resposta que foi filtrada por conter conteúdo fora do escopo permitido (ex: sugestão de medicação). Por favor, reformule sua pergunta focando em atividades terapêuticas ou análise comportamental.',
      sources: [],
      guardrail_triggered: true,
      tokens_used: tokensUsed,
      latency_ms: Date.now() - ctx.startTime,
    };
  }

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
  let answer: string;
  let tokensUsed: number;
  let answerIncomplete = false;

  try {
    const llm = await vertexChat(context.chatMessages, {
      system: context.systemInstruction,
      ...LLM_OPTS,
    });
    answer = llm.text;
    tokensUsed = llm.tokens;
    answerIncomplete = llm.truncated;
  } catch (e) {
    throw new AppError({ code: 'LLM_ERROR', message: e instanceof Error ? e.message : 'LLM error', statusCode: 502 });
  }

  return finalizeCopilotAnswer(answer, tokensUsed, answerIncomplete, context, caller);
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
