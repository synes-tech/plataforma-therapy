import { describe, expect, it } from 'vitest';

/** Espelho da lógica em family-summary.ts para testes no frontend */
function parseProactiveSummaryForFamily(markdown: string) {
  const sections: Record<string, string> = {};
  const parts = markdown.split(/^##\s+/m);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const nl = trimmed.indexOf('\n');
    const title = (nl === -1 ? trimmed : trimmed.slice(0, nl)).trim().toLowerCase();
    const body = (nl === -1 ? '' : trimmed.slice(nl + 1)).trim();
    sections[title] = body;
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const match = Object.entries(sections).find(([t]) => t.includes(k));
      if (match) return match[1];
    }
    return '';
  };
  const extractBullets = (text: string) =>
    text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
  return {
    clinical_summary: pick('resumo clínico'),
    activity_suggestions: extractBullets(pick('sugestões de atividades')),
    attention_points: extractBullets(pick('pontos de atenção')),
  };
}

describe('parseProactiveSummaryForFamily', () => {
  it('extrai as três seções do resumo proativo', () => {
    const md = `## Resumo Clínico
Humor estável na semana.

## Sugestões de Atividades
- Brincadeira sensorial
- Rotina visual

## Pontos de Atenção
- Crise na segunda-feira`;

    const r = parseProactiveSummaryForFamily(md);
    expect(r.clinical_summary).toContain('Humor estável');
    expect(r.activity_suggestions).toHaveLength(2);
    expect(r.attention_points[0]).toContain('Crise');
  });
});
