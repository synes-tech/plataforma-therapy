import { describe, expect, it } from 'vitest';
import {
  applyTextAreaEdit,
  insertHeadingLine,
  prefixTextAreaLines,
  wrapTextAreaSelection,
} from './markdown-editor.utils';

describe('markdown-editor.utils', () => {
  it('aplica inserção substituindo seleção', () => {
    const result = applyTextAreaEdit('abc def', 4, 7, 'XYZ');
    expect(result.value).toBe('abc XYZ');
    expect(result.selectionStart).toBe(7);
  });

  it('envolve seleção com negrito markdown', () => {
    const result = wrapTextAreaSelection('texto forte aqui', 6, 11, '**');
    expect(result.value).toBe('texto **forte** aqui');
  });

  it('prefixa linhas com bullet', () => {
    const result = prefixTextAreaLines('item um\nitem dois', 0, 15, '- ');
    expect(result.value).toBe('- item um\n- item dois');
  });

  it('insere heading h2', () => {
    const result = insertHeadingLine('Título\nCorpo', 0, 6, 2);
    expect(result.value.startsWith('## Título')).toBe(true);
  });
});
