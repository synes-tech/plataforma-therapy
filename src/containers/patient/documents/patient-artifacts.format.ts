const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const ARTIFACT_TITLE_PREFIX: Record<string, string> = {
  acao_recomendada: 'Plano de Ação',
  resumo_proativo: 'Resumo',
  relatorio_sessao: 'Relatório',
};

/** Ex.: "19 de Junho de 2026" */
export function formatArtifactDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = MONTHS_PT[date.getMonth()];
  const year = date.getFullYear();

  return `${day} de ${month} de ${year}`;
}

/** Ex.: "19/06/2026" — coluna da tabela */
export function formatArtifactDateShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Título dinâmico: "Plano de Ação - 19/06/2026" */
export function buildArtifactTitle(tipo: string, criadoEm: string): string {
  const prefix = ARTIFACT_TITLE_PREFIX[tipo] ?? 'Documento';
  const shortDate = formatArtifactDateShort(criadoEm);
  return shortDate ? `${prefix} - ${shortDate}` : prefix;
}

/** Prévia truncada do conteúdo (50 caracteres). */
export function truncateArtifactPreview(text: string, max = 50): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}...`;
}
