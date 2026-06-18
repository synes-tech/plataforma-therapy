/** Flags enviadas ao backend (snake_case — contrato da API). */
export interface RecommendationContextFlags {
  use_profile: boolean;
  use_family_diary: boolean;
  use_last_session: boolean;
  use_history: boolean;
}

export const EMPTY_CONTEXT_FLAGS: RecommendationContextFlags = {
  use_profile: false,
  use_family_diary: false,
  use_last_session: false,
  use_history: false,
};

export const CONTEXT_SOURCE_OPTIONS: Array<{
  key: keyof RecommendationContextFlags;
  label: string;
  description: string;
}> = [
  {
    key: 'use_profile',
    label: 'Ficha Clínica do Paciente',
    description: 'Anamnese, hiperfocos, objetivos terapêuticos e contexto cadastral.',
  },
  {
    key: 'use_family_diary',
    label: 'Relato do Diário da Semana',
    description: 'Entradas preenchidas pela família nos últimos dias.',
  },
  {
    key: 'use_last_session',
    label: 'Apenas a Última Sessão Realizada',
    description: 'SOAP e resumo da sessão mais recente.',
  },
  {
    key: 'use_history',
    label: 'Histórico Recente de Sessões',
    description: 'Evolução clínica das sessões anteriores registradas.',
  },
];

export function hasAnyContextFlag(flags: RecommendationContextFlags): boolean {
  return Object.values(flags).some(Boolean);
}

export function countActiveFlags(flags: RecommendationContextFlags): number {
  return Object.values(flags).filter(Boolean).length;
}
