import type { PatientSessionRecord } from '../session/session-history.types';

export interface SessionReportBadge {
  label: string;
  className: string;
}

export function formatSessionDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function buildSessionTitle(dataSessao: string): string {
  return `Sessão — ${formatSessionDateShort(dataSessao)}`;
}

export function truncateSessionPreview(text: string, max = 90): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Sessão registrada';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

export function buildSessionPreview(session: PatientSessionRecord): string {
  const text =
    session.resumo_ia.subjective?.trim() ||
    session.resumo_ia.assessment?.trim() ||
    session.transcricao_completa?.trim() ||
    '';
  return truncateSessionPreview(text);
}

export function deriveSessionReportBadge(session: PatientSessionRecord): SessionReportBadge {
  if (session.status_nota === 'draft') {
    return {
      label: 'Processando',
      className: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
  }

  const text = `${session.resumo_ia.assessment ?? ''} ${session.resumo_ia.subjective ?? ''}`.toLowerCase();

  if (/crise|agita|dificuld|desafiador|regress|disruptivo/i.test(text)) {
    return {
      label: 'Sessão desafiadora',
      className: 'bg-amber-50 text-amber-800 ring-amber-200',
    };
  }

  if (/progresso|evolu|positiv|bom|ótimo|engajamento|avanço|melhora/i.test(text)) {
    return {
      label: 'Boa sessão',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    };
  }

  if (/estável|manutenção|rotina/i.test(text)) {
    return {
      label: 'Sessão estável',
      className: 'bg-blue-50 text-blue-700 ring-blue-200',
    };
  }

  return {
    label: 'Registrada',
    className: 'bg-slate-100 text-charcoal-muted ring-slate-200',
  };
}
