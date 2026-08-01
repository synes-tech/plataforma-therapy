import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { AnamnesisFieldsSchema } from '../_shared/patient-anamnesis-schema.ts';
import { isValidCpfFormat, normalizeCpf } from '../_shared/cpf.ts';

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

const commercialFields = z.object({
  financeiro_modelo: z.enum(['avulso', 'pacote', 'social']).optional(),
  financeiro_valor_sessao_cents: z.number().int().min(0).optional(),
  financeiro_pacote_qtd_sessoes: z.number().int().positive().optional().nullable(),
  financeiro_pacote_valor_cents: z.number().int().min(0).optional().nullable(),
  financeiro_registrar_pacote_pago: z.boolean().optional().default(false),
  financeiro_observacoes: z.string().max(2000).optional().nullable(),
});

const baseFields = z.object({
  name: z.string().min(2).max(200).transform((v) => v.trim()),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'not_informed']).default('not_informed'),
  diagnoses: z.array(z.string().min(1).max(200)).min(1, 'At least one diagnosis required'),
  clinical_observations: z
    .string()
    .max(5000)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t.length > 0 ? t : null;
    }),
}).merge(contactFields).merge(commercialFields);

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

export const CreatePatientSchema = z.union([
  refineContactEmails(withOwnCpfSchema),
  refineContactEmails(dependentSchema),
  refineContactEmails(legacyCpfSchema),
]);
