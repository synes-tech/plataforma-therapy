import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const FamilyCalendarSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  /** Apenas para auditoria — servidor ignora e usa vínculo real */
  patient_id: z.string().uuid().optional(),
});
