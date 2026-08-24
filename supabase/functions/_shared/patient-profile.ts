/**
 * Ontologia clínica do paciente no backend.
 *
 * Mesmas regras de public.derive_profile_type / default_autonomy_for_profile no Cloud SQL
 * e de src/shared/lib/clinical-profile.ts no PWA. A duplicação é intencional: o banco
 * garante consistência, o backend decide o roteamento do convite antes de escrever, e o
 * cliente monta o formulário antes de qualquer round-trip.
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

export const BASE_MODULE: ClinicalModule = 'CLINICO_GERAL';

export function calculateAge(birthDate: string, reference: Date = new Date()): number {
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return Number.NaN;

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = reference.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && reference.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function deriveProfileType(
  birthDate: string | null | undefined,
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

/** Garante o módulo base e remove duplicatas, mantendo a ordem canônica. */
export function normalizeModules(modules: readonly string[] | null | undefined): ClinicalModule[] {
  const requested = new Set<string>([BASE_MODULE, ...(modules ?? [])]);
  return CLINICAL_MODULES.filter((module) => requested.has(module));
}

export interface ProfileRequirementIssue {
  path: string;
  message: string;
}

export interface ProfileRequirementInput {
  birth_date?: string | null;
  profile_type?: string | null;
  diagnoses?: unknown;
  condition_ids?: unknown;
  email_paciente?: unknown;
  email_responsavel?: unknown;
  responsaveis?: unknown;
  composicao_familiar?: unknown;
}

/**
 * Regras condicionais do onboarding universal, isoladas do Zod para poderem ser testadas
 * sem um runtime Deno.
 *
 * As exigências por perfil só valem para clientes que declaram `profile_type`. O wizard em
 * produção ainda não declara, e nele "responsáveis" e "composição familiar" são opcionais:
 * aplicar a regra nova de imediato quebraria o cadastro das clínicas ativas.
 */
export function validateProfileRequirements(
  data: ProfileRequirementInput,
  reference: Date = new Date(),
): ProfileRequirementIssue[] {
  const issues: ProfileRequirementIssue[] = [];

  const hasFreeText = Array.isArray(data.diagnoses) && data.diagnoses.length > 0;
  const hasTaxonomy = Array.isArray(data.condition_ids) && data.condition_ids.length > 0;
  if (!hasFreeText && !hasTaxonomy) {
    issues.push({
      path: 'condition_ids',
      message: 'Informe ao menos uma condição ou foco clínico.',
    });
  }

  const declared = data.profile_type ?? undefined;
  if (!declared) return issues;

  const derived = deriveProfileType(data.birth_date, reference);
  if (declared !== derived) {
    issues.push({
      path: 'profile_type',
      message: `Perfil "${declared}" não confere com a data de nascimento (${derived}).`,
    });
    return issues;
  }

  if (declared === 'ADULT') {
    if (!data.email_paciente) {
      issues.push({
        path: 'email_paciente',
        message: 'Para paciente adulto, o e-mail do próprio paciente é obrigatório.',
      });
    }
    return issues;
  }

  if (!data.responsaveis) {
    issues.push({ path: 'responsaveis', message: 'Informe o(s) responsável(is) pelo paciente.' });
  }
  if (!data.composicao_familiar) {
    issues.push({
      path: 'composicao_familiar',
      message: 'Descreva a composição/dinâmica familiar.',
    });
  }
  if (!data.email_responsavel) {
    issues.push({
      path: 'email_responsavel',
      message: 'Para paciente menor de idade, o e-mail do responsável é obrigatório.',
    });
  }

  return issues;
}

/**
 * Quem recebe o convite do portal, e com qual nível.
 *
 * A regra combina duas coisas: a idade define o que é *permitido*, e a escolha do terapeuta
 * define o que é *desejado*.
 *
 * Menor de idade sempre entra por um responsável (CAREGIVER), independente do que o
 * terapeuta escolha — o acesso SELF de adolescente existe, mas depende de consentimento
 * registrado do responsável e não é concedido no cadastro.
 *
 * Adulto normalmente entra como SELF. Mas um adulto com apoio (curatela, TEA adulto,
 * quadro grave) pode ter o acompanhamento feito por um cuidador: quando o terapeuta marca
 * o contato apenas do responsável, o convite vai para o cuidador como CAREGIVER. Sem isso,
 * o convite seria emitido como SELF para o e-mail de outra pessoa — que passaria a ter
 * acesso ao espaço pessoal do paciente.
 */
export function resolveInviteRouting(params: {
  profileType: PatientProfileType;
  contactScope?: 'patient' | 'responsible' | 'both' | null;
  emailPaciente?: string | null;
  emailResponsavel?: string | null;
  nomePaciente: string;
  nomeResponsavel?: string | null;
  relationship?: string | null;
}): {
  accessLevel: PortalAccessLevel;
  email: string | null;
  name: string;
  relationship: string;
  recipient: 'patient' | 'caregiver';
} {
  const caregiver = {
    accessLevel: 'CAREGIVER' as const,
    email: params.emailResponsavel ?? null,
    name: params.nomeResponsavel ?? 'responsável',
    relationship: params.relationship ?? 'responsável',
    recipient: 'caregiver' as const,
  };

  if (params.profileType !== 'ADULT') return caregiver;

  const scope = params.contactScope ?? 'patient';
  if (scope === 'responsible') return caregiver;

  return {
    accessLevel: 'SELF',
    email: params.emailPaciente ?? null,
    name: params.nomePaciente,
    relationship: params.relationship ?? 'o próprio paciente',
    recipient: 'patient',
  };
}
