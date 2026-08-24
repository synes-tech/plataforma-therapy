import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { AnamnesisFieldsSchema } from '../_shared/patient-anamnesis-schema.ts';
import { CreatePatientFinanceSchema } from '../_shared/financeiro-contract.ts';
import { isValidCpfFormat, normalizeCpf } from '../_shared/cpf.ts';
import {
  CLINICAL_MODULES,
  PATIENT_PROFILE_TYPES,
  type ProfileRequirementInput,
  validateProfileRequirements,
} from '../_shared/patient-profile.ts';

const cpfSchema = z
  .string()
  .min(11)
  .max(14)
  .transform((v) => normalizeCpf(v))
  .refine((v) => isValidCpfFormat(v), { message: 'CPF inválido' });

const optionalEmail = z
  .string()
  .max(254)
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v.trim().toLowerCase();
    return t.length > 0 ? t : null;
  })
  .refine((v) => v === undefined || v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'E-mail inválido',
  });

const optionalPhone = z
  .string()
  .max(20)
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const digits = v.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
  });

const contactFields = z.object({
  contact_scope: z.enum(['patient', 'responsible', 'both']).optional(),
  email_paciente: optionalEmail,
  telefone_paciente: optionalPhone,
  email_responsavel: optionalEmail,
  telefone_responsavel: optionalPhone,
});

const commercialFields = CreatePatientFinanceSchema;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t.length > 0 ? t : null;
    });

/**
 * Campos da ontologia universal.
 *
 * `profile_type` é opcional de propósito. O wizard só passa a enviá-lo na próxima entrega,
 * e torná-lo obrigatório agora quebraria o cadastro de paciente em produção. Quando vem
 * ausente, o backend deriva da data de nascimento; quando vem preenchido, é conferido
 * contra a data — um cliente não decide sozinho que uma criança de 6 anos é adulta.
 */
const ontologyFields = z.object({
  profile_type: z.enum(PATIENT_PROFILE_TYPES).optional(),
  active_modules: z.array(z.enum(CLINICAL_MODULES)).max(5).optional(),
  condition_ids: z.array(z.string().uuid()).max(20).optional(),
  support_network: optionalText(5000),
  occupation_routine: optionalText(3000),
  mapped_triggers: optionalText(3000),
  portal_invite: z
    .object({
      send: z.boolean().default(true),
      email: optionalEmail,
      name: optionalText(200),
      relationship: optionalText(80),
      expires_in_hours: z.number().int().min(1).max(168).optional(),
    })
    .optional(),
});

const baseFields = z.object({
  name: z.string().min(2).max(200).transform((v) => v.trim()),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'not_informed']).default('not_informed'),
  // Texto livre continua aceito: a taxonomia é a fonte da verdade, mas o terapeuta pode
  // registrar uma condição que ainda não está no catálogo. Um dos dois é exigido no refine.
  diagnoses: z.array(z.string().min(1).max(200)).max(20).optional(),
  clinical_observations: optionalText(5000),
}).merge(contactFields).merge(commercialFields).merge(ontologyFields);

const withOwnCpfSchema = baseFields
  .extend({
    possui_cpf_proprio: z.literal(true),
    cpf_paciente: cpfSchema,
  })
  .merge(AnamnesisFieldsSchema);

const dependentSchema = baseFields
  .extend({
    possui_cpf_proprio: z.literal(false),
    cpf_responsavel: cpfSchema,
    nome_responsavel: z.string().min(2).max(200).transform((v) => v.trim()),
  })
  .merge(AnamnesisFieldsSchema);

/** Compat: payload legado com campo `cpf` */
const legacyCpfSchema = baseFields
  .extend({
    cpf: cpfSchema,
  })
  .merge(AnamnesisFieldsSchema)
  .transform((data) => ({
    ...data,
    possui_cpf_proprio: true as const,
    cpf_paciente: data.cpf,
  }));

function refineFinance<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: Record<string, unknown>, ctx) => {
    const hasNew = Boolean(data.financeiro_model_type && data.financeiro_billing_type);
    const hasLegacy = Boolean(data.financeiro_modelo);
    if (!hasNew && !hasLegacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Defina o contrato financeiro (particular/convênio e forma de cobrança).',
        path: ['financeiro_billing_type'],
      });
    }
    if (data.financeiro_billing_type === 'MENSAL_RECORRENTE') {
      if (data.financeiro_due_day == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o dia de vencimento (1 a 28).',
          path: ['financeiro_due_day'],
        });
      }
      if (data.financeiro_sessions_per_month == null && !data.financeiro_sessions_custom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe as sessões por mês.',
          path: ['financeiro_sessions_per_month'],
        });
      }
      if (data.financeiro_valor_acordado_cents == null && data.financeiro_valor_sessao_cents == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o valor mensal acordado.',
          path: ['financeiro_valor_acordado_cents'],
        });
      }
    }
    if (data.financeiro_billing_type === 'AVULSO' || data.financeiro_modelo === 'avulso' || data.financeiro_modelo === 'social') {
      if (
        data.financeiro_valor_acordado_cents == null &&
        data.financeiro_valor_sessao_cents == null &&
        hasNew
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe o valor acordado da sessão.',
          path: ['financeiro_valor_acordado_cents'],
        });
      }
    }
  });
}

function refineContactEmails<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: Record<string, unknown>, ctx) => {
    const scope = data.contact_scope as string | undefined;
    if (!scope) return;

    if ((scope === 'patient' || scope === 'both') && !data.email_paciente) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o e-mail do paciente',
        path: ['email_paciente'],
      });
    }
    if ((scope === 'responsible' || scope === 'both') && !data.email_responsavel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o e-mail do responsável',
        path: ['email_responsavel'],
      });
    }
  });
}

/**
 * Validação condicional da ontologia — o coração do onboarding universal.
 *
 * O formulário de uma criança e o de um adulto não são o mesmo formulário com campos a
 * mais: são contratos diferentes. Para a criança, quem responde é um terceiro, e sem
 * responsável identificado o portal não tem para quem ir. Para o adulto, quem responde é
 * ele, e perguntar "dinâmica familiar" é invasivo e fora de contexto — o equivalente útil
 * é a rede de apoio.
 *
 * As exigências condicionais só valem para clientes que declaram `profile_type`. O wizard
 * atual em produção ainda não declara, e nele "responsáveis" e "composição familiar" são
 * campos livres opcionais: aplicar a regra nova de imediato quebraria o cadastro de
 * paciente para as clínicas ativas. Enquanto o cliente não adere, valem as regras antigas
 * e o perfil é derivado da data de nascimento no backend.
 */
function refineProfile<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: Record<string, unknown>, ctx) => {
    for (const issue of validateProfileRequirements(data as ProfileRequirementInput)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: [issue.path],
      });
    }
  });
}

const applyRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  refineProfile(refineFinance(refineContactEmails(schema)));

export const CreatePatientSchema = z.union([
  applyRefinements(withOwnCpfSchema),
  applyRefinements(dependentSchema),
  applyRefinements(legacyCpfSchema),
]);
