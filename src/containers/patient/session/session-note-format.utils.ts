import {
  getReportSectionValue,
  PSYCH_REPORT_SECTIONS,
  type SessionReportContentFields,
} from './session-report-sections';

export type SessionNoteSoapContent = SessionReportContentFields;

/** Texto completo do relatório clínico (rascunho ou versão bruta aprovada). */
export function formatSessionNoteForEditing(content: SessionNoteSoapContent): string {
  if (content.clinical_raw_text?.trim()) {
    return content.clinical_raw_text.trim();
  }

  if (content.lapidated_text?.trim()) {
    return content.lapidated_text.trim();
  }

  if (content.summary_markdown?.trim()) {
    return content.summary_markdown.trim();
  }

  const parts = PSYCH_REPORT_SECTIONS.map((section) => {
    const value = getReportSectionValue(content, section);
    return value ? `${section.label}\n${value}` : null;
  }).filter((part): part is string => !!part);

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  return content.transcription?.trim() ?? '';
}

export function buildSessionApprovalToast(
  shared: boolean,
  shareMode?: 'as_is' | 'refined' | null,
): string {
  if (!shared) {
    return 'Relatório salvo no prontuário (uso interno)';
  }

  if (shareMode === 'refined') {
    return 'Versão refinada enviada para a família; o relatório clínico bruto permanece privado';
  }

  return 'Relatório enviado para a família como gerado';
}
