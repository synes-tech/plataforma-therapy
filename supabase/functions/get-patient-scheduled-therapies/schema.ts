import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ScheduledTherapiesSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  /** Ignorado pelo servidor — vínculo real via patient_family_links (anti-IDOR) */
  patient_id: z.string().uuid().optional(),
});

export type ScheduledTherapiesInput = z.infer<typeof ScheduledTherapiesSchema>;
