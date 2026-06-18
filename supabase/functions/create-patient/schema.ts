import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { AnamnesisFieldsSchema } from '../_shared/patient-anamnesis-schema.ts';
import { isValidCpfFormat, normalizeCpf } from '../_shared/cpf.ts';

const cpfSchema = z
  .string()
  .min(11)
  .max(14)
  .transform((v) => normalizeCpf(v))
  .refine((v) => isValidCpfFormat(v), { message: 'CPF inválido' });

export const CreatePatientSchema = z
  .object({
    cpf: cpfSchema,
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
  })
  .merge(AnamnesisFieldsSchema);
