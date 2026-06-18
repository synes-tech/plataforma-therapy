/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { soapToSummaryMarkdown, formatSessionDuration } from './session-history.utils';
import type { SessionSoapContent } from './session-history.types';

describe('soapToSummaryMarkdown', () => {
  it('retorna summary_markdown quando presente', () => {
    const soap: SessionSoapContent = {
      subjective: 'A',
      objective: 'B',
      assessment: 'C',
      plan: 'D',
      summary_markdown: '## Subjetivo\nTexto custom',
    };
    expect(soapToSummaryMarkdown(soap)).toBe('## Subjetivo\nTexto custom');
  });

  it('gera markdown a partir do SOAP legado', () => {
    const soap: SessionSoapContent = {
      subjective: 'Paciente colaborativo',
      objective: 'Boa atenção',
      assessment: 'Progresso estável',
      plan: 'Manter rotina',
    };
    const md = soapToSummaryMarkdown(soap);
    expect(md).toContain('## Subjetivo');
    expect(md).toContain('Paciente colaborativo');
    expect(md).toContain('## Plano');
    expect(md).toContain('Manter rotina');
  });
});

describe('formatSessionDuration', () => {
  it('formata minutos e segundos', () => {
    expect(formatSessionDuration(125)).toBe('2:05');
    expect(formatSessionDuration(0)).toBe('');
    expect(formatSessionDuration(null)).toBe('');
  });
});
