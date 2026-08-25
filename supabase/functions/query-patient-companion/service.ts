import { COMPANION_CHAT_MODEL, vertexChat, vertexChatStream, type ChatMessage } from '../_shared/vertex.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { getPortalContext, firstName } from '../get-portal-context/service.ts';
import { scanRiskLexicon } from '../_shared/companion/risk-lexicon.ts';
import { classifyCompanionRisk } from '../_shared/companion/risk-classifier.ts';
import { mergeRiskLayers, type MergedRisk } from '../_shared/companion/risk-merge.ts';
import { EMERGENCY_PROTOCOL_TEXT } from '../_shared/companion/emergency-protocol.ts';
import { buildTherySystemInstruction } from '../_shared/companion/thery-prompt.ts';
import { formatCompanionMemoryBlock } from '../_shared/companion/companion-memory.ts';
import { loadCompanionMemory } from '../_shared/companion/companion-memory-load.ts';
import { detectPromptInjection, enforceTheryOutput } from '../_shared/companion/output-guardrails.ts';
import {
  getOrCreateCompanionThread,
  insertCompanionMessage,
  loadRecentCompanionMessages,
  raiseCompanionClinicalAlert,
} from '../_shared/companion/persist.ts';
import type { QueryPatientCompanionPayload } from './schema.ts';
import type { QueryPatientCompanionResponse } from './types.ts';

const LLM_OPTS = {
  model: COMPANION_CHAT_MODEL,
  temperature: 0.6,
  maxOutputTokens: 1024,
  thinkingBudget: 0,
} as const;

async function assertCompanionAccess(caller: AuthenticatedUser) {
  const context = await getPortalContext(caller);
  if (context.access.level !== 'SELF') {
    throw new ForbiddenError('O Acompanhante conversa com o próprio paciente, não com o cuidador.');
  }
  if (!context.capabilities.companion_chat) {
    throw new AppError({
      code: 'COMPANION_UNAVAILABLE',
      message: 'O Acompanhante está disponível para pacientes adultos com o plano de apoio ativo.',
      statusCode: 402,
    });
  }
  if (!caller.clinic_id) {
    throw new AppError({ code: 'NO_CLINIC', message: 'Conta sem clínica vinculada', statusCode: 400 });
  }
  return context;
}

async function persistTurn(params: {
  threadId: string;
  patientId: string;
  clinicId: string;
  userText: string;
  answer: string;
  inputSource: 'text' | 'audio';
  merged: MergedRisk;
  model?: string;
  latencyMs?: number;
  tokens?: number;
}): Promise<{ userMessageId: string; assistantMessageId: string }> {
  const signals = { signals: params.merged.signals, rationale: params.merged.rationale };
  const userMessageId = await insertCompanionMessage({
    threadId: params.threadId,
    patientId: params.patientId,
    clinicId: params.clinicId,
    role: 'user',
    content: params.userText,
    inputSource: params.inputSource,
    riskLevel: params.merged.risk_level,
    riskSignals: signals,
    riskDetector: params.merged.detector,
    emergencyProtocolShown: params.merged.emergency,
  });

  const assistantMessageId = await insertCompanionMessage({
    threadId: params.threadId,
    patientId: params.patientId,
    clinicId: params.clinicId,
    role: 'assistant',
    content: params.answer,
    riskLevel: params.merged.risk_level,
    riskSignals: signals,
    riskDetector: params.merged.detector,
    emergencyProtocolShown: params.merged.emergency,
    model: params.model,
    latencyMs: params.latencyMs,
    tokensOut: params.tokens,
  });

  if (params.merged.emergency || params.merged.risk_level === 'SEVERE') {
    await raiseCompanionClinicalAlert({
      patientId: params.patientId,
      clinicId: params.clinicId,
      messageId: userMessageId,
      detector: params.merged.detector,
      severity: 'SEVERE',
      reportedText: params.userText,
    });
  } else if (params.merged.risk_level === 'MODERATE') {
    await raiseCompanionClinicalAlert({
      patientId: params.patientId,
      clinicId: params.clinicId,
      messageId: userMessageId,
      detector: params.merged.detector,
      severity: 'MODERATE',
      reportedText: params.userText,
    });
  }

  return { userMessageId, assistantMessageId };
}

function injectionReply(): string {
  return 'Não consigo seguir esse pedido. Se quiser, me conta com as suas palavras como você está agora.';
}

export async function queryPatientCompanion(
  payload: QueryPatientCompanionPayload,
  caller: AuthenticatedUser,
): Promise<QueryPatientCompanionResponse> {
  const started = Date.now();
  const context = await assertCompanionAccess(caller);
  const clinicId = caller.clinic_id!;
  const patientId = context.patient.id;
  const inputSource = payload.input_source ?? 'text';

  const thread = await getOrCreateCompanionThread({
    patientId,
    clinicId,
    userId: caller.id,
    portalLinkId: context.access.link_id,
  });
  const history = await loadRecentCompanionMessages(thread.id);
  const memoryBlock = formatCompanionMemoryBlock(await loadCompanionMemory(patientId));
  const priorAssistant = [...history].reverse().find((item) => item.role === 'assistant')?.content;

  const lexicon = scanRiskLexicon(payload.message);
  const classifier = lexicon.level === 'SEVERE'
    ? await classifyCompanionRisk(payload.message, { priorAssistant }).catch(() => null)
    : await classifyCompanionRisk(payload.message, { priorAssistant });
  const merged = mergeRiskLayers(lexicon, classifier);

  let answer: string;
  let tokens = 0;

  if (merged.emergency) {
    answer = EMERGENCY_PROTOCOL_TEXT;
  } else if (detectPromptInjection(payload.message) && lexicon.level === 'LOW') {
    answer = injectionReply();
  } else {
    const messages: ChatMessage[] = [...history, { role: 'user', content: payload.message }];
    const generated = await vertexChat(messages, {
      ...LLM_OPTS,
      system: buildTherySystemInstruction({
        firstName: context.patient.first_name || firstName(context.patient.name),
        intensity: merged.risk_level === 'MODERATE' ? 'coping' : 'normal',
        memoryBlock,
      }),
    });
    tokens = generated.tokens;
    answer = enforceTheryOutput(generated.text).answer;
  }

  const saved = await persistTurn({
    threadId: thread.id,
    patientId,
    clinicId,
    userText: payload.message,
    answer,
    inputSource,
    merged,
    model: COMPANION_CHAT_MODEL,
    latencyMs: Date.now() - started,
    tokens,
  });

  return {
    thread_id: thread.id,
    message_id: saved.assistantMessageId,
    answer,
    risk_level: merged.risk_level,
    emergency_protocol_shown: merged.emergency,
    detector: merged.detector,
  };
}

export function queryPatientCompanionStream(
  payload: QueryPatientCompanionPayload,
  caller: AuthenticatedUser,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const write = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      const started = Date.now();
      try {
        const context = await assertCompanionAccess(caller);
        const clinicId = caller.clinic_id!;
        const patientId = context.patient.id;
        const inputSource = payload.input_source ?? 'text';

        const lexicon = scanRiskLexicon(payload.message);
        write({ type: 'risk_hint', lexicon: lexicon.level });

        const thread = await getOrCreateCompanionThread({
          patientId,
          clinicId,
          userId: caller.id,
          portalLinkId: context.access.link_id,
        });
        const history = await loadRecentCompanionMessages(thread.id);
        const memoryBlock = formatCompanionMemoryBlock(await loadCompanionMemory(patientId));
        const priorAssistant = [...history].reverse().find((item) => item.role === 'assistant')?.content;
        const classifierPromise = classifyCompanionRisk(payload.message, { priorAssistant });

        if (lexicon.level === 'SEVERE') {
          const classifier = await classifierPromise;
          const merged = mergeRiskLayers(lexicon, classifier);
          write({ type: 'chunk', text: EMERGENCY_PROTOCOL_TEXT });
          const saved = await persistTurn({
            threadId: thread.id,
            patientId,
            clinicId,
            userText: payload.message,
            answer: EMERGENCY_PROTOCOL_TEXT,
            inputSource,
            merged,
            model: COMPANION_CHAT_MODEL,
            latencyMs: Date.now() - started,
          });
          write({
            type: 'done',
            thread_id: thread.id,
            message_id: saved.assistantMessageId,
            answer: EMERGENCY_PROTOCOL_TEXT,
            risk_level: merged.risk_level,
            emergency_protocol_shown: true,
            detector: merged.detector,
          });
          controller.close();
          return;
        }

        if (detectPromptInjection(payload.message) && lexicon.level === 'LOW') {
          const merged = mergeRiskLayers(lexicon, await classifierPromise);
          const answer = injectionReply();
          const saved = await persistTurn({
            threadId: thread.id,
            patientId,
            clinicId,
            userText: payload.message,
            answer,
            inputSource,
            merged,
            latencyMs: Date.now() - started,
          });
          write({ type: 'chunk', text: answer });
          write({
            type: 'done',
            thread_id: thread.id,
            message_id: saved.assistantMessageId,
            answer,
            risk_level: merged.risk_level,
            emergency_protocol_shown: merged.emergency,
            detector: merged.detector,
          });
          controller.close();
          return;
        }

        const classifier = await classifierPromise;
        const merged = mergeRiskLayers(lexicon, classifier);

        if (merged.emergency) {
          write({ type: 'chunk', text: EMERGENCY_PROTOCOL_TEXT });
          const saved = await persistTurn({
            threadId: thread.id,
            patientId,
            clinicId,
            userText: payload.message,
            answer: EMERGENCY_PROTOCOL_TEXT,
            inputSource,
            merged,
            model: COMPANION_CHAT_MODEL,
            latencyMs: Date.now() - started,
          });
          write({
            type: 'done',
            thread_id: thread.id,
            message_id: saved.assistantMessageId,
            answer: EMERGENCY_PROTOCOL_TEXT,
            risk_level: 'SEVERE',
            emergency_protocol_shown: true,
            detector: merged.detector,
          });
          controller.close();
          return;
        }

        const messages: ChatMessage[] = [...history, { role: 'user', content: payload.message }];
        let fullText = '';
        let tokens = 0;

        for await (const chunk of vertexChatStream(messages, {
          ...LLM_OPTS,
          system: buildTherySystemInstruction({
            firstName: context.patient.first_name || firstName(context.patient.name),
            intensity: merged.risk_level === 'MODERATE' ? 'coping' : 'normal',
            memoryBlock,
          }),
        })) {
          if (chunk.done) {
            tokens = chunk.tokens ?? tokens;
            break;
          }
          if (chunk.text) {
            fullText += chunk.text;
            write({ type: 'chunk', text: chunk.text });
          }
        }

        const safe = enforceTheryOutput(fullText);
        const saved = await persistTurn({
          threadId: thread.id,
          patientId,
          clinicId,
          userText: payload.message,
          answer: safe.answer,
          inputSource,
          merged,
          model: COMPANION_CHAT_MODEL,
          latencyMs: Date.now() - started,
          tokens,
        });

        write({
          type: 'done',
          thread_id: thread.id,
          message_id: saved.assistantMessageId,
          answer: safe.answer,
          risk_level: merged.risk_level,
          emergency_protocol_shown: false,
          detector: merged.detector,
          sanitized: safe.sanitized,
        });
        controller.close();
      } catch (error) {
        const code = error instanceof AppError ? error.code : 'COMPANION_ERROR';
        const message = error instanceof Error ? error.message : 'Falha no Acompanhante';
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
