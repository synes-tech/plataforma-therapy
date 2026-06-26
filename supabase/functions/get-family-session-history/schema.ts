import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GetFamilySessionHistorySchema = z.object({
  patient_id: z.string().uuid().optional(),
  page: z.number().int().min(1).optional(),
  page_size: z.number().int().min(1).max(50).optional(),
});

export type GetFamilySessionHistoryInput = z.infer<typeof GetFamilySessionHistorySchema>;
