/**
 * Guardrails — Input/Output Filtering
 * Based on Agente 3 (IA Generativa) Section 7: Segurança Cognitiva
 * Based on Agente 6 (Segurança) Section 5.4: Motor de IA
 *
 * Política UX: preferir prevenção no prompt (entrada) + sanitização silenciosa
 * na saída. Nunca forçar "apagar e regenerar" no stream do usuário.
 */

// ============================================================
// INPUT GUARDRAILS — Filter before sending to LLM
// ============================================================

const INJECTION_PATTERNS = [
  /ignore\s+(todas?\s+)?(as\s+)?instru[çc][õo]es/i,
  /ignore\s+previous/i,
  /voc[êe]\s+agora\s+[eé]/i,
  /you\s+are\s+now/i,
  /aja\s+como\s+se/i,
  /act\s+as\s+if/i,
  /forget\s+(everything|all)/i,
  /esque[çc]a\s+tudo/i,
  /\bsystem\s*:/i,
  /\[system\]/i,
  /\bDAN\b/i,
  /jailbreak/i,
];

export function validateInput(message: string): { safe: boolean; reason?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return { safe: false, reason: 'Prompt injection pattern detected' };
    }
  }

  const specialCharRatio =
    message.replace(/[\w\s\u00C0-\u024F.,!?;:()'-]/g, '').length / Math.max(message.length, 1);
  if (specialCharRatio > 0.3) {
    return { safe: false, reason: 'Excessive special characters detected' };
  }

  return { safe: true };
}

// ============================================================
// OUTPUT GUARDRAILS — Validate / sanitize LLM response
// ============================================================

const PROHIBITED_OUTPUT_PATTERNS = [
  /\b(diagn[óo]stico|diagnosticar)\b.*\b(confirm|definit|conclus)/i,
  /\b(prescre|medicar|medica[çc][ãa]o|remédio|dose|dosagem|ritalina|metilfenidato|risperidona)\b/i,
  /\b(curado|cura definitiva)\b/i,
  /sempre será|nunca vai|impossível de/i,
];

/** Substituições silenciosas — evita regenerar a resposta inteira. */
const SANITIZE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b(ritalina|metilfenidato|risperidona|aripiprazol|sertralina|fluoxetina|clonazepam)\b/gi,
    replacement: 'acompanhamento medicamentoso conforme prescrição médica',
  },
  {
    pattern: /\b(prescrev[oa]|prescrever|medicar|alterar a dose|aumentar a dose|reduzir a dose)\b/gi,
    replacement: 'discutir com o médico responsável o acompanhamento clínico',
  },
  {
    pattern: /\b(cura definitiva|curado definitivamente)\b/gi,
    replacement: 'evolução positiva no acompanhamento',
  },
  {
    pattern: /\b(diagn[óo]stico (confirmado|definitivo|conclusivo))\b/gi,
    replacement: 'hipótese clínica a ser avaliada pelo profissional responsável',
  },
  {
    pattern: /sempre será|nunca vai|impossível de/gi,
    replacement: 'pode apresentar tendência a',
  },
];

const SAFE_FALLBACK_ANSWER =
  'Com base no histórico clínico disponível, observo padrões que merecem atenção no planejamento da sessão. Sugiro focar em atividades de regulação emocional e monitoramento comportamental, sempre fundamentado nos registros deste paciente. Posso detalhar estratégias práticas se reformular a pergunta com foco em manejo terapêutico.';

export function validateOutput(response: string): { safe: boolean; reason?: string } {
  for (const pattern of PROHIBITED_OUTPUT_PATTERNS) {
    if (pattern.test(response)) {
      return {
        safe: false,
        reason: 'Response contains prohibited clinical content (medication/diagnosis)',
      };
    }
  }

  return { safe: true };
}

/** Sanitiza termos proibidos sem regenerar a resposta. */
export function sanitizeOutput(response: string): string {
  let next = response;
  for (const { pattern, replacement } of SANITIZE_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

/**
 * Garante uma única resposta entregável:
 * 1) se segura → mantém
 * 2) se insegura → sanitiza
 * 3) se ainda insegura → fallback seguro (sem retry de LLM)
 */
export function enforceSafeOutput(response: string): {
  answer: string;
  sanitized: boolean;
  usedFallback: boolean;
  reason?: string;
} {
  const initial = validateOutput(response);
  if (initial.safe) {
    return { answer: response, sanitized: false, usedFallback: false };
  }

  const sanitized = sanitizeOutput(response);
  const afterSanitize = validateOutput(sanitized);
  if (afterSanitize.safe) {
    return {
      answer: sanitized,
      sanitized: true,
      usedFallback: false,
      reason: initial.reason,
    };
  }

  return {
    answer: SAFE_FALLBACK_ANSWER,
    sanitized: true,
    usedFallback: true,
    reason: initial.reason,
  };
}

// ============================================================
// PII ANONYMIZATION — Mask before sending to LLM
// ============================================================

export function anonymizeForLLM(text: string): string {
  let anonymized = text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF_REMOVIDO]');
  anonymized = anonymized.replace(/\(\d{2}\)\s?\d{4,5}-?\d{4}/g, '[TELEFONE_REMOVIDO]');
  anonymized = anonymized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REMOVIDO]');
  return anonymized;
}
