/**
 * Configuração do diário do portal.
 *
 * O mesmo PWA atende duas pessoas muito diferentes: um cuidador que **observa** alguém de
 * fora, e um paciente que **relata** a própria experiência. As perguntas não podem ser as
 * mesmas — "houve agitação hoje?" é uma observação externa; "como está sua ansiedade?" é
 * introspecção. Este módulo é a fonte da verdade de quais campos existem em cada modo.
 *
 * Espelhado em `src/shared/lib/portal-diary.ts` para a UI. Há teste comparando os dois.
 */

export type PortalDiaryMode = 'CAREGIVER' | 'SELF';

/** Chips de contexto de cada modo. Gravados em `diary_entries.categories`. */
export const CAREGIVER_CATEGORIES = [
  'sono',
  'escola',
  'alimentacao',
  'social',
  'hiperatividade',
  'sensorial',
] as const;

export const SELF_CATEGORIES = [
  'trabalho',
  'relacionamentos',
  'adesao_tratamento',
  'autocuidado',
  'sono',
  'social',
] as const;

/**
 * Cuidador de um adulto: observação externa, mas sem escola/agitação/sensorial —
 * essas categorias descrevem o dia de uma criança, não o de quem está em curatela
 * ou sendo acompanhado por um familiar.
 */
export const ADULT_CAREGIVER_CATEGORIES = [
  'sono',
  'alimentacao',
  'social',
  'trabalho',
  'relacionamentos',
  'adesao_tratamento',
] as const;

export function categoriesForMode(mode: PortalDiaryMode): readonly string[] {
  return mode === 'SELF' ? SELF_CATEGORIES : CAREGIVER_CATEGORIES;
}

/** Subconjunto que a UI mostra, dado o perfil do paciente. */
export function categoriesForContext(
  mode: PortalDiaryMode,
  profile: 'CHILD' | 'ADOLESCENT' | 'ADULT' | null | undefined,
): readonly string[] {
  if (mode === 'SELF') return SELF_CATEGORIES;
  if (profile === 'ADULT') return ADULT_CAREGIVER_CATEGORIES;
  return CAREGIVER_CATEGORIES;
}

/**
 * Allowlist de persistência. Mais largo que a UI: um cuidador de adulto pode gravar
 * `trabalho`; um de criança, `escola`. Rejeitar o conjunto da outra faixa etária
 * apagaria check-ins válidos se o perfil do paciente for corrigido depois.
 */
export function allowedCategoriesForMode(mode: PortalDiaryMode): readonly string[] {
  if (mode === 'SELF') return SELF_CATEGORIES;
  return [...new Set([...CAREGIVER_CATEGORIES, ...ADULT_CAREGIVER_CATEGORIES])];
}

/** Chaves aceitas em `diary_entries.payload`, por modo. */
export const SELF_PAYLOAD_KEYS = ['mood_10', 'anxiety_10', 'triggers'] as const;
export const CAREGIVER_PAYLOAD_KEYS = [] as const;

export function payloadKeysForMode(mode: PortalDiaryMode): readonly string[] {
  return mode === 'SELF' ? SELF_PAYLOAD_KEYS : CAREGIVER_PAYLOAD_KEYS;
}

export const TRIGGERS_MAX_LENGTH = 1000;

/**
 * Converte a escala 1–10 do auto-relato para o `mood_score` 1–5 da coluna.
 *
 * A coluna existe desde o início, é NOT NULL e alimenta o calendário do portal, os gráficos
 * do terapeuta e o gatilho de alerta de crise. Gravar 1–10 nela quebraria todos eles em
 * silêncio. O valor original fica em `payload.mood_10`, sem perda — a projeção é para os
 * consumidores antigos continuarem lendo a mesma escala.
 */
export function projectMood10To5(mood10: number): number {
  const clamped = Math.min(10, Math.max(1, Math.round(mood10)));
  return Math.ceil(clamped / 2);
}

export interface NormalizedDiaryPayload {
  payload: Record<string, unknown>;
  errors: Record<string, string>;
}

/**
 * Filtra o `payload` do cliente contra o allowlist do modo.
 *
 * Chave desconhecida é descartada, não rejeitada: um cliente antigo ou uma versão nova do
 * PWA não deveriam impedir alguém de registrar o dia. O que não pode é virar lixo permanente
 * numa coluna JSONB que ninguém sabe interpretar depois.
 */
export function normalizeDiaryPayload(
  mode: PortalDiaryMode,
  raw: Record<string, unknown> | null | undefined,
): NormalizedDiaryPayload {
  const errors: Record<string, string> = {};
  const payload: Record<string, unknown> = {};
  if (!raw) return { payload, errors };

  const allowed = new Set(payloadKeysForMode(mode));

  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;

    if (key === 'mood_10' || key === 'anxiety_10') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1 || n > 10) {
        errors[key] = 'Valor deve estar entre 1 e 10.';
        continue;
      }
      payload[key] = Math.round(n);
      continue;
    }

    if (key === 'triggers') {
      const text = String(value).trim();
      if (!text) continue;
      if (text.length > TRIGGERS_MAX_LENGTH) {
        errors[key] = `Máximo de ${TRIGGERS_MAX_LENGTH} caracteres.`;
        continue;
      }
      payload[key] = text;
      continue;
    }
  }

  return { payload, errors };
}

/** Descarta chips que não pertencem ao modo, pela mesma razão do payload. */
export function normalizeCategories(mode: PortalDiaryMode, categories: string[]): string[] {
  const allowed = new Set(allowedCategoriesForMode(mode));
  return [...new Set(categories.filter((c) => allowed.has(c)))];
}
