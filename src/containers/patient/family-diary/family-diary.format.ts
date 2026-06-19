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

export function buildDiaryPreview(entry: DiaryEntry, max = 100): string {
  const text = entry.notes?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text) {
    if (entry.crisis_occurred) return 'Relato com registro de crise.';
    return 'Check-in realizado pela família, sem observações escritas.';
  }
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}
