import { useEffect, useRef, useState, type FormEvent } from 'react';
import DOMPurify from 'dompurify';
import { callFunctionStream, type CopilotStreamMeta } from '@shared/lib/api';

export interface PlanItemInput {
  title: string;
  content: string;
}

interface ChatAreaProps {
  patientId: string;
  patientName: string;
  onSaveToPlan: (item: PlanItemInput) => void;
  onBeforeSend?: () => boolean;
  onPaymentRequired?: () => void;
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
  answer_incomplete?: boolean;
  streaming?: boolean;
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

export function ChatArea({ patientId, patientName, onSaveToPlan, onBeforeSend, onPaymentRequired }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const firstName = patientName.split(' ')[0] ?? patientName;

  // Reset conversation ao trocar de paciente (isolamento de contexto)
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput('');
    setIsStreaming(false);
  }, [patientId]);

  // Aborta stream ao desmontar (ex: fechar copiloto)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function streamReply(userMessage: string, assistantId: string) {
    const conversationHistory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
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
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ]);
    streamReply(trimmed, assistantId);
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
              disabled={!input.trim() || isStreaming}
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
        {message.streaming && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-middle" aria-hidden />
        )}

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

        {message.answer_incomplete && !message.guardrail_triggered && (
          <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-700">
            A resposta pode ter sido cortada. Peça para repetir ou continuar de onde parou.
          </div>
        )}

        {!message.guardrail_triggered && !message.streaming && (
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
