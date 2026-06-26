import { describe, expect, it } from 'vitest';
import { parseMarkdownContent } from './ai-markdown.utils';

describe('parseMarkdownContent', () => {
  it('parseia título h2 e parágrafo separados', () => {
    const blocks = parseMarkdownContent('## Subjetivo\n\nPaciente relatou **ansiedade**.');

    expect(blocks).toEqual([
      { type: 'h2', text: 'Subjetivo' },
      { type: 'p', text: 'Paciente relatou **ansiedade**.' },
    ]);
  });

  it('parseia título com corpo na mesma seção', () => {
    const blocks = parseMarkdownContent('## Plano\n- Item A\n- Item B');

    expect(blocks).toEqual([
      { type: 'h2', text: 'Plano' },
      { type: 'ul', items: ['Item A', 'Item B'] },
    ]);
  });

  it('parseia listas com marcadores alternativos', () => {
    const blocks = parseMarkdownContent('* Primeiro\n• Segundo\n- Terceiro');

    expect(blocks).toEqual([
      { type: 'ul', items: ['Primeiro', 'Segundo', 'Terceiro'] },
    ]);
  });

  it('parseia listas numeradas', () => {
    const blocks = parseMarkdownContent('1. Primeiro passo\n2. Segundo passo');

    expect(blocks).toEqual([
      { type: 'ol', items: ['Primeiro passo', 'Segundo passo'] },
    ]);
  });

  it('parseia heading h1 e h3', () => {
    const blocks = parseMarkdownContent('# Título principal\n\n### Detalhe');

    expect(blocks).toEqual([
      { type: 'h1', text: 'Título principal' },
      { type: 'h3', text: 'Detalhe' },
    ]);
  });

  it('intercala parágrafos e bullets na mesma seção', () => {
    const blocks = parseMarkdownContent('Introdução\n- Ponto 1\n- Ponto 2\nConclusão');

    expect(blocks).toEqual([
      { type: 'p', text: 'Introdução' },
      { type: 'ul', items: ['Ponto 1', 'Ponto 2'] },
      { type: 'p', text: 'Conclusão' },
    ]);
  });
});
