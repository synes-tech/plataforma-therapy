/**
 * FONTE ÚNICA DE VERDADE dos planos do terapeuta autônomo (catálogo v2).
 * Espelha a tabela `planos` / `plan_addons` do banco — Settings, Paywall,
 * Registro e Landing consomem daqui. Preços em centavos (BRL).
 */

export const THERAPIST_PLAN_IDS = ['free', 'standard', 'advanced', 'premium'] as const;

export type TherapistPlanId = (typeof THERAPIST_PLAN_IDS)[number];

/** Legado — contas antigas migradas (inicial→standard, intermediario→advanced). */
export const LEGACY_SOLO_PLAN_IDS = ['inicial', 'intermediario', 'consultorio'] as const;

/** Desconto do ciclo anual (12x emulado com compromisso de 12 meses). */
export const ANNUAL_DISCOUNT_PERCENT = 12;

/** Margem operacional sobre minutos de áudio (= sessões × duração). */
export const AUDIO_MINUTES_MARGIN_PERCENT = 30;

/** Sessões recomendadas por paciente/mês (soft limit — só aviso). */
export const SESSIONS_PER_PATIENT_PER_MONTH = 4;

/** Minutos de áudio/mês = sessões × duração × (1 + margem). */
export function computeAudioMinutesLimit(
  sessionLimit: number,
  sessionDurationMin: number,
  marginPercent = AUDIO_MINUTES_MARGIN_PERCENT,
): number {
  return Math.floor(sessionLimit * sessionDurationMin * (1 + marginPercent / 100));
}

export interface TherapistPlanDef {
  id: TherapistPlanId;
  nome: string;
  descricao: string;
  patientLimit: number;
  /** Sessões/mês (hard limit) = patientLimit × 4. */
  sessionLimit: number;
  sessionDurationMin: number;
  /** Minutos de áudio de sessão/mês (sessões × duração × 1,3). */
  audioMinutesPerMonth: number;
  aiInteractionsPerMonth: number;
  monthlyCents: number;
  /** Parcela mensal do ciclo anual (12% off). null = sem ciclo anual (FREE). */
  yearlyMonthlyCents: number | null;
  destaque: boolean;
  features: string[];
}

export const THERAPIST_PLANS: Record<TherapistPlanId, TherapistPlanDef> = {
  free: {
    id: 'free',
    nome: 'Plano Free',
    descricao: 'Experimente a plataforma sem custo',
    patientLimit: 1,
    sessionLimit: 4,
    sessionDurationMin: 50,
    audioMinutesPerMonth: computeAudioMinutesLimit(4, 50),
    aiInteractionsPerMonth: 20,
    monthlyCents: 0,
    yearlyMonthlyCents: null,
    destaque: false,
    features: [
      '1 paciente ativo',
      'Copiloto de IA',
      'Diário familiar & Portal',
    ],
  },
  standard: {
    id: 'standard',
    nome: 'Plano Standard',
    descricao: 'Para quem está começando ou com carteira enxuta',
    patientLimit: 10,
    sessionLimit: 40,
    sessionDurationMin: 60,
    audioMinutesPerMonth: computeAudioMinutesLimit(40, 60),
    aiInteractionsPerMonth: 750,
    monthlyCents: 23700,
    yearlyMonthlyCents: 20700,
    destaque: false,
    features: [
      'Atende até 10 pacientes ativos',
      'Copiloto de IA com integração com paciente',
      'Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA',
      'Inclusão de anexos e prontuários com interatividade da IA',
      'Diário familiar com áudios transcritos para o terapeuta em tempo real',
      'Compra adicional de pacote de pacientes a qualquer momento, dentro do seu acesso',
    ],
  },
  advanced: {
    id: 'advanced',
    nome: 'Plano Advanced',
    descricao: 'Para terapeutas com carteira consolidada',
    patientLimit: 20,
    sessionLimit: 80,
    sessionDurationMin: 60,
    audioMinutesPerMonth: computeAudioMinutesLimit(80, 60),
    aiInteractionsPerMonth: 1500,
    monthlyCents: 42700,
    yearlyMonthlyCents: 37700,
    destaque: true,
    features: [
      'Atende de 11 a 20 pacientes ativos',
      'Copiloto de IA com integração com paciente',
      'Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA',
      'Inclusão de anexos e prontuários com interatividade da IA',
      'Diário familiar com áudios transcritos para o terapeuta em tempo real',
      'Compra adicional de pacote de pacientes a qualquer momento, dentro do seu acesso',
    ],
  },
  premium: {
    id: 'premium',
    nome: 'Plano Premium',
    descricao: 'Máxima capacidade para carteira ampla',
    patientLimit: 30,
    sessionLimit: 120,
    sessionDurationMin: 60,
    audioMinutesPerMonth: computeAudioMinutesLimit(120, 60),
    aiInteractionsPerMonth: 2250,
    monthlyCents: 65700,
    yearlyMonthlyCents: 57700,
    destaque: false,
    features: [
      'Atende de 21 a 30 pacientes ativos',
      'Copiloto de IA com integração com paciente',
      'Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA',
      'Inclusão de anexos e prontuários com interatividade da IA',
      'Diário familiar com áudios transcritos para o terapeuta em tempo real',
      'Compra adicional de pacote de pacientes a qualquer momento, com desconto exclusivo',
    ],
  },
};

/** Módulos Adicionais (upsell): +5 pacientes ativos. */
export const PATIENT_ADDON_MODULES = {
  modulo_sa: {
    id: 'modulo_sa',
    nome: 'Módulo Adicional (+5 pacientes)',
    pacientesBonus: 5,
    sessoesBonus: 20,
    iaBonus: 375,
    audioBonusMinutes: computeAudioMinutesLimit(20, 60),
    monthlyCents: 12943,
    yearlyMonthlyCents: 11390,
    planosAplicaveis: ['standard', 'advanced'] as const,
  },
  modulo_p: {
    id: 'modulo_p',
    nome: 'Módulo Adicional Premium (+5 pacientes)',
    pacientesBonus: 5,
    sessoesBonus: 20,
    iaBonus: 375,
    audioBonusMinutes: computeAudioMinutesLimit(20, 60),
    monthlyCents: 10632,
    yearlyMonthlyCents: 9356,
    planosAplicaveis: ['premium'] as const,
  },
} as const;

export type PatientAddonModuleId = keyof typeof PATIENT_ADDON_MODULES;

export function addonModuleForPlan(planId: string): (typeof PATIENT_ADDON_MODULES)[PatientAddonModuleId] | null {
  if (planId === 'standard' || planId === 'advanced') return PATIENT_ADDON_MODULES.modulo_sa;
  if (planId === 'premium') return PATIENT_ADDON_MODULES.modulo_p;
  return null;
}

export const THERAPIST_PLAN_LIMITS: Record<TherapistPlanId, number> = {
  free: 1,
  standard: 10,
  advanced: 20,
  premium: 30,
};

export function isTherapistPlan(planId: string): planId is TherapistPlanId {
  return (THERAPIST_PLAN_IDS as readonly string[]).includes(planId);
}

export function isSoloSubscriptionPlan(planId: string): boolean {
  return isTherapistPlan(planId) || (LEGACY_SOLO_PLAN_IDS as readonly string[]).includes(planId);
}

export function therapistPlanPatientLimit(planId: string): number | null {
  if (isTherapistPlan(planId)) return THERAPIST_PLAN_LIMITS[planId];
  if (planId === 'inicial' || planId === 'consultorio') return 10;
  if (planId === 'intermediario') return 40;
  return null;
}

export function effectivePatientLimit(planBase: number | null, bonus: number): number | null {
  if (planBase === null) return null;
  return planBase + Math.max(0, bonus);
}

export function patientUsagePercent(activeCount: number, totalLimit: number): number {
  if (totalLimit <= 0) return activeCount > 0 ? 100 : 0;
  return Math.min(100, Math.round((activeCount / totalLimit) * 100));
}

/** Total do ciclo anual (12 parcelas com desconto). */
export function yearlyTotalCents(plan: TherapistPlanDef): number | null {
  if (plan.yearlyMonthlyCents === null) return null;
  return plan.yearlyMonthlyCents * 12;
}

/** Economia anual ao optar pelo ciclo anual. */
export function yearlySavingsCents(plan: TherapistPlanDef): number | null {
  if (plan.yearlyMonthlyCents === null) return null;
  return (plan.monthlyCents - plan.yearlyMonthlyCents) * 12;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Custo por paciente = valor do plano ÷ quantidade máxima de pacientes. */
export function costPerPatientCents(planPriceCents: number, patientLimit: number): number {
  if (patientLimit <= 0) return 0;
  return Math.round(planPriceCents / patientLimit);
}
