import { useStickyChatScroll } from '@containers/patient/copilot/useStickyChatScroll';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { EmergencyActionCard } from './EmergencyActionCard';
import { isEmergencyMessage } from './patient-chat.utils';
import type { PatientChatMessage } from './patient-chat.types';

interface MessageListProps {
  messages: PatientChatMessage[];
  firstName: string;
  isLoading?: boolean;
}

function CompanionTypingDots() {
  return (
    <div className="flex items-center gap-2 py-0.5" aria-label="Ivy está digitando">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: '140ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: '280ms' }} />
      </span>
      <span className="text-xs text-ai">digitando</span>
    </div>
  );
}

function EmptyConversation({ firstName }: { firstName: string }) {
  const name = firstName.trim() || 'você';
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 text-center">
      <TheryAvatar pose="profile" size="md" decorative />
      <p className="mt-6 font-serif text-3xl tracking-tight text-charcoal">Oi, {name}.</p>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-charcoal-muted">
        Escreva ou segure o microfone. Estou aqui entre as sessões — sem julgamento.
      </p>
    </div>
  );
}

function ChatBubble({ message }: { message: PatientChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[min(34rem,88%)] rounded-3xl bg-white px-4 py-3 text-[15px] leading-relaxed text-charcoal shadow-sm">
          {message.inputSource === 'audio' ? (
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-charcoal-muted">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
              </svg>
              Mensagem por áudio
            </p>
          ) : null}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  const emergency = isEmergencyMessage({
    risk_level: message.riskLevel,
    emergency_protocol_shown: message.emergencyProtocolShown,
    content: message.content,
  });

  return (
    <div className="flex justify-start gap-3">
      <TheryAvatar pose="profile" size="xs" decorative className="mt-1" />
      <div
        className={`min-w-0 max-w-[min(40rem,88%)] rounded-3xl rounded-bl-md bg-white px-4 py-3 text-[15px] leading-relaxed text-charcoal shadow-sm ${
          emergency ? 'ring-2 ring-alert/25' : 'border border-slate-100'
        }`}
      >
        {message.streaming && !message.content ? <CompanionTypingDots /> : null}
        {message.content ? (
          <AiMarkdownContent content={message.content} variant="light" />
        ) : null}
        {message.streaming && message.content ? (
          <span
            className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-sm bg-primary align-middle"
            aria-hidden
          />
        ) : null}
        {emergency ? <EmergencyActionCard /> : null}
      </div>
    </div>
  );
}

export function MessageList({ messages, firstName, isLoading = false }: MessageListProps) {
  const scrollKey = messages.map((item) => `${item.id}:${item.content.length}:${item.streaming ? 1 : 0}`).join('|');
  const { containerRef, onScroll } = useStickyChatScroll(scrollKey);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy>
        <CompanionTypingDots />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 ? (
        <EmptyConversation firstName={firstName} />
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}
