import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ProcessSessionTextSchema = z.object({
  patient_id: z.string().uuid(),
  anotacoes_texto: z.string().min(10).max(50000),
  schedule_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
});
