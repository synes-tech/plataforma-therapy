import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { AnamnesisFieldsSchema } from '../_shared/patient-anamnesis-schema.ts';

const optionalCore = {
  name: z.string().min(2).max(200).transform((v) => v.trim()).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  gender: z.enum(['male', 'female', 'other', 'not_informed']).optional(),
  diagnoses: z.array(z.string().min(1).max(200)).min(1).optional(),
  clinical_observations: z
    .string()
    .max(5000)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t.length > 0 ? t : null;
    }),
};

export const UpdatePatientSchema = z
  .object({
    patient_id: z.string().uuid(),
    ...optionalCore,
  })
  .merge(AnamnesisFieldsSchema.partial());
