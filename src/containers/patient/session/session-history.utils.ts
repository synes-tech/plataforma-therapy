import type { SessionSoapContent } from './session-history.types';

/** Gera markdown estruturado a partir do SOAP (notas legadas sem summary_markdown). */
export function soapToSummaryMarkdown(soap: SessionSoapContent): string {
  if (soap.clinical_raw_text?.trim()) {
    return soap.clinical_raw_text.trim();
  }

  if (soap.summary_markdown?.trim()) {
    return soap.summary_markdown.trim();
  }

  return [
    '## Subjetivo',
    soap.subjective || 'Não relatado nesta sessão.',
    '',
    '## Objetivo',
    soap.objective || 'Não relatado nesta sessão.',
    '',
    '## Avaliação',
    soap.assessment || 'Não relatado nesta sessão.',
    '',
    '## Plano',
    soap.plan || 'Não relatado nesta sessão.',
  ].join('\n');
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
