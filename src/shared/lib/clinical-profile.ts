/**
 * Ontologia clínica do paciente — espelho em TypeScript dos ENUMs e regras gravados no
 * Cloud SQL pela migration 20260822160000_b2b_b2c_portal_foundation.
 *
 * A derivação de perfil por idade existe nos dois lados de propósito: o banco garante a
 * consistência do dado, e o cliente precisa da mesma regra para montar o formulário certo
 * antes de qualquer round-trip. Se divergirem, o banco vence.
 */

export const PATIENT_PROFILE_TYPES = ['CHILD', 'ADOLESCENT', 'ADULT'] as const;
export type PatientProfileType = (typeof PATIENT_PROFILE_TYPES)[number];

export const CLINICAL_MODULES = [
  'CLINICO_GERAL',
  'NEURODESENVOLVIMENTO',
  'PERINATAL',
  'LUTO',
  'DEPENDENCIA_QUIMICA',
] as const;
export type ClinicalModule = (typeof CLINICAL_MODULES)[number];

export const PORTAL_ACCESS_LEVELS = ['CAREGIVER', 'SELF'] as const;
export type PortalAccessLevel = (typeof PORTAL_ACCESS_LEVELS)[number];

export const PATIENT_AUTONOMY_LEVELS = ['SELF_MANAGED', 'SUPPORTED', 'DEPENDENT'] as const;
export type PatientAutonomyLevel = (typeof PATIENT_AUTONOMY_LEVELS)[number];

export const CLINICAL_RISK_LEVELS = ['LOW', 'MODERATE', 'SEVERE'] as const;
export type ClinicalRiskLevel = (typeof CLINICAL_RISK_LEVELS)[number];

/** Módulo base, presente em todo paciente. Não é opcional nem removível. */
export const BASE_MODULE: ClinicalModule = 'CLINICO_GERAL';

/** Idade mínima para assinar o Acompanhante por conta própria (capacidade civil). */
export const PREMIUM_MIN_AGE = 18;

export const PROFILE_LABELS: Record<PatientProfileType, string> = {
  CHILD: 'Criança',
  ADOLESCENT: 'Adolescente',
  ADULT: 'Adulto',
};

export const MODULE_LABELS: Record<ClinicalModule, string> = {
  CLINICO_GERAL: 'Clínico geral',
  NEURODESENVOLVIMENTO: 'Neurodesenvolvimento',
  PERINATAL: 'Perinatal',
  LUTO: 'Luto',
  DEPENDENCIA_QUIMICA: 'Dependência química',
};

/** Só faz sentido oferecer os módulos que já têm experiência construída. */
export const AVAILABLE_MODULES: ClinicalModule[] = ['CLINICO_GERAL', 'NEURODESENVOLVIMENTO'];

export function calculateAge(birthDate: string | Date, reference: Date = new Date()): number {
  const birth = typeof birthDate === 'string' ? new Date(`${birthDate.slice(0, 10)}T00:00:00`) : birthDate;
  if (Number.isNaN(birth.getTime())) return Number.NaN;

  let age = reference.getFullYear() - birth.getFullYear();
  const monthDelta = reference.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && reference.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Mesma regra do public.derive_profile_type(date) no Postgres. */
export function deriveProfileType(
  birthDate: string | Date | null | undefined,
  reference: Date = new Date(),
): PatientProfileType {
  if (!birthDate) return 'ADULT';
  const age = calculateAge(birthDate, reference);
  if (Number.isNaN(age)) return 'ADULT';
  if (age < 13) return 'CHILD';
  if (age < 18) return 'ADOLESCENT';
  return 'ADULT';
}

export function defaultAutonomyForProfile(profile: PatientProfileType): PatientAutonomyLevel {
  if (profile === 'CHILD') return 'DEPENDENT';
  if (profile === 'ADOLESCENT') return 'SUPPORTED';
  return 'SELF_MANAGED';
}

/**
 * Nível de acesso padrão do portal. Criança sempre pelo responsável; adolescente também,
 * porque o acesso SELF depende de consentimento registrado do responsável.
 */
export function defaultPortalAccessLevel(profile: PatientProfileType): PortalAccessLevel {
  return profile === 'ADULT' ? 'SELF' : 'CAREGIVER';
}

export function hasModule(modules: readonly ClinicalModule[] | null | undefined, module: ClinicalModule): boolean {
  return Boolean(modules?.includes(module));
}

/** Garante o módulo base e remove duplicatas, preservando a ordem de exibição. */
export function normalizeModules(modules: readonly ClinicalModule[] | null | undefined): ClinicalModule[] {
  const set = new Set<ClinicalModule>([BASE_MODULE, ...(modules ?? [])]);
  return CLINICAL_MODULES.filter((module) => set.has(module));
}

export function isMinor(birthDate: string | Date | null | undefined, reference: Date = new Date()): boolean {
  return deriveProfileType(birthDate, reference) !== 'ADULT';
}

/** O premium B2C é restrito a maiores de idade (capacidade civil e LGPD art. 14). */
export function canSubscribePremium(
  birthDate: string | Date | null | undefined,
  reference: Date = new Date(),
): boolean {
  if (!birthDate) return false;
  const age = calculateAge(birthDate, reference);
  return !Number.isNaN(age) && age >= PREMIUM_MIN_AGE;
}

/**
 * Acesso SELF de adolescente exige consentimento do responsável; adulto não exige nada;
 * criança nunca tem SELF.
 */
export function canGrantSelfAccess(
  profile: PatientProfileType,
  hasGuardianConsent: boolean,
): boolean {
  if (profile === 'ADULT') return true;
  if (profile === 'ADOLESCENT') return hasGuardianConsent;
  return false;
}
