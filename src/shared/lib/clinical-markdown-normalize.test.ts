import { describe, expect, it } from 'vitest';
import { normalizeClinicalMarkdown, validateClinicalMarkdown } from './clinical-markdown-normalize';

describe('normalizeClinicalMarkdown', () => {
  it('remove tags HTML e normaliza quebras', () => {
    const input = '<p>Olá</p>\n\n\n## Título\r\n- item';
    expect(normalizeClinicalMarkdown(input)).toBe('Olá\n\n## Título\n- item');
  });

  it('remove javascript: em links', () => {
    const input = '[clique](javascript:alert(1))';
    expect(normalizeClinicalMarkdown(input)).toBe('[clique](alert(1))');
  });
});

describe('validateClinicalMarkdown', () => {
  it('rejeita conteúdo vazio após normalização', () => {
    expect(validateClinicalMarkdown('   ')).toEqual({
      ok: false,
      code: 'EMPTY_CONTENT',
      message: 'O conteúdo não pode ficar vazio',
    });
  });

  it('aceita markdown clínico válido', () => {
    const result = validateClinicalMarkdown('## Objetivo\n\n- **Passo 1**');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toContain('**Passo 1**');
    }
  });
});
