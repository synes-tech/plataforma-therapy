import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ProcessClinicalReturnSchema = z.object({
  audio_recording_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  job_id: z.string().uuid(),
});
