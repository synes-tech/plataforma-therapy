/** Verifica se há dados mínimos para gerar resumo executivo (evita chamada à Edge Function). */
export function canGenerateSummary(totalSessions: number, hasClinicalObservations: boolean): boolean {
  return totalSessions > 0 || hasClinicalObservations;
}
