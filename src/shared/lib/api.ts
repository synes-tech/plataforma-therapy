import { supabase } from './supabase';
import type { ApiResponse } from '@shared/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Error translations — maps backend error codes/details to user-friendly PT-BR messages.
 */
const ERROR_TRANSLATIONS: Record<string, string> = {
  UNAUTHORIZED: 'Sessão expirada. Faça login novamente.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  NOT_FOUND: 'Recurso não encontrado.',
  QUOTA_EXCEEDED: 'Limite do plano atingido. Entre em contato com o administrador.',
  CONFLICT: 'Este registro já existe.',
  INVITE_NOT_FOUND: 'Código de convite inválido.',
  INVITE_CONSUMED: 'Este convite já foi utilizado.',
  INVITE_EXPIRED: 'Este convite expirou. Solicite um novo ao terapeuta.',
  FAMILY_QUOTA_EXCEEDED: 'Limite de familiares para este paciente já atingido.',
  DUPLICATE_ENTRY: 'Já existe um registro para esta data.',
  LLM_ERROR: 'O serviço de IA está indisponível. Tente novamente em instantes.',
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos abaixo.',
};

/**
 * Translates Zod field errors into PT-BR messages
 */
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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: method !== 'GET' ? JSON.stringify(payload) : undefined,
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    const code = data.error?.code ?? 'UNKNOWN';
    const details = data.error?.details as Record<string, string[]> | undefined;

    // If it's a validation error with field details, translate them
    if (code === 'VALIDATION_ERROR' && details && typeof details === 'object') {
      throw new Error(translateFieldErrors(details));
    }

    // Use translated message or fallback to backend message
    const message = ERROR_TRANSLATIONS[code] ?? data.error?.message ?? 'Erro inesperado. Tente novamente.';
    throw new Error(message);
  }

  return data.data as T;
}
