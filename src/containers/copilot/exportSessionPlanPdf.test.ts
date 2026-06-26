import { describe, expect, it } from 'vitest';
import { buildSessionPlanMarkdown } from './exportSessionPlanPdf';

describe('buildSessionPlanMarkdown', () => {
  it('monta seções numeradas com título e conteúdo', () => {
    const md = buildSessionPlanMarkdown([
      { id: '1', title: 'Aquecimento', content: 'Brincadeira sensorial por 5 min.' },
      { id: '2', title: 'Foco', content: 'Treino de contato visual.' },
    ]);

    expect(md).toContain('## 1. Aquecimento');
    expect(md).toContain('Brincadeira sensorial por 5 min.');
    expect(md).toContain('## 2. Foco');
  });
});
