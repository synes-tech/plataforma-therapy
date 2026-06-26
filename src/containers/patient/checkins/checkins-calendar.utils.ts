export function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatCheckinDateLong(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

export function buildCheckinMonthGrid(
  year: number,
  month: number,
): Array<{ day: number | null; dateKey?: string }> {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number | null; dateKey?: string }> = [];

  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateKey: toDateKey(year, month, d) });
  }

  return cells;
}

/** Textos descritivos do check-in (payload completo ou legado). */
export function getCheckinTextDetails(day: {
  text_details?: Array<{ kind: string; label: string; text: string }>;
  notes?: string | null;
  transcricao?: string | null;
}): Array<{ kind: string; label: string; text: string }> {
  if (day.text_details && day.text_details.length > 0) {
    return day.text_details.filter((d) => d.text?.trim());
  }

  const legacy: Array<{ kind: string; label: string; text: string }> = [];
  if (day.notes?.trim()) {
    legacy.push({ kind: 'notes', label: 'Observações da família', text: day.notes.trim() });
  }
  if (day.transcricao?.trim()) {
    legacy.push({
      kind: 'transcricao',
      label: 'Relato em áudio (transcrição)',
      text: day.transcricao.trim(),
    });
  }
  return legacy;
}

/** Resumo curto para card colapsado (mobile). */
export function buildCheckinPreview(day: Parameters<typeof getCheckinTextDetails>[0], maxLen = 88): string {
  const details = getCheckinTextDetails(day);
  if (details.length === 0) {
    return 'Sem observações escritas — humor e indicadores registrados.';
  }

  const combined = details.map((d) => d.text).join(' · ');
  if (combined.length <= maxLen) return combined;
  return `${combined.slice(0, maxLen).trimEnd()}…`;
}

export function sortFilledCheckinDays<T extends { date: string; filled?: boolean }>(days: T[]): T[] {
  return days
    .filter((d) => d.filled)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
}

