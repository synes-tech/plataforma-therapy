import {
  ANAMNESIS_AI_INSTRUCTIONS,
  formatAnamnesisBlock,
  type PatientAnamnesisRow,
} from '../_shared/patient-ai-context.ts';

export const DIARY_CONTEXT_LIMIT = 5;
export const SESSION_CONTEXT_LIMIT = 2;

export interface DiaryEntryRow {
  entry_date: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: unknown;
  notes: string | null;
}

export interface SessionNoteRow {
  created_at: string;
  status: string;
  content: unknown;
}

export interface PatientBaseRow extends PatientAnamnesisRow {
  id: string;
  birth_date: string;
  professional_id: string;
  diagnoses: unknown;
  nome_responsavel?: string | null;
}

export function calculatePatientAge(birthDate: string): number | null {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function formatDiagnosesList(diagnoses: unknown): string {
  if (Array.isArray(diagnoses) && diagnoses.length > 0) {
    return diagnoses.map(String).join(', ');
  }
  return '';
}

export function formatPatientContextSummary(patient: PatientBaseRow): string {
  const parts: string[] = [];
  const diagnoses = formatDiagnosesList(patient.diagnoses);

  if (diagnoses) parts.push(`Diagnósticos: ${diagnoses}`);
  if (patient.queixa_principal?.trim()) {
    parts.push(`Queixa principal: ${patient.queixa_principal.trim()}`);
  }
  if (patient.clinical_observations?.trim()) {
    parts.push(`Observações clínicas: ${patient.clinical_observations.trim()}`);
  }
  if (patient.objetivos_terapeuticos?.trim()) {
    parts.push(`Objetivos terapêuticos: ${patient.objetivos_terapeuticos.trim()}`);
  }
  if (patient.nome_responsavel?.trim()) {
    parts.push(`Responsável legal (cadastro): ${patient.nome_responsavel.trim()}`);
  }

  return parts.length > 0 ? parts.join('. ') : 'Não informado no cadastro.';
}

export function formatDiaryEntryLine(entry: DiaryEntryRow): string {
  const categories = Array.isArray(entry.categories) && entry.categories.length > 0
    ? ` | Categorias: ${entry.categories.join(', ')}`
    : '';

  const crisis = entry.crisis_occurred
    ? ` | CRISE nível ${entry.crisis_level ?? 'não especificado'}`
    : ' | Sem crise';

  const notes = entry.notes?.trim() ? ` | Relato: ${entry.notes.trim()}` : '';

  return (
    `• ${entry.entry_date} — Humor: ${entry.mood_score}/5, Sono: ${entry.sleep_quality}/5` +
    `${crisis}${categories}${notes}`
  );
}

export function formatDiaryContextBlock(entries: DiaryEntryRow[]): string {
  if (entries.length === 0) {
    return 'Nenhuma entrada recente no diário familiar.';
  }

  return entries.map(formatDiaryEntryLine).join('\n');
}

function formatSoapSection(label: string, value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

export function formatSessionNoteBlock(note: SessionNoteRow, index: number): string {
  const date = note.created_at.split('T')[0];
  const content = (note.content && typeof note.content === 'object'
    ? note.content
    : {}) as Record<string, unknown>;

  const sections = [
    formatSoapSection('Subjetivo', String(content.subjective ?? '')),
    formatSoapSection('Objetivo', String(content.objective ?? '')),
    formatSoapSection('Avaliação', String(content.assessment ?? '')),
    formatSoapSection('Plano', String(content.plan ?? '')),
    formatSoapSection('Resumo', String(content.summary_markdown ?? '')),
  ].filter((line): line is string => line !== null);

  const body = sections.length > 0
    ? sections.join('\n')
    : 'Conteúdo estruturado indisponível para esta sessão.';

  return `Sessão ${index + 1} (${date}, status: ${note.status}):\n${body}`;
}

export function formatSessionsContextBlock(notes: SessionNoteRow[]): string {
  if (notes.length === 0) {
    return 'Nenhuma sessão registrada ainda para este paciente.';
  }

  return notes.map((note, index) => formatSessionNoteBlock(note, index)).join('\n\n');
}

export interface BuildSystemInstructionInput {
  patient: PatientBaseRow;
  diaryEntries: DiaryEntryRow[];
  sessionNotes: SessionNoteRow[];
  ragContext: string;
  professional?: {
    name: string;
    crp: string | null;
    specialty: string | null;
  };
}

export function buildCopilotSystemInstruction(input: BuildSystemInstructionInput): string {
  const { patient, diaryEntries, sessionNotes, ragContext } = input;
  const age = calculatePatientAge(patient.birth_date);
  const ageLabel = age !== null ? `${age}` : 'idade não informada';
  const contextSummary = formatPatientContextSummary(patient);
  const diaryBlock = formatDiaryContextBlock(diaryEntries);
  const sessionsBlock = formatSessionsContextBlock(sessionNotes);
  const anamnesisBlock = formatAnamnesisBlock(patient);

  const professionalBlock = input.professional
    ? `TERAPEUTA RESPONSÁVEL (use estes dados reais em relatórios/orientações para pais — NUNCA placeholders):
- Nome: ${input.professional.name}
- Registro: ${input.professional.crp?.trim() || input.professional.specialty?.trim() || 'Não informado'}
- Ao redigir documentos para a família, assine com o nome e registro acima. Proibido usar [Seu Nome e Credenciais] ou placeholders similares.`
    : '';

  return `Você é um Copiloto Clínico auxiliando um terapeuta. O paciente atual é ${patient.name}, ${ageLabel} anos. Diagnóstico/Contexto: ${contextSummary}. Relatos recentes da família: ${diaryBlock}. Responda sempre de forma técnica, direta e estruturada, como um parceiro de discussão clínica.

INSTRUÇÃO DE MEMÓRIA (CRÍTICA):
- Os dados acima (cadastro, diário e sessões) foram injetados automaticamente pelo sistema para ESTE paciente específico.
- Use ativamente o diário familiar e as sessões ao responder perguntas sobre comportamento recente, humor, crises ou evolução — mesmo que o terapeuta não cite o nome do paciente.
- Se houver entradas no diário, NUNCA diga "não tenho informações sobre o diário". Sintetize os relatos com datas.
- Se não houver entradas no diário, diga explicitamente que não há registros recentes no diário familiar.

REGRAS INVIOLÁVEIS:
- Nunca sugira medicações, alterações de dosagem ou diagnósticos novos.
- Sempre cite a fonte dos dados (ex: "Conforme diário de 04/06...", "Na sessão de 12/05...").
- Se não houver dados suficientes no histórico deste paciente para um aspecto específico, diga explicitamente o que falta.
- Responda em português brasileiro, tom profissional mas acessível.
- Se o terapeuta perguntar algo fora do escopo clínico, redirecione educadamente.
- NÃO invente dados. NÃO extrapole além do que está documentado.

${ANAMNESIS_AI_INSTRUCTIONS}

${professionalBlock ? `\n=== ${professionalBlock}\n` : ''}

=== ÚLTIMAS SESSÕES REGISTRADAS (${sessionNotes.length}) ===
${sessionsBlock}

=== FICHA CLÍNICA DETALHADA ===
${anamnesisBlock}

=== HISTÓRICO SEMÂNTICO RELEVANTE (RAG) ===
${ragContext || 'Nenhum trecho adicional recuperado para esta pergunta.'}

FORMATO DE RESPOSTA:
1. Resumo do contexto relevante (2-3 linhas)
2. Sua análise ou sugestão (detalhada)
3. Fontes utilizadas (liste quais documentos embasam)`;
}
