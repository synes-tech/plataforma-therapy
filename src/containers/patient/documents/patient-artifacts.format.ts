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

/** Ex.: "19 de Junho de 2026" */
export function formatArtifactDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = MONTHS_PT[date.getMonth()];
  const year = date.getFullYear();

  return `${day} de ${month} de ${year}`;
}
