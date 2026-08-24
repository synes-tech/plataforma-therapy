import type { PatientProfileType, PortalAccessLevel } from './clinical-profile';

/**
 * Configuração do diário do portal — espelho de `supabase/functions/_shared/portal-diary.ts`.
 *
 * Um cuidador **observa** alguém de fora ("houve agitação hoje?"); um paciente **relata** a
 * própria experiência ("como está sua ansiedade?"). São perguntas diferentes porque são
 * atos diferentes, e um diário que não faz essa distinção produz um dado clínico ambíguo:
 * o terapeuta não sabe se está lendo observação ou introspecção.
 *
 * Há teste garantindo que este arquivo e o do backend não divirjam.
 */

export type PortalDiaryMode = PortalAccessLevel;

export interface DiaryChip {
  id: string;
  label: string;
}

export const CAREGIVER_CHIPS: DiaryChip[] = [
  { id: 'sono', label: 'Sono' },
  { id: 'escola', label: 'Escola' },
  { id: 'alimentacao', label: 'Alimentação' },
  { id: 'social', label: 'Social' },
  { id: 'hiperatividade', label: 'Agitação' },
  { id: 'sensorial', label: 'Sensorial' },
];

export const SELF_CHIPS: DiaryChip[] = [
  { id: 'trabalho', label: 'Trabalho' },
  { id: 'relacionamentos', label: 'Relacionamentos' },
  { id: 'adesao_tratamento', label: 'Adesão ao tratamento' },
  { id: 'autocuidado', label: 'Autocuidado' },
  { id: 'sono', label: 'Sono' },
  { id: 'social', label: 'Convívio social' },
];

export const ADULT_CAREGIVER_CHIPS: DiaryChip[] = [
  { id: 'sono', label: 'Sono' },
  { id: 'alimentacao', label: 'Alimentação' },
  { id: 'social', label: 'Social' },
  { id: 'trabalho', label: 'Trabalho' },
  { id: 'relacionamentos', label: 'Relacionamentos' },
  { id: 'adesao_tratamento', label: 'Adesão ao tratamento' },
];

export const DIARY_CATEGORY_LABELS: Record<string, string> = {
  sono: 'Sono',
  escola: 'Escola',
  alimentacao: 'Alimentação',
  social: 'Social',
  hiperatividade: 'Agitação',
  sensorial: 'Sensorial',
  trabalho: 'Trabalho',
  relacionamentos: 'Relacionamentos',
  adesao_tratamento: 'Adesão ao tratamento',
  autocuidado: 'Autocuidado',
};

export function chipsForMode(mode: PortalDiaryMode): DiaryChip[] {
  return mode === 'SELF' ? SELF_CHIPS : CAREGIVER_CHIPS;
}

/** Chips visíveis: o modo define o ato (observar vs relatar); o perfil, o vocabulário. */
export function chipsForContext(
  mode: PortalDiaryMode,
  profile: PatientProfileType | null | undefined,
): DiaryChip[] {
  if (mode === 'SELF') return SELF_CHIPS;
  if (profile === 'ADULT') return ADULT_CAREGIVER_CHIPS;
  return CAREGIVER_CHIPS;
}

export const MOOD_EMOJIS = [
  { value: 1, emoji: '😢', label: 'Difícil' },
  { value: 2, emoji: '😟', label: 'Abaixo' },
  { value: 3, emoji: '😐', label: 'Neutro' },
  { value: 4, emoji: '🙂', label: 'Bom' },
  { value: 5, emoji: '😄', label: 'Ótimo' },
];

export const SLEEP_LEVELS = [
  { value: 1, label: 'Péssimo' },
  { value: 2, label: 'Ruim' },
  { value: 3, label: 'Regular' },
  { value: 4, label: 'Bom' },
  { value: 5, label: 'Ótimo' },
];

/**
 * Converte a escala 1–10 do auto-relato para o `mood_score` 1–5 da coluna.
 *
 * A coluna alimenta o calendário do portal, os gráficos do terapeuta e o gatilho de alerta
 * de crise. Gravar 1–10 nela quebraria os três em silêncio; o valor original vai inteiro
 * para `payload.mood_10`.
 */
export function projectMood10To5(mood10: number): number {
  const clamped = Math.min(10, Math.max(1, Math.round(mood10)));
  return Math.ceil(clamped / 2);
}

/** Rótulo do humor em escala 1–10, para o paciente saber o que acabou de marcar. */
export function moodScaleLabel(value: number): string {
  if (value <= 2) return 'Muito difícil';
  if (value <= 4) return 'Difícil';
  if (value <= 6) return 'Neutro';
  if (value <= 8) return 'Bom';
  return 'Muito bom';
}

/** Ansiedade cresce ao contrário do humor: 10 é o pior, não o melhor. */
export function anxietyScaleLabel(value: number): string {
  if (value <= 2) return 'Tranquilo';
  if (value <= 4) return 'Leve';
  if (value <= 6) return 'Moderada';
  if (value <= 8) return 'Alta';
  return 'Muito alta';
}

export interface SelfDiaryDraft {
  mood10: number;
  anxiety10: number;
  triggers: string;
}

export interface DiarySubmission {
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level?: number;
  categories: string[];
  notes?: string;
  payload?: Record<string, unknown>;
}

export interface DiaryFormState {
  mode: PortalDiaryMode;
  mood: number | null;
  sleep: number | null;
  crisisOccurred: boolean;
  crisisLevel: number;
  categories: string[];
  notes: string;
  self: SelfDiaryDraft;
}

/** Monta o corpo do `submit-diary` a partir do estado do formulário, respeitando o modo. */
export function buildDiarySubmission(state: DiaryFormState): DiarySubmission | null {
  if (state.sleep === null) return null;

  const base = {
    sleep_quality: state.sleep,
    crisis_occurred: state.crisisOccurred,
    crisis_level: state.crisisOccurred ? state.crisisLevel : undefined,
    categories: state.categories,
    notes: state.notes.trim() || undefined,
  };

  if (state.mode === 'SELF') {
    return {
      ...base,
      mood_score: projectMood10To5(state.self.mood10),
      payload: {
        mood_10: state.self.mood10,
        anxiety_10: state.self.anxiety10,
        triggers: state.self.triggers.trim() || undefined,
      },
    };
  }

  if (state.mood === null) return null;
  return { ...base, mood_score: state.mood };
}

/**
 * No auto-relato o humor já começa numa posição neutra do slider, então só o sono fica
 * pendente. No modo cuidador, humor e sono são escolhas explícitas — nada é presumido
 * sobre um dia que a pessoa não viu.
 */
export function canSubmitDiary(state: DiaryFormState): boolean {
  return buildDiarySubmission(state) !== null;
}
