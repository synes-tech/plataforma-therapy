import type { DiaryEntry } from '../patient-record.types';

export function formatDiaryDateShort(entryDate: string): string {
  return new Date(`${entryDate}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function formatDiaryDateLong(entryDate: string): string {
  return new Date(`${entryDate}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function diaryAuthorLabel(entry: Pick<DiaryEntry, 'author_access_level'>): string {
  return entry.author_access_level === 'SELF' ? 'paciente' : 'responsável';
}

/**
 * Preview do check-in no card do terapeuta.
 *
 * Auto-relato e observação externa não podem cair no mesmo texto: se o terapeuta lê
 * "check-in da família" num registro que o próprio paciente escreveu, ele interpreta
 * introspecção como relato de terceiro — e age em cima do dado errado.
 */
export function buildDiaryPreview(entry: DiaryEntry, max = 100): string {
  const self = entry.author_access_level === 'SELF';
  const triggers = entry.payload?.triggers?.replace(/\s+/g, ' ').trim() ?? '';
  const notes = entry.notes?.replace(/\s+/g, ' ').trim() ?? '';
  const text = triggers || notes;

  if (!text) {
    if (self && (entry.payload?.mood_10 || entry.payload?.anxiety_10)) {
      const parts = [
        entry.payload?.mood_10 ? `Humor ${entry.payload.mood_10}/10` : null,
        entry.payload?.anxiety_10 ? `Ansiedade ${entry.payload.anxiety_10}/10` : null,
      ].filter(Boolean);
      return parts.join(' · ');
    }
    if (entry.crisis_occurred) return 'Relato com registro de crise.';
    return self
      ? 'Auto-relato sem observações escritas.'
      : 'Check-in do responsável, sem observações escritas.';
  }

  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}
