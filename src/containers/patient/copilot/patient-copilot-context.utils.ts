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
