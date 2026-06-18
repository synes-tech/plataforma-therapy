import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GetPatientSessionsSchema = z.object({
  patient_id: z.string().uuid(),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(50).optional().default(10),
});
