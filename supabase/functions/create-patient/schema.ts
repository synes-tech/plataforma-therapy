import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const CreatePatientSchema = z.object({
  name: z.string().min(2).max(200),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'not_informed']).default('not_informed'),
  diagnoses: z.array(z.string().min(1).max(200)).min(1, 'At least one diagnosis required'),
  clinical_observations: z.string().max(5000).optional(),
});
