import { describe, expect, it } from 'vitest';
import { markdownToPdfBlocks, sanitizeFilename } from './pdfUtils';

describe('markdownToPdfBlocks', () => {
  it('converte títulos e bullets simples', () => {
    const md = `## Resumo Clínico
- Humor estável
- Sono irregular

## Pontos de Atenção
- Crise registrada na terça`;

    const blocks = markdownToPdfBlocks(md);
    expect(blocks.filter((b) => b.type === 'heading')).toHaveLength(2);
    expect(blocks.filter((b) => b.type === 'bullet')).toHaveLength(3);
    expect(blocks.some((b) => b.text.includes('Crise'))).toBe(true);
  });

  it('remove markdown bold', () => {
    const blocks = markdownToPdfBlocks('## Título\n**texto em negrito**');
    expect(blocks.some((b) => b.text.includes('**'))).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('normaliza acentos e espaços', () => {
    expect(sanitizeFilename('Mariana Silva')).toBe('Mariana-Silva');
    expect(sanitizeFilename('José')).toBe('Jose');
  });
});
