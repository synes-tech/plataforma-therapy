const ARTIFACT_TITLE_PREFIX: Record<string, string> = {
  acao_recomendada: 'Plano de Ação',
  resumo_proativo: 'Resumo',
  relatorio_sessao: 'Relatório da sessão',
};

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function resolveArtifactDisplayTitle(artifact: {
  titulo?: string | null;
  tipo_artefato: string;
  criado_em: string;
}): string {
  const custom = artifact.titulo?.trim();
  if (custom) return custom;
  const prefix = ARTIFACT_TITLE_PREFIX[artifact.tipo_artefato] ?? 'Documento';
  const shortDate = formatDateShort(artifact.criado_em);
  return shortDate ? `${prefix} de ${shortDate}` : prefix;
}
