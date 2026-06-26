import { describe, expect, it } from 'vitest';
import {
  formatProfessionalSignature,
  injectProfessionalPlaceholders,
  markdownToPdfBlocks,
  sanitizeFilename,
} from './pdf-content.utils';

const professional = {
  name: 'Dra. Maria Silva',
  email: 'maria@clinica.com',
  phone: '(11) 99999-0000',
  specialty: 'Psicóloga',
  crp: 'CRP 06/123456',
};

describe('injectProfessionalPlaceholders', () => {
  it('substitui [Seu Nome e Credenciais] pelo nome e CRP reais', () => {
    const text = 'Atenciosamente,\n[Seu Nome e Credenciais]';
    expect(injectProfessionalPlaceholders(text, professional)).toBe(
      'Atenciosamente,\nDra. Maria Silva · CRP 06/123456',
    );
  });

  it('substitui variantes comuns de placeholder', () => {
    const text = '[Nome do Terapeuta] — [CRP]';
    expect(injectProfessionalPlaceholders(text, professional)).toContain('Dra. Maria Silva');
  });
});

describe('formatProfessionalSignature', () => {
  it('prioriza CRP sobre especialidade', () => {
    expect(formatProfessionalSignature(professional)).toBe('Dra. Maria Silva · CRP 06/123456');
  });
});

describe('markdownToPdfBlocks', () => {
  it('converte títulos h2 e listas não ordenadas', () => {
    const md = `## Resumo Clínico
- Humor estável
- Sono irregular

## Pontos de Atenção
- Crise registrada na terça`;

    const blocks = markdownToPdfBlocks(md);
    expect(blocks.filter((block) => block.type === 'h2')).toHaveLength(2);
    expect(blocks.filter((block) => block.type === 'ul')).toHaveLength(2);
    expect(blocks.flatMap((block) => (block.type === 'ul' ? block.items : []))).toHaveLength(3);
  });

  it('converte h3, listas ordenadas e negrito inline', () => {
    const md = `### Objetivo da sessão

1. Trabalhar contato visual
2. Reforço positivo

**Importante:** revisar combinados com a família.`;

    const blocks = markdownToPdfBlocks(md);
    expect(blocks.some((block) => block.type === 'h3')).toBe(true);
    expect(blocks.some((block) => block.type === 'ol')).toBe(true);
    expect(blocks.some((block) => block.type === 'p' && block.text.includes('**Importante:**'))).toBe(
      true,
    );
  });

  it('usa o mesmo parser da UI (AiMarkdownContent)', () => {
    const md = '# Título principal\n\nParágrafo com *ênfase*.';
    const blocks = markdownToPdfBlocks(md);
    expect(blocks[0]).toEqual({ type: 'h1', text: 'Título principal' });
    expect(blocks.some((block) => block.type === 'p' && block.text.includes('*ênfase*'))).toBe(true);
  });
});

describe('sanitizeFilename', () => {
  it('normaliza acentos e espaços', () => {
    expect(sanitizeFilename('Mariana Silva')).toBe('Mariana-Silva');
    expect(sanitizeFilename('José')).toBe('Jose');
  });
});
