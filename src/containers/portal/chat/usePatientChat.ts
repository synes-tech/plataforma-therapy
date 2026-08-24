import { useCallback, useEffect, useRef, useState } from 'react';
import { callFunctionStream } from '@shared/lib/api';
import { supabase } from '@shared/lib/supabase';
import { getRetryAfterSeconds, isRateLimitedError, rateLimitUserMessage } from '@shared/lib/rate-limit-message';
import { useCopilotStreamReveal } from '@containers/patient/copilot/useCopilotStreamReveal';
import type { CompanionHistoryRow, CompanionInputSource, PatientChatMessage } from './patient-chat.types';
import {
  companionMetaFromDone,
  historyRowToMessage,
  isCompanionRiskLevel,
  trimCompanionDraft,
} from './patient-chat.utils';

const HISTORY_LIMIT = 80;

export function usePatientChat(patientId: string) {
  const [messages, setMessages] = useState<PatientChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const reveal = useCopilotStreamReveal((visible) => {
    const id = streamingIdRef.current;
    if (!id) return;
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, content: visible } : item)));
  });

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    const { data, error } = await supabase
      .from('patient_copilot_messages')
      .select('id, role, content, input_source, risk_level, emergency_protocol_shown, created_at')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(HISTORY_LIMIT);

    if (error) {
      setHistoryError('Não foi possível carregar a conversa. Tente de novo.');
      setMessages([]);
      setIsLoadingHistory(false);
      return;
    }

    setMessages(((data ?? []) as CompanionHistoryRow[]).map(historyRowToMessage));
    setIsLoadingHistory(false);
  }, [patientId]);

  useEffect(() => {
    void loadHistory();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadHistory]);

  const send = useCallback(
    async (rawText: string, inputSource: CompanionInputSource = 'text') => {
      const message = trimCompanionDraft(rawText);
      if (!message || sendingRef.current) return;

      sendingRef.current = true;
      setIsSending(true);
      setSendError(null);

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      streamingIdRef.current = assistantId;

      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: 'user',
          content: message,
          inputSource,
          createdAt: now,
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          streaming: true,
          createdAt: now,
        },
      ]);

      reveal.start();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      await callFunctionStream(
        'query-patient-companion',
        { message, stream: true, input_source: inputSource },
        {
          onChunk: (chunk) => {
            reveal.pushChunk(chunk);
          },
          onDone: (meta) => {
            const companion = companionMetaFromDone({
              answer: meta.answer,
              risk_level: meta.risk_level,
              emergency_protocol_shown: meta.emergency_protocol_shown,
              thread_id: meta.thread_id,
              message_id: meta.message_id,
              detector: meta.detector,
            });
            reveal.finish(companion.answer || meta.answer);
            streamingIdRef.current = null;
            setMessages((prev) =>
              prev.map((item) => {
                if (item.id !== assistantId) return item;
                return {
                  ...item,
                  id: companion.message_id ?? item.id,
                  content: companion.answer || item.content,
                  streaming: false,
                  riskLevel: isCompanionRiskLevel(companion.risk_level) ? companion.risk_level : undefined,
                  emergencyProtocolShown: companion.emergency_protocol_shown,
                };
              }),
            );
            sendingRef.current = false;
            setIsSending(false);
          },
          onError: (err) => {
            reveal.reset();
            streamingIdRef.current = null;
            setMessages((prev) => prev.filter((item) => item.id !== assistantId));
            if (isRateLimitedError(err)) {
              setSendError(rateLimitUserMessage(getRetryAfterSeconds(err)));
            } else {
              setSendError(err.message || 'Não consegui responder agora. Tente de novo.');
            }
            sendingRef.current = false;
            setIsSending(false);
          },
        },
        controller.signal,
      );

      if (controller.signal.aborted) {
        reveal.reset();
        streamingIdRef.current = null;
        sendingRef.current = false;
        setIsSending(false);
      }
    },
    [reveal],
  );

  return {
    messages,
    isLoadingHistory,
    historyError,
    sendError,
    isSending,
    send,
    reloadHistory: loadHistory,
  };
}
