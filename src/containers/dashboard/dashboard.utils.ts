import type { BriefingSummary } from './dashboard.types';

export function formatScheduleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

export function getPatientAge(birthDate?: string | null): string {
  if (!birthDate) return '';
  const years = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(years) ? `${years}a` : '';
}

export function briefingSubtitle(summary?: BriefingSummary): string {
  if (!summary) return 'Carregando seu resumo de hoje...';
  const { sessions_today } = summary;
  if (sessions_today === 0) return 'Nenhum atendimento programado para hoje — bom momento para revisar prontuários.';
  if (sessions_today === 1) return 'Você tem 1 atendimento programado para hoje.';
  return `Você tem ${sessions_today} atendimentos programados para hoje.`;
}
