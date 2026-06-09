import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { callFunction } from '@shared/lib/api';

export interface PlanItemInput {
  title: string;
  content: string;
}

interface ChatAreaProps {
  patientId: string;
  patientName: string;
  onSaveToPlan: (item: PlanItemInput) => void;
}

interface SourceRef {
  content_preview: string;
  document_type: string;
  created_at: string;
  similarity: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRef[];
  guardrail_triggered?: boolean;
}

interface CopilotResponse {
  answer: string;
  sources: SourceRef[];
  guardrail_triggered: boolean;
  tokens_used: number;
  latency_ms: number;
}

const QUICK_PROMPTS = [
  'Sugira 3 atividades sensoriais para hoje',
  'Resuma as últimas 3 sessões',
  'Há padrões de crise para observar?',
  'Combinados para regulação emocional',
];

const DOC_LABELS: Record<string, string> = {
  session_note: 'Evolução',
  diary_entry: 'Diário',
  patient_profile: 'Perfil',
};

function SparkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z" />
    </svg>
  );
}

export function ChatArea({ patientId, patientName, onSaveToPlan }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstName = patientName.split(' ')[0] ?? patientName;

  // Reset conversation ao trocar de paciente (isolamento de contexto)
  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [patientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const conversationHistory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      return callFunction<CopilotResponse>('query-copilot', {
        patient_id: patientId,
        message: userMessage,
        conversation_history: conversationHistory,
      });
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          guardrail_triggered: data.guardrail_triggered,
        },
      ]);
    },
    onError: (err: Error) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Erro ao processar: ${err.message}` },
      ]);
    },
  });

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed }]);
    mutation.mutate(trimmed);
    setInput('');
    inputRef.current?.focus();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Mensagens (rolagem independente) */}
      <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <SparkIcon className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-xl text-charcoal md:text-2xl">
              Como vamos planejar a sessão de {firstName} hoje?
            </h2>
            <p className="mt-2 max-w-md text-sm text-charcoal-muted">
              O contexto está travado 100% no histórico de {firstName}. Use um atalho ou escreva sua pergunta.
            </p>

            {/* Prompts rápidos — grade no desktop, carrossel horizontal no mobile */}
            <div className="mt-6 flex w-full snap-x gap-2 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-2 md:overflow-visible">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="shrink-0 snap-start rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-sm text-charcoal shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50/40 md:shrink"
                >
                  <SparkIcon className="mb-1.5 h-3.5 w-3.5 text-indigo-400" />
                  <span className="block max-w-[14rem] md:max-w-none">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSaveToPlan={onSaveToPlan} />
            ))}
            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-indigo-500">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '300ms' }} />
                </span>
                Analisando o contexto de {firstName}...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input — grudado na base */}
      <div className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-[#F8FAF9]/80 px-4 py-3 backdrop-blur-sm lg:px-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-md">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Pergunte sobre ${firstName}...`}
              rows={1}
              maxLength={2000}
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:outline-none"
              aria-label="Mensagem para o copiloto"
            />
            <button
              type="submit"
              disabled={!input.trim() || mutation.isPending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              <SparkIcon />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-charcoal-muted/60">
            O copiloto auxilia o planejamento. Não diagnostica nem sugere medicações — valide as sugestões.
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSaveToPlan,
}: {
  message: Message;
  onSaveToPlan: (item: PlanItemInput) => void;
}) {
  const [saved, setSaved] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-100 px-4 py-2.5 text-sm text-charcoal">
          {message.content}
        </div>
      </div>
    );
  }

  function handleSave() {
    const firstLine = message.content.split('\n').find((l) => l.trim().length > 0) ?? 'Sugestão da IA';
    onSaveToPlan({ title: firstLine.replace(/^[#*\-\d.\s]+/, '').slice(0, 80), content: message.content });
    setSaved(true);
  }

  return (
    <div className="flex justify-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <SparkIcon className="h-3.5 w-3.5" />
      </div>
      <div
        className={`max-w-[85%] rounded-2xl rounded-tl-md border bg-white px-4 py-3 shadow-sm ${
          message.guardrail_triggered ? 'border-amber-200' : 'border-indigo-100'
        }`}
      >
        <p
          className="whitespace-pre-wrap text-sm text-charcoal"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [] }) }}
        />

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="text-[10px] font-medium text-charcoal-muted">Fontes:</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {message.sources.map((src, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-charcoal-muted">
                  {DOC_LABELS[src.document_type] ?? src.document_type}
                  <span className="text-slate-300">·</span>
                  {src.created_at.split('T')[0]}
                </span>
              ))}
            </div>
          </div>
        )}

        {message.guardrail_triggered && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600">
            <span>Filtro de segurança ativado</span>
          </div>
        )}

        {!message.guardrail_triggered && (
          <button
            onClick={handleSave}
            disabled={saved}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-60"
          >
            {saved ? (
              <>✓ Salvo no plano</>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Salvar no plano
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
