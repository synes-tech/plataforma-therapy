import { AuthSessionError, clearAuthSession, resolveAccessToken } from './auth-session';
import type { ApiResponse } from '@shared/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
/** API GCP (Cloud Run) — obrigatória para sessão Firebase/Google enquanto Supabase não tem auth.ts em 100% das functions */
const GCP_API_URL = (import.meta.env.VITE_GCP_API_URL as string | undefined)?.replace(/\/$/, '');

function edgeFunctionUrl(functionName: string, options?: { stream?: boolean }): string {
  // Plano GCP: sempre Cloud Run quando VITE_GCP_API_URL está definido
  if (GCP_API_URL) {
    return `${GCP_API_URL}/functions/v1/${functionName}`;
  }

  const useDevProxy = import.meta.env.DEV && !options?.stream;
  const base = useDevProxy ? '/api/functions' : `${SUPABASE_URL}/functions/v1`;
  return `${base}/${functionName}`;
}

/**
 * Error translations — maps backend error codes/details to user-friendly PT-BR messages.
 */
const ERROR_TRANSLATIONS: Record<string, string> = {
  UNAUTHORIZED: 'Sessão expirada. Faça login novamente.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  NOT_FOUND: 'Recurso não encontrado.',
  QUOTA_EXCEEDED: 'Limite do plano atingido. Faça upgrade para continuar.',
  PAYMENT_REQUIRED: 'Desbloqueie o poder total da Unithery. Inicie seus 14 dias grátis agora.',
  ALREADY_SUBSCRIBED: 'Assinatura já está ativa para este espaço.',
  CHECKOUT_NOT_ALLOWED: 'Checkout não disponível para esta conta.',
  PLAN_NOT_ALLOWED: 'Plano incompatível com seu perfil.',
  CONFLICT: 'Este registro já existe.',
  INVITE_NOT_FOUND: 'Código de convite inválido.',
  INVITE_CONSUMED: 'Este convite já foi utilizado.',
  INVITE_EXPIRED: 'Este convite expirou. Solicite um novo ao terapeuta.',
  INVITE_REVOKED: 'Este convite foi revogado.',
  FAMILY_QUOTA_EXCEEDED: 'Limite de familiares para este paciente já atingido.',
  DUPLICATE_ENTRY: 'Já existe um registro para esta data.',
  LLM_ERROR: 'O serviço de IA está indisponível. Tente novamente em instantes.',
  NO_CLINICAL_DATA: 'Este paciente ainda não possui sessões ou registros clínicos suficientes para gerar um resumo.',
  CONTEXT_FETCH_FAILED:
    'Não foi possível montar o contexto clínico. Verifique se as migrações do banco foram aplicadas ou tente novamente.',
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos abaixo.',
  REACTIVATION_COOLDOWN: 'Reativação temporariamente bloqueada por segurança.',
  COMPANION_UNAVAILABLE: 'O Acompanhante está disponível para pacientes adultos com o plano de apoio ativo.',
  BILLING_EXEMPT: 'Conta administrativa — sem assinatura ou cobrança para cancelar.',
  NOTHING_TO_CANCEL: 'Não há assinatura ativa para cancelar.',
  INTERNAL_ERROR: 'Erro interno no servidor. Tente novamente em instantes.',
  STRIPE_CHECKOUT_FAILED: 'Não foi possível abrir o checkout do Stripe. Tente novamente.',
  STRIPE_PRICE_NOT_CONFIGURED: 'Este plano ainda não está disponível para pagamento neste ambiente.',
  STRIPE_CUSTOMER_INVALID: 'Não foi possível validar o cadastro de cobrança. Tente novamente.',
};

/**
 * Translates Zod field errors into PT-BR messages
 */
function makeFunctionError(code: string, message: string, details?: unknown): Error & {
  code?: string;
  retryAfterSeconds?: number;
} {
  const err = new Error(message) as Error & { code?: string; retryAfterSeconds?: number };
  err.code = code;
  if (details && typeof details === 'object' && details !== null && 'retry_after_seconds' in details) {
    const n = Number((details as { retry_after_seconds?: unknown }).retry_after_seconds);
    if (Number.isFinite(n) && n > 0) {
      err.retryAfterSeconds = Math.ceil(n);
    }
  }
  return err;
}

function translateFieldErrors(details: Record<string, string[]>): string {
  const translations: string[] = [];

  for (const [field, errors] of Object.entries(details)) {
    for (const error of errors) {
      const translated = translateFieldError(field, error);
      if (translated) translations.push(translated);
    }
  }

  return translations.length > 0 ? translations.join(' ') : 'Verifique os campos e tente novamente.';
}

function translateFieldError(field: string, error: string): string {
  // Password length
  if (field === 'password' && error.includes('at least')) {
    const match = error.match(/at least (\d+)/);
    const min = match ? match[1] : '6';
    return `A senha deve ter no mínimo ${min} caracteres.`;
  }

  // String min length
  if (error.includes('at least') && error.includes('character')) {
    const match = error.match(/at least (\d+)/);
    const min = match ? match[1] : '2';
    const fieldName = translateFieldName(field);
    return `${fieldName} deve ter no mínimo ${min} caracteres.`;
  }

  // Required
  if (error === 'Required') {
    const fieldName = translateFieldName(field);
    return `${fieldName} é obrigatório.`;
  }

  // Email
  if (error.includes('email') || error.includes('Invalid email')) {
    return 'Informe um email válido.';
  }

  // UUID
  if (error.includes('uuid') || error.includes('UUID')) {
    return `ID inválido para ${translateFieldName(field)}.`;
  }

  // Generic min/max
  if (error.includes('must be')) {
    return `${translateFieldName(field)}: ${error}`;
  }

  return `${translateFieldName(field)}: ${error}`;
}

function translateFieldName(field: string): string {
  const names: Record<string, string> = {
    name: 'Nome',
    email: 'Email',
    password: 'Senha',
    admin_password: 'Senha',
    admin_name: 'Nome do administrador',
    admin_email: 'Email do administrador',
    clinic_name: 'Nome da clínica',
    clinic_email: 'Email da clínica',
    specialty: 'Especialidade',
    crp: 'CRP',
    patient_id: 'Paciente',
    birth_date: 'Data de nascimento',
    diagnoses: 'Diagnósticos',
    mood_score: 'Humor',
    sleep_quality: 'Qualidade do sono',
    message: 'Mensagem',
    code: 'Código',
  };
  return names[field] ?? field;
}

/**
 * Calls a Supabase Edge Function with auth token attached.
 * Throws Error with user-friendly PT-BR message on failure.
 */
export async function callFunction<T>(
  functionName: string,
  payload: Record<string, unknown>,
  method: 'POST' | 'GET' = 'POST',
): Promise<T> {
  let accessToken: string;
  try {
    accessToken = await resolveAccessToken();
  } catch (err) {
    if (err instanceof AuthSessionError) {
      await clearAuthSession();
    }
    throw err;
  }

  const response = await fetch(edgeFunctionUrl(functionName), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: method !== 'GET' ? JSON.stringify(payload) : undefined,
  }).catch(() => {
    throw new Error(
      `Não foi possível conectar ao serviço "${functionName}". Verifique sua conexão ou se a função está publicada no Supabase.`,
    );
  });

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch {
    if (response.status === 401) {
      await clearAuthSession();
      throw new AuthSessionError();
    }
    throw new Error(
      response.ok
        ? `Resposta inválida do serviço "${functionName}".`
        : `Erro ${response.status} no serviço "${functionName}". Verifique se a função está publicada e configurada.`,
    );
  }

  if (!response.ok && data.success !== false) {
    if (response.status === 401) {
      await clearAuthSession();
      throw new AuthSessionError();
    }
    throw new Error(`Erro ${response.status} no serviço "${functionName}".`);
  }

  if (!data.success) {
    const code = data.error?.code ?? 'UNKNOWN';
    const details = data.error?.details as Record<string, string[]> | undefined;

    if (code === 'UNAUTHORIZED') {
      await clearAuthSession();
      throw new AuthSessionError();
    }

    // If it's a validation error with field details, translate them
    if (code === 'VALIDATION_ERROR' && details && typeof details === 'object') {
      throw new Error(translateFieldErrors(details));
    }

    // Use translated message or fallback to backend message
    const message =
      (code === 'QUOTA_EXCEEDED' ||
        code === 'REACTIVATION_COOLDOWN' ||
        code === 'BACKUP_QUOTA_EXCEEDED' ||
        code === 'RATE_LIMITED') &&
      data.error?.message
        ? data.error.message
        : ERROR_TRANSLATIONS[code] ?? data.error?.message ?? 'Erro inesperado. Tente novamente.';
    throw makeFunctionError(code, message, data.error?.details);
  }

  return data.data as T;
}

export interface PublicFunctionOptions {
  signal?: AbortSignal;
}

/**
 * Chama Edge Function pública (sem JWT) — onboarding familiar, preview de convite, etc.
 */
export async function callPublicFunction<T>(
  functionName: string,
  payload: Record<string, unknown>,
  options: PublicFunctionOptions = {},
): Promise<T> {
  const response = await fetch(edgeFunctionUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  }).catch((err: unknown) => {
    if (options.signal?.aborted) {
      throw err;
    }
    throw new Error(
      `Não foi possível conectar ao serviço "${functionName}". Verifique sua conexão ou se a função está publicada no Supabase.`,
    );
  });

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? `Resposta inválida do serviço "${functionName}".`
        : `Erro ${response.status} no serviço "${functionName}". Verifique se a função está publicada e configurada.`,
    );
  }

  if (!response.ok && data.success !== false) {
    throw new Error(`Erro ${response.status} no serviço "${functionName}".`);
  }

  if (!data.success) {
    const code = data.error?.code ?? 'UNKNOWN';
    const details = data.error?.details as Record<string, string[]> | undefined;

    if (code === 'VALIDATION_ERROR' && details && typeof details === 'object') {
      throw new Error(translateFieldErrors(details));
    }

    const message =
      code === 'RATE_LIMITED' && data.error?.message
        ? data.error.message
        : ERROR_TRANSLATIONS[code] ?? data.error?.message ?? 'Erro inesperado. Tente novamente.';
    throw makeFunctionError(code, message, data.error?.details);
  }

  return data.data as T;
}

export interface CopilotStreamMeta {
  answer: string;
  sources: Array<{
    content_preview: string;
    document_type: string;
    created_at: string;
    similarity: number;
  }>;
  guardrail_triggered: boolean;
  answer_incomplete?: boolean;
  tokens_used: number;
  latency_ms: number;
  /** Campos do Acompanhante B2C — ausentes no copiloto do terapeuta. */
  risk_level?: string;
  emergency_protocol_shown?: boolean;
  thread_id?: string;
  message_id?: string;
  detector?: string;
}

function parseNdjsonEvents(
  line: string,
  handlers: {
    onChunk: (text: string) => void;
    onDone: (meta: CopilotStreamMeta) => void;
    onError: (error: Error) => void;
    onRetry?: () => void;
  },
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return false;
  }

  if (event.type === 'chunk' && typeof event.text === 'string') {
    handlers.onChunk(event.text);
    return false;
  }

  if (event.type === 'retry') {
    handlers.onRetry?.();
    return false;
  }

  if (event.type === 'done') {
    handlers.onDone({
      answer: String(event.answer ?? ''),
      sources: (event.sources as CopilotStreamMeta['sources']) ?? [],
      guardrail_triggered: Boolean(event.guardrail_triggered),
      answer_incomplete: event.answer_incomplete as boolean | undefined,
      tokens_used: Number(event.tokens_used ?? 0),
      latency_ms: Number(event.latency_ms ?? 0),
      risk_level: typeof event.risk_level === 'string' ? event.risk_level : undefined,
      emergency_protocol_shown:
        typeof event.emergency_protocol_shown === 'boolean'
          ? event.emergency_protocol_shown
          : undefined,
      thread_id: typeof event.thread_id === 'string' ? event.thread_id : undefined,
      message_id: typeof event.message_id === 'string' ? event.message_id : undefined,
      detector: typeof event.detector === 'string' ? event.detector : undefined,
    });
    return true;
  }

  if (event.type === 'error') {
    const code = String(event.code ?? 'LLM_ERROR');
    handlers.onError(
      makeFunctionError(
        code,
        code === 'RATE_LIMITED' && event.message
          ? String(event.message)
          : ERROR_TRANSLATIONS[code] ?? String(event.message ?? 'Erro no stream.'),
        event.details,
      ),
    );
    return true;
  }

  return false;
}

/**
 * Chama Edge Function com resposta NDJSON em stream (copiloto).
 * AbortSignal cancela o fetch e interrompe a leitura do stream.
 */
export async function callFunctionStream(
  functionName: string,
  payload: Record<string, unknown>,
  handlers: {
    onChunk: (text: string) => void;
    onDone: (meta: CopilotStreamMeta) => void;
    onError: (error: Error) => void;
    onRetry?: () => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  let accessToken: string;
  try {
    accessToken = await resolveAccessToken();
  } catch (err) {
    if (err instanceof AuthSessionError) {
      await clearAuthSession();
    }
    handlers.onError(err instanceof Error ? err : new AuthSessionError());
    return;
  }

  let response: Response;
  try {
    response = await fetch(edgeFunctionUrl(functionName, { stream: true }), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        Accept: 'application/x-ndjson',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    handlers.onError(err instanceof Error ? err : new Error('Falha na conexão com o copiloto.'));
    return;
  }

  if (!response.ok) {
    try {
      const data = await response.json() as ApiResponse<unknown>;
      const code = data.error?.code ?? 'UNKNOWN';
      if (code === 'UNAUTHORIZED' || response.status === 401) {
        await clearAuthSession();
        handlers.onError(new AuthSessionError());
        return;
      }
      const message =
        code === 'RATE_LIMITED' && data.error?.message
          ? data.error.message
          : ERROR_TRANSLATIONS[code] ?? data.error?.message ?? 'Erro inesperado. Tente novamente.';
      handlers.onError(makeFunctionError(code, message, data.error?.details));
    } catch {
      if (response.status === 401) {
        await clearAuthSession();
        handlers.onError(new AuthSessionError());
        return;
      }
      handlers.onError(new Error(`Erro HTTP ${response.status}`));
    }
    return;
  }

  if (!response.body) {
    handlers.onError(new Error('Resposta sem stream.'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamFinished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (parseNdjsonEvents(line, handlers)) {
          streamFinished = true;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (parseNdjsonEvents(line, handlers)) {
          streamFinished = true;
        }
      }
    }

    if (!streamFinished && !signal?.aborted) {
      handlers.onError(new Error('A resposta do copiloto foi interrompida. Tente novamente.'));
    }
  } catch (err) {
    if (!signal?.aborted) {
      handlers.onError(err instanceof Error ? err : new Error('Stream interrompido.'));
    }
  } finally {
    reader.releaseLock();
  }
}
