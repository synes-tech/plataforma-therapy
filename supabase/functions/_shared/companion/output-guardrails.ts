/**
 * Camada 3 — o que a Ivy não pode devolver, mesmo se o modelo escapar.
 *
 * Espelha a intenção do guardrail do copiloto clínico (sem medicação, sem
 * diagnóstico), mas o fallback é humano, não um parágrafo de planejamento de
 * sessão. O paciente não pode ler um texto escrito para o terapeuta.
 */

import { COPING_FALLBACK_TEXT } from './emergency-protocol.ts';

const INJECTION_PATTERNS = [
  /ignore\s+(todas?\s+)?(as\s+)?instru[çc][õo]es/i,
  /ignore\s+previous/i,
  /voc[êe]\s+agora\s+[eé]/i,
  /you\s+are\s+now/i,
  /aja\s+como\s+se/i,
  /forget\s+(everything|all)/i,
  /esque[çc]a\s+tudo/i,
  /\bsystem\s*:/i,
  /\[system\]/i,
  /jailbreak/i,
];

const PROHIBITED_OUTPUT = [
  /\b(diagn[óo]stico|diagnosticar)\b.*\b(confirm|definit|conclus)/i,
  /\b(prescre|medicar|medica[çc][ãa]o|remédio|dose|dosagem|ritalina|metilfenidato|risperidona)\b/i,
  /\b(curado|cura definitiva)\b/i,
  /\b(sou (sua |seu )?(psic[oó]loga?|terapeuta|psiquiatra|m[eé]dica?))\b/i,
  /\beu recomendo clinicamente\b/i,
];

const SANITIZE: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b(ritalina|metilfenidato|risperidona|sertralina|fluoxetina|clonazepam)\b/gi,
    replacement: 'o que o médico já prescreveu',
  },
  {
    pattern: /\b(prescrev[oa]|prescrever|medicar|alterar a dose)\b/gi,
    replacement: 'conversar com o médico sobre o tratamento',
  },
  {
    pattern: /\b(sou (sua |seu )?(psic[oó]loga?|terapeuta|psiquiatra))\b/gi,
    replacement: 'sou a Ivy, uma acompanhante de apoio',
  },
  {
    pattern: /\beu recomendo clinicamente\b/gi,
    replacement: 'vale levar isso para a sessão',
  },
];

function stripLegacyAssistantName(text: string): string {
  return text
    .replace(/\bo Thery\b/gi, 'a Ivy')
    .replace(/\bdo Thery\b/gi, 'da Ivy')
    .replace(/\bno Thery\b/gi, 'na Ivy')
    .replace(/\bao Thery\b/gi, 'à Ivy')
    .replace(/\bThery\b/g, 'Ivy');
}

export function detectPromptInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(message));
}

export function enforceTheryOutput(response: string): {
  answer: string;
  sanitized: boolean;
  usedFallback: boolean;
} {
  const text = stripLegacyAssistantName(response.trim());
  if (!text) {
    return { answer: COPING_FALLBACK_TEXT, sanitized: true, usedFallback: true };
  }

  const prohibited = PROHIBITED_OUTPUT.some((re) => re.test(text));
  if (!prohibited) {
    const renamed = text !== response.trim();
    return { answer: text, sanitized: renamed, usedFallback: false };
  }

  let next = text;
  for (const { pattern, replacement } of SANITIZE) {
    next = next.replace(pattern, replacement);
  }
  next = stripLegacyAssistantName(next);

  if (PROHIBITED_OUTPUT.some((re) => re.test(next))) {
    return { answer: COPING_FALLBACK_TEXT, sanitized: true, usedFallback: true };
  }

  return { answer: next, sanitized: true, usedFallback: false };
}
