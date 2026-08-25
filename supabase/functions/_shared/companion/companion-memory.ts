/**
 * Memória silenciosa da Ivy.
 *
 * O copiloto do terapeuta lê prontuário, hipóteses e RAG. A Ivy não.
 * Ela recebe só o que ajuda a conversar com presença: queixa, o que já
 * foi trabalhado, diário e o que a própria pessoa já trouxe nas sessões.
 *
 * Diagnóstico, medicação e hipótese clínica ficam de fora de propósito.
 */

export const COMPANION_DIARY_LIMIT = 7;
export const COMPANION_SESSION_LIMIT = 8;
export const COMPANION_MEMORY_MAX_CHARS = 4500;
const FIELD_MAX = 700;

export interface CompanionMemoryPatient {
  queixa_principal: string | null;
  objetivos_terapeuticos: string | null;
  hiperfocos_interesses: string | null;
  escolaridade_ocupacao: string | null;
  composicao_familiar: string | null;
  informacoes_adicionais: string | null;
}

export interface CompanionMemoryDiary {
  entry_date: string;
  mood_score: number | null;
  sleep_quality: number | null;
  crisis_occurred: boolean | null;
  notes: string | null;
}

export interface CompanionMemorySession {
  created_at: string;
  patient_report: string;
}

export interface CompanionMemory {
  patient: CompanionMemoryPatient | null;
  diaries: CompanionMemoryDiary[];
  sessions: CompanionMemorySession[];
}

function clip(value: string | null | undefined, max = FIELD_MAX): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

function soapText(content: unknown, keys: string[]): string {
  if (!content || typeof content !== 'object') return '';
  const obj = content as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function extractCompanionSessionReport(content: unknown): string {
  return soapText(content, ['patient_reports', 'subjective']);
}

export function formatCompanionMemoryBlock(memory: CompanionMemory): string {
  const lines: string[] = [];
  const patient = memory.patient;

  const queixa = clip(patient?.queixa_principal);
  const objetivos = clip(patient?.objetivos_terapeuticos);
  const interesses = clip(patient?.hiperfocos_interesses);
  const ocupacao = clip(patient?.escolaridade_ocupacao);
  const familia = clip(patient?.composicao_familiar);
  const extra = clip(patient?.informacoes_adicionais);

  if (queixa || objetivos || interesses || ocupacao || familia || extra) {
    lines.push('Cadastro do acompanhamento:');
    if (queixa) lines.push(`- Queixa / o que a trouxe: ${queixa}`);
    if (objetivos) lines.push(`- O que já foi trabalhado: ${objetivos}`);
    if (interesses) lines.push(`- Interesses: ${interesses}`);
    if (ocupacao) lines.push(`- Escola / trabalho: ${ocupacao}`);
    if (familia) lines.push(`- Contexto familiar: ${familia}`);
    if (extra) lines.push(`- Outras notas de acompanhamento: ${extra}`);
  }

  if (memory.diaries.length > 0) {
    lines.push('', 'Diário recente:');
    for (const entry of memory.diaries) {
      const bits = [`${entry.entry_date}`];
      if (typeof entry.mood_score === 'number') bits.push(`humor ${entry.mood_score}/5`);
      if (typeof entry.sleep_quality === 'number') bits.push(`sono ${entry.sleep_quality}/5`);
      if (entry.crisis_occurred) bits.push('teve crise');
      const notes = clip(entry.notes, 280);
      if (notes) bits.push(notes);
      lines.push(`- ${bits.join(' · ')}`);
    }
  }

  if (memory.sessions.length > 0) {
    lines.push('', 'O que ela já trouxe nas sessões (relato dela, sem as notas internas do terapeuta):');
    for (const session of memory.sessions) {
      const date = session.created_at.slice(0, 10);
      const report = clip(session.patient_report, 420);
      if (report) lines.push(`- ${date}: ${report}`);
    }
  }

  if (lines.length === 0) return '';

  const body = lines.join('\n');
  return body.length > COMPANION_MEMORY_MAX_CHARS
    ? `${body.slice(0, COMPANION_MEMORY_MAX_CHARS).trim()}…`
    : body;
}
