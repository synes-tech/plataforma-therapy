/**
 * Guardrails — Input/Output Filtering
 * Based on Agente 3 (IA Generativa) Section 7: Segurança Cognitiva
 * Based on Agente 6 (Segurança) Section 5.4: Motor de IA
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

  // Check for excessive special characters (possible control chars)
  const specialCharRatio = (message.replace(/[\w\s\u00C0-\u024F.,!?;:()'-]/g, '').length) / message.length;
  if (specialCharRatio > 0.3) {
    return { safe: false, reason: 'Excessive special characters detected' };
  }

  return { safe: true };
}

// ============================================================
// OUTPUT GUARDRAILS — Validate LLM response before returning
// ============================================================

const PROHIBITED_OUTPUT_PATTERNS = [
  /\b(diagn[óo]stico|diagnosticar)\b.*\b(confirm|definit|conclus)/i,
  /\b(prescre|medicar|medica[çc][ãa]o|remédio|dose|dosagem|ritalina|metilfenidato|risperidona)\b/i,
  /\b(curado|cura definitiva)\b/i,
  /\b(sempre será|nunca vai|impossível de)\b/i,
];

const REQUIRED_DISCLAIMER_TRIGGERS = [
  /\b(sugest[ãa]o|recomend|indica)/i,
];

export function validateOutput(response: string): { safe: boolean; reason?: string; modified?: string } {
  // Check for prohibited content
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

// ============================================================
// PII ANONYMIZATION — Mask before sending to LLM
// ============================================================

export function anonymizeForLLM(text: string): string {
  // CPF pattern: 000.000.000-00
  let anonymized = text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF_REMOVIDO]');
  // Phone: (00) 00000-0000
  anonymized = anonymized.replace(/\(\d{2}\)\s?\d{4,5}-?\d{4}/g, '[TELEFONE_REMOVIDO]');
  // Email
  anonymized = anonymized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REMOVIDO]');

  return anonymized;
}
