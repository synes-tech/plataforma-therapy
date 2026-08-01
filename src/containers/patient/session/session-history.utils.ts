import type { SessionSoapContent } from './session-history.types';
import {
  getReportSectionValue,
  PSYCH_REPORT_SECTIONS,
} from './session-report-sections';

/** Gera markdown estruturado a partir do prontuário (ou legado SOAP). */
export function soapToSummaryMarkdown(soap: SessionSoapContent): string {
  if (soap.clinical_raw_text?.trim()) {
    return soap.clinical_raw_text.trim();
  }

  if (soap.summary_markdown?.trim()) {
    return soap.summary_markdown.trim();
  }

  return PSYCH_REPORT_SECTIONS.map((section) => {
    const value = getReportSectionValue(soap, section) || section.emptyFallback;
    return `## ${section.label}\n${value}`;
  }).join('\n\n');
}

export function formatSessionDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
