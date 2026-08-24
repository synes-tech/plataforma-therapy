import { useState } from 'react';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { ChatInputArea } from './chat/ChatInputArea';
import { MessageList } from './chat/MessageList';
import { useCompanionAudio } from './chat/useCompanionAudio';
import { usePatientChat } from './chat/usePatientChat';

interface PatientChatContainerProps {
  patientId: string;
  firstName: string;
}

export function PatientChatContainer({ patientId, firstName }: PatientChatContainerProps) {
  const [draft, setDraft] = useState('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const { messages, isLoadingHistory, historyError, sendError, isSending, send, reloadHistory } =
    usePatientChat(patientId);

  const audio = useCompanionAudio({
    patientId,
    disabled: isSending,
    onTranscribed: (text) => {
      setAudioError(null);
      void send(text, 'audio');
    },
    onError: setAudioError,
  });

  function handleSubmit() {
    const text = draft;
    setDraft('');
    void send(text, 'text');
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-[#F8FAF9]"
      aria-label="Conversa com a Ivy"
    >
      <header className="shrink-0 bg-[#F8FAF9]/90 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md lg:px-8 lg:pt-5">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <TheryAvatar pose="profile" size="sm" decorative />
          <div className="min-w-0">
            <p className="font-serif text-xl leading-none text-charcoal">Ivy</p>
            <p className="mt-0.5 text-[11px] text-charcoal-muted">
              Acompanhante · em emergência, 188 ou 192
            </p>
          </div>
        </div>
      </header>

      {historyError ? (
        <div className="mx-auto mt-3 w-full max-w-2xl px-5 text-sm text-charcoal-muted">
          {historyError}{' '}
          <button type="button" onClick={() => void reloadHistory()} className="font-medium text-primary">
            Tentar de novo
          </button>
        </div>
      ) : null}

      <MessageList messages={messages} firstName={firstName} isLoading={isLoadingHistory} />

      {sendError ? (
        <p className="px-4 pb-1 text-center text-xs text-error" role="status">
          {sendError}
        </p>
      ) : null}

      <ChatInputArea
        value={draft}
        onChange={(next) => {
          setDraft(next);
          if (audioError) setAudioError(null);
        }}
        onSubmit={handleSubmit}
        disabled={isSending || isLoadingHistory}
        audioState={audio.state}
        audioDurationLabel={audio.durationLabel}
        waveHeights={audio.waveHeights}
        audioError={audioError}
        onHoldStart={() => {
          setAudioError(null);
          void audio.startHold();
        }}
        onHoldEnd={() => audio.stopHold(true)}
        onHoldCancel={audio.cancelHold}
      />
    </section>
  );
}
