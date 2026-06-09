import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import DOMPurify from 'dompurify';

interface CopilotChatProps {
  patientId: string;
  patientName: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRef[];
  guardrail_triggered?: boolean;
  timestamp: Date;
}

interface SourceRef {
  content_preview: string;
  document_type: string;
  created_at: string;
  similarity: number;
}

interface CopilotResponse {
  answer: string;
  sources: SourceRef[];
  guardrail_triggered: boolean;
  tokens_used: number;
  latency_ms: number;
}

export function CopilotChat({ patientId, patientName }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const conversationHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      return callFunction<CopilotResponse>('query-copilot', {
        patient_id: patientId,
        message: userMessage,
        conversation_history: conversationHistory,
      });
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        guardrail_triggered: data.guardrail_triggered,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (err: Error) => {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Erro ao processar: ${err.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || mutation.isPending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    mutation.mutate(input.trim());
    setInput('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-surface-border bg-surface-light lg:h-[700px]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ai/20">
          <span className="text-sm">🤖</span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-text">Copiloto IA</h3>
          <p className="text-[10px] text-text-muted">Contexto: {patientName}</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="ml-auto text-xs text-text-muted hover:text-text"
            aria-label="Limpar conversa"
          >
            Limpar
          </button>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-ai-light">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai" style={{ animationDelay: '300ms' }} />
                </span>
                Analisando contexto...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-surface-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte ao copiloto sobre este paciente..."
            rows={1}
            maxLength={2000}
            className="max-h-24 flex-1 resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-ai focus:outline-none focus:ring-1 focus:ring-ai"
            aria-label="Mensagem para o copiloto"
          />
          <button
            type="submit"
            disabled={!input.trim() || mutation.isPending}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ai text-white transition-colors hover:bg-ai-dark disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ai/10">
        <span className="text-xl">💡</span>
      </div>
      <p className="text-sm font-medium text-text">Copiloto pronto</p>
      <p className="mt-1 max-w-xs text-xs text-text-muted">
        Pergunte sobre o histórico do paciente, peça sugestões de atividades ou análise de padrões comportamentais.
      </p>
      <div className="mt-4 space-y-2">
        <SuggestionChip text="Sugira atividades para a sessão de hoje" />
        <SuggestionChip text="Resuma a evolução das últimas 4 semanas" />
        <SuggestionChip text="Há padrões de crise que devo observar?" />
      </div>
    </div>
  );
}

function SuggestionChip({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-surface-border px-3 py-2 text-xs text-text-muted">
      {text}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary/20 text-text'
            : message.guardrail_triggered
              ? 'border border-accent/30 bg-accent/5 text-text'
              : 'bg-surface-card text-text'
        }`}
      >
        {/* Message content — sanitized */}
        <p
          className="whitespace-pre-wrap text-sm"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [] }),
          }}
        />

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-surface-border pt-2">
            <p className="text-[10px] font-medium text-text-muted">Fontes utilizadas:</p>
            <div className="mt-1 space-y-1">
              {message.sources.map((src, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-text-muted">
                  <span className="rounded bg-surface-light px-1.5 py-0.5">
                    {src.document_type}
                  </span>
                  <span>{src.created_at.split('T')[0]}</span>
                  <span className="text-ai-light">{Math.round(src.similarity * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guardrail badge */}
        {message.guardrail_triggered && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-accent">
            <span>⚠️</span>
            <span>Filtro de segurança ativado</span>
          </div>
        )}
      </div>
    </div>
  );
}
