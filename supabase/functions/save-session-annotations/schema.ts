import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const SaveSessionAnnotationsSchema = z.object({
  patient_id: z.string().uuid(),
  anotacoes_texto: z.string().max(50000).nullable(),
  audio_recording_id: z.string().uuid().optional(),
  schedule_id: z.string().uuid().optional(),
});
