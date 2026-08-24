import {
  ANAMNESIS_AI_INSTRUCTIONS,
  formatAnamnesisBlock,
  type PatientAnamnesisRow,
} from '../_shared/patient-ai-context.ts';

export const DIARY_CONTEXT_LIMIT = 5;
/** Conteúdo detalhado (SOAP/resumo) das sessões mais recentes injetado no prompt. */
export const SESSION_CONTEXT_LIMIT = 10;
/** Inventário leve: todas as datas/status (sem corpo) — fonte autoritativa para contagens. */
export const SESSION_INVENTORY_LIMIT = 500;

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

/** Linha leve do inventário histórico (sem content). */
export interface SessionInventoryRow {
  created_at: string;
  status: string;
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
    formatSoapSection(
      'Síntese da Sessão',
      String(content.clinical_synthesis ?? content.objective ?? ''),
    ),
    formatSoapSection(
      'Relatos e Conteúdo Trazido',
      String(content.patient_reports ?? content.subjective ?? ''),
    ),
    formatSoapSection(
      'Observações e Hipóteses',
      String(content.clinical_observations ?? content.assessment ?? ''),
    ),
    formatSoapSection(
      'Manejo e Próximos Passos',
      String(content.management_next_steps ?? content.plan ?? ''),
    ),
    formatSoapSection('Resumo Markdown', String(content.summary_markdown ?? '')),
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

function monthKeyPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function dateKeyPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Inventário completo do prontuário (todas as datas, independente do mês).
 * Fonte autoritativa para perguntas de quantidade / período.
 */
export function formatSessionInventoryBlock(rows: SessionInventoryRow[]): string {
  if (rows.length === 0) {
    return 'Total de sessões registradas no prontuário: 0.';
  }

  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const key = monthKeyPt(row.created_at);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  const monthLines = [...byMonth.entries()]
    .map(([month, count]) => `• ${month}: ${count} sessão(ões)`)
    .join('\n');

  const timeline = rows
    .map((row) => `• ${dateKeyPt(row.created_at)} — status: ${row.status}`)
    .join('\n');

  return [
    `Total de sessões registradas no prontuário: ${rows.length}`,
    '',
    'Distribuição por mês (histórico completo, sem filtro de mês atual):',
    monthLines,
    '',
    'Linha do tempo (mais recente → mais antiga):',
    timeline,
  ].join('\n');
}

export interface BuildSystemInstructionInput {
  patient: PatientBaseRow;
  diaryEntries: DiaryEntryRow[];
  sessionNotes: SessionNoteRow[];
  /** Inventário completo (datas/status) — contagem autoritativa. */
  sessionInventory: SessionInventoryRow[];
  ragContext: string;
  surface?: 'record' | 'workspace';
  professional?: {
    name: string;
    crp: string | null;
    specialty: string | null;
  };
}

/** Framing extra do workspace dedicado — copiloto ao lado do terapeuta. */
export function workspaceSurfaceAddendum(patientName: string): string {
  return `=== MODO COPILOTO AO TERAPEUTA ===
Você está no workspace dedicado do terapeuta, como um colega clínico ao lado dele — não como um chatbot genérico.
O paciente desta conversa é ${patientName}. O contexto está TRAVADO neste paciente. Nunca peça outro paciente, nunca misture casos e nunca invente um segundo prontuário.
Tom: conversacional, colaborativo e preciso. Pode fazer UMA pergunta curta de esclarecimento se faltar um dado clínico essencial.
Continue citando fontes (diário, sessão, inventário, anexos). Evite saudações longas depois da primeira resposta.`;
}

export function buildCopilotSystemInstruction(input: BuildSystemInstructionInput): string {
  const { patient, diaryEntries, sessionNotes, sessionInventory, ragContext } = input;
  const age = calculatePatientAge(patient.birth_date);
  const ageLabel = age !== null ? `${age}` : 'idade não informada';
  const contextSummary = formatPatientContextSummary(patient);
  const diaryBlock = formatDiaryContextBlock(diaryEntries);
  const sessionsBlock = formatSessionsContextBlock(sessionNotes);
  const inventoryBlock = formatSessionInventoryBlock(sessionInventory);
  const anamnesisBlock = formatAnamnesisBlock(patient);
  const totalSessions = sessionInventory.length;

  const professionalBlock = input.professional
    ? `TERAPEUTA RESPONSÁVEL (use estes dados reais em relatórios/orientações para pais — NUNCA placeholders):
- Nome: ${input.professional.name}
- Registro: ${input.professional.crp?.trim() || input.professional.specialty?.trim() || 'Não informado'}
- Ao redigir documentos para a família, assine com o nome e registro acima. Proibido usar [Seu Nome e Credenciais] ou placeholders similares.`
    : '';

  const surfaceBlock = input.surface === 'workspace'
    ? `\n${workspaceSurfaceAddendum(patient.name)}\n`
    : '';

  return `Você é um Copiloto Clínico auxiliando um terapeuta. O paciente atual é ${patient.name}, ${ageLabel} anos. Diagnóstico/Contexto: ${contextSummary}. Relatos recentes da família: ${diaryBlock}. Responda sempre de forma técnica, direta e estruturada, como um parceiro de discussão clínica.${surfaceBlock}

INSTRUÇÃO DE MEMÓRIA (CRÍTICA):
- Os dados acima (cadastro, diário e sessões) foram injetados automaticamente pelo sistema para ESTE paciente específico.
- Use ativamente o diário familiar e as sessões ao responder perguntas sobre comportamento recente, humor, crises ou evolução — mesmo que o terapeuta não cite o nome do paciente.
- Se houver entradas no diário, NUNCA diga "não tenho informações sobre o diário". Sintetize os relatos com datas.
- Se não houver entradas no diário, diga explicitamente que não há registros recentes no diário familiar.
- Para perguntas de QUANTIDADE, TOTAL ou HISTÓRICO de sessões (ex.: "quantas sessões", "em que meses", "já atendemos quantas vezes"), use EXCLUSIVAMENTE o bloco "INVENTÁRIO COMPLETO DE SESSÕES". O total autoritativo é ${totalSessions}. NÃO conte apenas as sessões detalhadas recentes nem chunks do RAG.
- O inventário cobre TODA a base histórica do prontuário, independente do mês atual. Nunca diga que só há sessões do mês corrente se o inventário listar outros meses.

REGRAS INVIOLÁVEIS (GUARDRAILS DE ENTRADA — cumpra na PRIMEIRA resposta, sem reescrever depois):
- NUNCA mencione nomes de medicamentos (ritalina, risperidona, metilfenidato, sertralina, etc.).
- NUNCA sugira prescrição, alteração de dose, "medicar" ou nomes comerciais de remédios.
- Se o tema envolver medicação, diga apenas: "acompanhamento medicamentoso conforme prescrição médica".
- NUNCA faça diagnóstico definitivo/conclusivo ("confirmado", "definitivo", "conclusivo").
- NUNCA use absolutismos como "cura definitiva", "sempre será", "nunca vai".
- Foque em: atividades terapêuticas, análise comportamental, estratégias de manejo, padrões observados e sugestões práticas para a sessão.
- Sempre cite a fonte dos dados (ex: "Conforme diário de 04/06...", "Na sessão de 12/05...", "Conforme inventário do prontuário (${totalSessions} sessões)...").
- Se não houver dados suficientes no histórico deste paciente para um aspecto específico, diga explicitamente o que falta.
- Responda em português brasileiro, tom profissional mas acessível.
- Se o terapeuta perguntar algo fora do escopo clínico, redirecione educadamente.
- NÃO invente dados. NÃO extrapole além do que está documentado.
- Produza UMA resposta completa e definitiva — não rascunhe, não se corrija no meio, não diga "deixe-me reformular".
- Quando o histórico semântico incluir document_type "patient_attachment", trate como laudos, relatórios escolares ou exames enviados pelo terapeuta — cite o nome do arquivo quando disponível nos metadados.
- Quando o histórico semântico incluir document_type "companion_summary", trate como resumo clínico consentido do Acompanhante (Ivy) — em terceira pessoa, sem transcrição do chat. Cite como "segundo os registros do Acompanhante". Nunca peça nem invente o diálogo original.

${ANAMNESIS_AI_INSTRUCTIONS}

${professionalBlock ? `\n=== ${professionalBlock}\n` : ''}

=== INVENTÁRIO COMPLETO DE SESSÕES (fonte autoritativa — histórico total) ===
${inventoryBlock}

=== DETALHE DAS SESSÕES MAIS RECENTES (${sessionNotes.length} com conteúdo clínico) ===
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
