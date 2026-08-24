/**
 * Guardrails do resumo clínico consentido (ADR-06).
 * O modelo vê o chat para sintetizar; o texto que sai daqui não pode
 * devolver a fala literal do paciente para o terapeuta.
 */

const QUOTE_RE = /[“”"«»]/g;
const FIRST_PERSON_RE = /\b(eu|me|minha|meu|mim|comigo)\b/gi;

export const COMPANION_SUMMARY_SYSTEM = `Você escreve um briefing clínico curto para o psicólogo responsável.
Regras:
- Terceira pessoa, português brasileiro, no máximo 180 palavras.
- Sem aspas, sem transcrição literal, sem primeira pessoa do paciente.
- Fale de temas, intensidade, datas aproximadas e técnicas de coping usadas.
- Nunca copie frases do paciente. Parafraseie.
- Nunca diagnostique, nunca nomeie fármaco, nunca invente o que não estiver no histórico.
- Se não houver episódio clinicamente relevante, diga que houve acompanhamento sem episódios notáveis.
- Cite a origem como "registros do Acompanhante (Ivy)", nunca como "o paciente disse:".`;

export interface CompanionTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

function brDateParts(now: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now).split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y, m, d, weekday: map[wd.slice(0, 3)] ?? 0 };
}

function shiftBrDate(y: number, m: number, d: number, days: number): string {
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 15, 0, 0));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

/** Semana civil anterior (segunda a domingo) em America/Sao_Paulo. */
export function previousBrWeekBounds(now = new Date()): { start: string; end: string } {
  const { y, m, d, weekday } = brDateParts(now);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return {
    start: shiftBrDate(y, m, d, mondayOffset - 7),
    end: shiftBrDate(y, m, d, mondayOffset - 1),
  };
}

export function normalizeForLeakCheck(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function longestSharedTokenRun(source: string, candidate: string, minTokens = 6): string | null {
  const sourceTokens = normalizeForLeakCheck(source).split(' ').filter(Boolean);
  const candidateTokens = normalizeForLeakCheck(candidate).split(' ').filter(Boolean);
  if (sourceTokens.length < minTokens || candidateTokens.length < minTokens) return null;

  const sourceSet = sourceTokens.join(' ');
  for (let size = Math.min(candidateTokens.length, 16); size >= minTokens; size -= 1) {
    for (let i = 0; i <= candidateTokens.length - size; i += 1) {
      const window = candidateTokens.slice(i, i + size).join(' ');
      if (sourceSet.includes(window)) return window;
    }
  }
  return null;
}

export function findLiteralLeak(turns: CompanionTurn[], summary: string): string | null {
  const userText = turns.filter((turn) => turn.role === 'user').map((turn) => turn.content).join('\n');
  return longestSharedTokenRun(userText, summary, 6);
}

export function sanitizeCompanionSummary(raw: string, turns: CompanionTurn[]): string {
  let text = raw.replace(QUOTE_RE, '').replace(/\s+/g, ' ').trim();
  text = text.replace(FIRST_PERSON_RE, 'a pessoa');

  const leak = findLiteralLeak(turns, text);
  if (leak) {
    text = text.replace(new RegExp(leak.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'um mal-estar relatado');
    if (findLiteralLeak(turns, text)) {
      return 'Houve acompanhamento no chat da Ivy na semana. O resumo automático foi omitido para não expor o conteúdo literal da conversa. Os alertas de risco, se houver, continuam visíveis.';
    }
  }

  if (text.length > 1400) text = `${text.slice(0, 1390).trim()}…`;
  return text;
}

export function filterCompanionSummaryChunks<T extends { document_type: string }>(
  chunks: T[],
  allowsSharing: boolean,
): T[] {
  if (allowsSharing) return chunks;
  return chunks.filter((chunk) => chunk.document_type !== 'companion_summary');
}

export function buildSummaryUserPrompt(turns: CompanionTurn[], periodStart: string, periodEnd: string): string {
  const lines = turns.map((turn) => {
    const day = turn.created_at.slice(0, 10);
    const role = turn.role === 'user' ? 'paciente' : 'acompanhante';
    return `[${day} | ${role}] ${turn.content}`;
  });
  return `Período: ${periodStart} a ${periodEnd}.\nHistórico interno (não transcrever):\n${lines.join('\n')}`;
}
