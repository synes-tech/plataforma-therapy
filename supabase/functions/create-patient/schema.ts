import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { AnamnesisFieldsSchema } from '../_shared/patient-anamnesis-schema.ts';
import { isValidCpfFormat, normalizeCpf } from '../_shared/cpf.ts';

const cpfSchema = z
  .string()
  .min(11)
  .max(14)
  .transform((v) => normalizeCpf(v))
  .refine((v) => isValidCpfFormat(v), { message: 'CPF inválido' });

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
});

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

export const CreatePatientSchema = z.union([
  withOwnCpfSchema,
  dependentSchema,
  legacyCpfSchema,
]);
