/**
 * Espelho testável das funções puras de formatação do backend (query-copilot/patient-context.ts).
 * Mantido em sincronia manual para testes de QA sem Deno.
 */

export interface DiaryEntryFixture {
  entry_date: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: unknown;
  notes: string | null;
}

export function workspaceSurfaceAddendum(patientName: string): string {
  return `=== MODO COPILOTO AO TERAPEUTA ===
Você está no workspace dedicado do terapeuta, como um colega clínico ao lado dele — não como um chatbot genérico.
O paciente desta conversa é ${patientName}. O contexto está TRAVADO neste paciente. Nunca peça outro paciente, nunca misture casos e nunca invente um segundo prontuário.
Tom: conversacional, colaborativo e preciso. Pode fazer UMA pergunta curta de esclarecimento se faltar um dado clínico essencial.
Continue citando fontes (diário, sessão, inventário, anexos). Evite saudações longas depois da primeira resposta.`;
}

export function formatDiaryEntryLine(entry: DiaryEntryFixture): string {
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

export function formatDiaryContextBlock(entries: DiaryEntryFixture[]): string {
  if (entries.length === 0) {
    return 'Nenhuma entrada recente no diário familiar.';
  }

  return entries.map(formatDiaryEntryLine).join('\n');
}

export function calculatePatientAge(birthDate: string, referenceDate = new Date()): number | null {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
