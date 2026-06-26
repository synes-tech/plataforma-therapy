export interface SessionNoteSoapContent {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  summary_markdown?: string;
  lapidated_text?: string;
  clinical_raw_text?: string;
  family_text?: string;
  transcription?: string;
}

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

  const sections: Array<{ label: string; value?: string }> = [
    { label: 'Subjetivo', value: content.subjective },
    { label: 'Objetivo', value: content.objective },
    { label: 'Avaliação', value: content.assessment },
    { label: 'Plano', value: content.plan },
  ];

  const parts = sections
    .filter((section) => section.value?.trim())
    .map((section) => `${section.label}\n${section.value!.trim()}`);

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
