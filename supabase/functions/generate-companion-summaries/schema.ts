import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GenerateCompanionSummariesSchema = z.object({
  patient_id: z.string().uuid().optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type GenerateCompanionSummariesPayload = z.infer<typeof GenerateCompanionSummariesSchema>;
