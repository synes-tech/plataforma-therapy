import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const PatientCrisisCalendarSchema = z.object({
  patient_id: z.string().uuid('patient_id deve ser um UUID válido'),
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

export type PatientCrisisCalendarInput = z.infer<typeof PatientCrisisCalendarSchema>;
