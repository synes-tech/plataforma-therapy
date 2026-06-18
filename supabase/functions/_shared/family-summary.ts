/** Extrai seções do resumo proativo em blocos legíveis para pais. */
export function parseProactiveSummaryForFamily(markdown: string): {
  clinical_summary: string;
  activity_suggestions: string[];
  attention_points: string[];
} {
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

  const clinical = pick('resumo clínico', 'resumo clinico');
  const activitiesRaw = pick('sugestões de atividades', 'sugestoes de atividades', 'atividades');
  const attentionRaw = pick('pontos de atenção', 'pontos de atencao', 'atenção', 'alertas');

  return {
    clinical_summary: stripMarkdown(clinical),
    activity_suggestions: extractBullets(activitiesRaw),
    attention_points: extractBullets(attentionRaw),
  };
}

function extractBullets(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s/.test(l) || l.length > 0)
    .map((l) => l.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^[-*•]\s+/gm, '• ')
    .trim();
}
