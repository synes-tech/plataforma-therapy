interface LegacyConteudo {
  summary?: string;
  recommendations?: Array<{
    title?: string;
    description?: string;
  }>;
}

export function formatLegacyArtifactText(conteudo: unknown): string {
  if (!conteudo || typeof conteudo !== 'object') return '';

  const data = conteudo as LegacyConteudo;
  const parts: string[] = [];

  if (data.summary?.trim()) {
    parts.push(data.summary.trim());
  }

  for (const rec of data.recommendations ?? []) {
    const title = rec.title?.trim();
    const description = rec.description?.trim();
    if (title && description) {
      parts.push(`${title}\n${description}`);
    } else if (title) {
      parts.push(title);
    } else if (description) {
      parts.push(description);
    }
  }

  return parts.join('\n\n');
}

export function mapArtifactRow(row: {
  id: string;
  tipo_artefato: string | null;
  conteudo_texto: string | null;
  conteudo: unknown;
  criado_em: string;
}): { item: import('./types.ts').PatientArtifactItem | null } {
  if (row.tipo_artefato && row.conteudo_texto?.trim()) {
    const tipo = row.tipo_artefato as import('./types.ts').ArtifactType;
    if (!['acao_recomendada', 'resumo_proativo', 'relatorio_sessao'].includes(tipo)) {
      return { item: null };
    }

    return {
      item: {
        id: row.id,
        tipo_artefato: tipo,
        conteudo_texto: row.conteudo_texto.trim(),
        criado_em: row.criado_em,
        is_legacy: false,
      },
    };
  }

  const legacyText = formatLegacyArtifactText(row.conteudo);
  if (!legacyText) return { item: null };

  return {
    item: {
      id: row.id,
      tipo_artefato: 'acao_recomendada',
      conteudo_texto: legacyText,
      criado_em: row.criado_em,
      is_legacy: true,
    },
  };
}
