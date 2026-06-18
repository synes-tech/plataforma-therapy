/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClinicalValue, ClinicalEmptyValue } from './ClinicalRecordField';

describe('ClinicalRecordField', () => {
  it('exibe "Não preenchido" quando valor vazio', () => {
    const html = renderToStaticMarkup(<ClinicalValue value="" />);
    expect(html).toContain('Não preenchido');
  });

  it('exibe valor com contraste quando preenchido', () => {
    const html = renderToStaticMarkup(<ClinicalValue value="Ana Silva" />);
    expect(html).toContain('Ana Silva');
    expect(html).not.toContain('Não preenchido');
  });

  it('ClinicalEmptyValue é itálico amigável', () => {
    const html = renderToStaticMarkup(<ClinicalEmptyValue />);
    expect(html).toContain('italic');
    expect(html).toContain('Não preenchido');
  });
});
