import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { callFunctionStream, type CopilotStreamMeta } from '@shared/lib/api';
import { LoadingOverlay, TabPanelLoader } from '@containers/loading';
import { PatientCopilotChatInput } from './PatientCopilotChatInput';
import { PatientCopilotEmptyState } from './PatientCopilotEmptyState';
import { PatientCopilotMessageBubble } from './PatientCopilotMessageBubble';
import {
  buildAssistantSyncKey,
  buildSavedTypesByMessage,
  EMPTY_SAVED_TYPES,
  mergeSavedType,
  removeSavedType,
} from './patient-copilot-saved-state';
import { buildConversationHistory, patientFirstName } from './patient-copilot.utils';
import { PatientCopilotSaveArtifactModal } from './PatientCopilotSaveArtifactModal';
import { AI_ARTIFACT_OPTIONS } from './patient-copilot-artifact.constants';
import { buildArtifactSaveToast } from './patient-copilot-family-share.utils';
import type { AiArtifactType, CopilotMessage } from './patient-copilot.types';
import { usePatientCopilotSavedArtifacts } from './usePatientCopilotSavedArtifacts';
import { useCopilotAudioInput } from './useCopilotAudioInput';
import { Toast } from '../Toast';

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

interface PendingSaveTarget {
  messageId: string;
  content: string;
  tipo: AiArtifactType;
}

type SavedArtifactIdsByMessage = Record<string, Partial<Record<AiArtifactType, string>>>;

export function PatientCopilotChat({
  patientId,
  patientName,
  onBeforeSend,
  onPaymentRequired,
}: PatientCopilotChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [savedByMessage, setSavedByMessage] = useState<Record<string, Set<AiArtifactType>>>({});
  const [savedArtifactIdsByMessage, setSavedArtifactIdsByMessage] = useState<SavedArtifactIdsByMessage>({});
  const [saving, setSaving] = useState<SavingTarget | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSaveTarget | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fingerprintCacheRef = useRef(new Map<string, string>());
  const firstName = patientFirstName(patientName);

  const audioInput = useCopilotAudioInput({
    patientId,
    disabled: isStreaming,
    onTranscribed: (text) => {
      setAudioError(null);
      send(text, 'audio');
    },
    onError: (message) => setAudioError(message),
    onPaymentRequired,
  });

  const { savedKeys, savedKeysSerialized, saveArtifact, isLoadingArtifacts } =
    usePatientCopilotSavedArtifacts(patientId);

  const assistantSyncKey = useMemo(() => buildAssistantSyncKey(messages), [messages]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput('');
    setIsStreaming(false);
    setAudioError(null);
    setSavedByMessage({});
    setSavedArtifactIdsByMessage({});
    setSaving(null);
    setPendingSave(null);
    setToast(null);
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

  const viewDocuments = useCallback(() => {
    navigate(`/patients/${patientId}/documents`);
  }, [navigate, patientId]);

  const viewArtifact = useCallback(
    (artifactId: string) => {
      navigate(`/patients/${patientId}/documents?artifact=${artifactId}`);
    },
    [navigate, patientId],
  );

  const handleRequestSave = useCallback((messageId: string, content: string, tipo: AiArtifactType) => {
    if (saving) return;
    setPendingSave({ messageId, content, tipo });
  }, [saving]);

  const handleConfirmSave = useCallback(
    async (compartilhadoFamilia: boolean) => {
      if (!pendingSave || saving) return;

      const { messageId, content, tipo } = pendingSave;
      setSaving({ messageId, tipo });
      setSavedByMessage((prev) => mergeSavedType(prev, messageId, tipo));

      try {
        const result = await saveArtifact(content, tipo, compartilhadoFamilia);
        setSavedArtifactIdsByMessage((prev) => ({
          ...prev,
          [messageId]: { ...prev[messageId], [tipo]: result.artifactId },
        }));
        setPendingSave(null);
        setToast({
          message: buildArtifactSaveToast(tipo, compartilhadoFamilia),
          variant: 'success',
        });
      } catch (err) {
        setSavedByMessage((prev) => removeSavedType(prev, messageId, tipo));
        setToast({
          message: err instanceof Error ? err.message : 'Falha ao salvar artefato',
          variant: 'error',
        });
        console.error('Falha ao salvar artefato:', err);
      } finally {
        setSaving(null);
      }
    },
    [pendingSave, saveArtifact, saving],
  );

  const pendingSaveOption = pendingSave
    ? AI_ARTIFACT_OPTIONS.find((option) => option.type === pendingSave.tipo)
    : null;

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

  function send(text: string, inputSource: 'text' | 'audio' = 'text') {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    if (inputSource !== 'audio' && audioInput.isBusy) return;
    if (onBeforeSend && !onBeforeSend()) return;

    const assistantId = crypto.randomUUID();
    const userMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      inputSource,
    };
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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <LoadingOverlay show={isLoadingArtifacts} label="Preparando copiloto..." />
        <LoadingOverlay show={audioInput.state === 'transcribing'} label="Transcrevendo seu áudio..." />

        {isLoadingArtifacts && messages.length === 0 ? (
          <TabPanelLoader label="Carregando copiloto..." className="min-h-full flex-1 border-0 shadow-none" />
        ) : messages.length === 0 && audioInput.state !== 'transcribing' ? (
          <PatientCopilotEmptyState
            patientName={patientName}
            onQuickPrompt={send}
            disabled={isStreaming}
          />
        ) : (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col space-y-4 px-4 py-4 lg:px-6 lg:py-5">
            {messages.map((msg) => (
              <PatientCopilotMessageBubble
                key={msg.id}
                message={msg}
                savedTypes={savedByMessage[msg.id] ?? EMPTY_SAVED_TYPES}
                savingType={saving?.messageId === msg.id ? saving.tipo : null}
                savedArtifactIds={savedArtifactIdsByMessage[msg.id] ?? {}}
                onRequestSave={(tipo) => handleRequestSave(msg.id, msg.content, tipo)}
                onViewArtifact={viewArtifact}
                onViewDocuments={viewDocuments}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <PatientCopilotSaveArtifactModal
        isOpen={pendingSave !== null}
        artifactLabel={pendingSaveOption?.label ?? 'Documento'}
        contentPreview={pendingSave?.content ?? ''}
        tipo={pendingSave?.tipo ?? null}
        isSaving={saving !== null}
        onClose={() => {
          if (!saving) setPendingSave(null);
        }}
        onConfirm={(compartilhadoFamilia) => void handleConfirmSave(compartilhadoFamilia)}
      />

      <Toast
        message={toast?.message ?? ''}
        visible={toast !== null}
        variant={toast?.variant ?? 'success'}
        onDismiss={() => setToast(null)}
      />

      <PatientCopilotChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => send(input, 'text')}
        patientFirstName={firstName}
        disabled={isStreaming}
        audioState={audioInput.state}
        audioDurationLabel={audioInput.durationLabel}
        onStartRecording={() => {
          if (onBeforeSend && !onBeforeSend()) return;
          setAudioError(null);
          void audioInput.startRecording();
        }}
        onStopRecording={() => void audioInput.stopRecording()}
        onCancelRecording={audioInput.cancelRecording}
        audioError={audioError}
      />
    </div>
  );
}
