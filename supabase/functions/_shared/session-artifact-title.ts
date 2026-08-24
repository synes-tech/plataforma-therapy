const COPY_PREFIX = 'Cópia — ';

function formatSessionDatePtBr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

/** Ex.: "Relatório da sessão de 20/08/2026 — Beatriz Lima" */
export function buildSessionReportArtifactTitle(sessionAtIso: string, patientName: string): string {
  const dateLabel = formatSessionDatePtBr(sessionAtIso);
  const name = patientName.trim() || 'paciente';
  if (!dateLabel) return `Relatório da sessão — ${name}`;
  return `Relatório da sessão de ${dateLabel} — ${name}`;
}

export function buildSessionReportCopyTitle(originalTitle: string): string {
  const trimmed = originalTitle.trim() || 'Relatório da sessão';
  if (trimmed.startsWith(COPY_PREFIX)) return trimmed;
  return `${COPY_PREFIX}${trimmed}`;
}
