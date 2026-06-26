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
    expect(blocks.filter((b) => b.type === 'h2')).toHaveLength(2);
    expect(blocks.filter((b) => b.type === 'ul')).toHaveLength(2);
    expect(blocks.some((b) => b.type === 'ul' && b.items.some((item) => item.includes('Crise')))).toBe(
      true,
    );
  });

  it('preserva marcadores inline para renderização no PDF', () => {
    const blocks = markdownToPdfBlocks('## Título\n**texto em negrito**');
    expect(blocks.some((b) => b.type === 'p' && b.text.includes('**texto em negrito**'))).toBe(true);
  });
});

describe('sanitizeFilename', () => {
  it('normaliza acentos e espaços', () => {
    expect(sanitizeFilename('Mariana Silva')).toBe('Mariana-Silva');
    expect(sanitizeFilename('José')).toBe('Jose');
  });
});
