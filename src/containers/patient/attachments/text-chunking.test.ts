/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { chunkTextForRag } from '../../../../supabase/functions/_shared/text-chunking.ts';

describe('text-chunking', () => {
  it('retorna vazio para texto em branco', () => {
    expect(chunkTextForRag('   ')).toEqual([]);
  });

  it('mantém texto curto em um único chunk', () => {
    const text = 'Relatório escolar com observações sobre adaptação em sala.';
    expect(chunkTextForRag(text)).toEqual([text]);
  });

  it('divide parágrafos longos em múltiplos chunks', () => {
    const paragraph = 'A'.repeat(1500);
    const chunks = chunkTextForRag(`${paragraph}\n\n${paragraph}`);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
