export function clampDueDay(year: number, month: number, day: number): string {
  const last = new Date(year, month, 0).getDate();
  const safe = Math.min(28, Math.max(1, day), last);
  return `${year}-${String(month).padStart(2, '0')}-${String(safe).padStart(2, '0')}`;
}

export function previewInstallments(startsOn: string, monthsTotal: number, dueDay: number, limit = 4) {
  const start = new Date(`${startsOn}T12:00:00`);
  if (Number.isNaN(start.getTime()) || monthsTotal < 1) return [];
  const out: Array<{ index: number; due: string; label: string }> = [];
  const total = Math.min(60, monthsTotal);
  const show = Math.min(limit, total);
  for (let i = 0; i < show; i += 1) {
    const year = start.getFullYear();
    const month = start.getMonth() + 1 + i;
    const d = new Date(year, month - 1, 1);
    const due = clampDueDay(d.getFullYear(), d.getMonth() + 1, dueDay);
    const [y, m, day] = due.split('-');
    out.push({
      index: i + 1,
      due,
      label: `${day}/${m}/${y}`,
    });
  }
  return out;
}

export function lastInstallmentMonth(startsOn: string, monthsTotal: number): string | null {
  const start = new Date(`${startsOn}T12:00:00`);
  if (Number.isNaN(start.getTime()) || monthsTotal < 1) return null;
  const end = new Date(start.getFullYear(), start.getMonth() + monthsTotal - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(end);
}

export function lastInstallmentLabel(startsOn: string, monthsTotal: number): string | null {
  const start = new Date(`${startsOn}T12:00:00`);
  if (Number.isNaN(start.getTime()) || monthsTotal < 1) return null;
  const end = new Date(start.getFullYear(), start.getMonth() + monthsTotal - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(end);
}
