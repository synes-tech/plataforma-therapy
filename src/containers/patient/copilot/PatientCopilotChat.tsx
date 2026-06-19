import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callFunctionStream, type CopilotStreamMeta } from '@shared/lib/api';
import { Toast } from '../Toast';
import { LoadingOverlay, TabPanelLoader } from '@containers/loading';
import { PatientCopilotChatInput } from './PatientCopilotChatInput';
import { PatientCopilotEmptyState } from './PatientCopilotEmptyState';
import { PatientCopilotMessageBubble } from './PatientCopilotMessageBubble';
import { ARTIFACT_TOAST_MESSAGES } from './patient-copilot-artifact.constants';
import {
  buildAssistantSyncKey,
  buildSavedTypesByMessage,
  EMPTY_SAVED_TYPES,
  mergeSavedType,
  removeSavedType,
} from './patient-copilot-saved-state';
import { buildConversationHistory, patientFirstName } from './patient-copilot.utils';
import type { AiArtifactType, CopilotMessage } from './patient-copilot.types';
import { usePatientCopilotSavedArtifacts } from './usePatientCopilotSavedArtifacts';

export interface PatientCopilotChatProps {
  patientId: string;
  patientName: string;
  onBeforeSend?: () => boolean;
  onPaymentRequired?: () => void;
}

interface SavingTarget {
  messageId: string;
  tipo: AiArtifactType;
}

export function PatientCopilotChat({
  patientId,
  patientName,
  onBeforeSend,
  onPaymentRequired,
}: PatientCopilotChatProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [savedByMessage, setSavedByMessage] = useState<Record<string, Set<AiArtifactType>>>({});
  const [saving, setSaving] = useState<SavingTarget | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fingerprintCacheRef = useRef(new Map<string, string>());
  const firstName = patientFirstName(patientName);

  const { savedKeys, savedKeysSerialized, saveArtifact, isLoadingArtifacts } =
    usePatientCopilotSavedArtifacts(patientId);

  const assistantSyncKey = useMemo(() => buildAssistantSyncKey(messages), [messages]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput('');
    setIsStreaming(false);
    setSavedByMessage({});
    setSaving(null);
    fingerprintCacheRef.current.clear();
  }, [patientId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!assistantSyncKey) {
      setSavedByMessage({});
      return;
    }

    let cancelled = false;
    const snapshot = messages;

    void buildSavedTypesByMessage(snapshot, savedKeys, fingerprintCacheRef.current).then((next) => {
      if (!cancelled) {
        setSavedByMessage(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assistantSyncKey, savedKeysSerialized, savedKeys]);

  const handleSaveArtifact = useCallback(
    async (messageId: string, content: string, tipo: AiArtifactType) => {
      if (saving) return;

      setSaving({ messageId, tipo });
      setSavedByMessage((prev) => mergeSavedType(prev, messageId, tipo));

      try {
        await saveArtifact(content, tipo);
        setToast({ message: ARTIFACT_TOAST_MESSAGES[tipo], variant: 'success' });
      } catch (err) {
        setSavedByMessage((prev) => removeSavedType(prev, messageId, tipo));
        setToast({
          message: err instanceof Error ? err.message : 'Falha ao salvar',
          variant: 'error',
        });
      } finally {
        setSaving(null);
      }
    },
    [saveArtifact, saving],
  );

  async function streamReply(userMessage: string, assistantId: string, historySnapshot: CopilotMessage[]) {
    const conversationHistory = buildConversationHistory(historySnapshot);
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    await callFunctionStream(
      'query-copilot',
      {
        patient_id: patientId,
        message: userMessage,
        conversation_history: conversationHistory,
        stream: true,
      },
      {
        onChunk: (text) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m)),
          );
        },
        onRetry: () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: '', streaming: true } : m)),
          );
        },
        onDone: (meta: CopilotStreamMeta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: meta.answer,
                    sources: meta.sources,
                    guardrail_triggered: meta.guardrail_triggered,
                    answer_incomplete: meta.answer_incomplete,
                    streaming: false,
                  }
                : m,
            ),
          );
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (err: Error & { code?: string }) => {
          if (controller.signal.aborted) return;
          if (err.code === 'PAYMENT_REQUIRED') {
            onPaymentRequired?.();
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            setIsStreaming(false);
            abortRef.current = null;
            return;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Erro ao processar: ${err.message}`, streaming: false }
                : m,
            ),
          );
          setIsStreaming(false);
          abortRef.current = null;
        },
      },
      controller.signal,
    );
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    if (onBeforeSend && !onBeforeSend()) return;

    const assistantId = crypto.randomUUID();
    const userMessage: CopilotMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const pendingAssistant: CopilotMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setInput('');
    setMessages((prev) => {
      const next = [...prev, userMessage, pendingAssistant];
      void streamReply(trimmed, assistantId, prev);
      return next;
    });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
        <LoadingOverlay show={isLoadingArtifacts} label="Preparando copiloto..." />

        {isLoadingArtifacts && messages.length === 0 ? (
          <TabPanelLoader label="Carregando copiloto..." className="min-h-[16rem] border-0 shadow-none" />
        ) : messages.length === 0 ? (
          <PatientCopilotEmptyState
            patientName={patientName}
            onQuickPrompt={send}
            disabled={isStreaming}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => (
              <PatientCopilotMessageBubble
                key={msg.id}
                message={msg}
                savedTypes={savedByMessage[msg.id] ?? EMPTY_SAVED_TYPES}
                savingType={saving?.messageId === msg.id ? saving.tipo : null}
                onSaveArtifact={(tipo) => void handleSaveArtifact(msg.id, msg.content, tipo)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <PatientCopilotChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => send(input)}
        patientFirstName={firstName}
        disabled={isStreaming}
      />

      <Toast
        message={toast?.message ?? ''}
        visible={toast !== null}
        variant={toast?.variant ?? 'success'}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
