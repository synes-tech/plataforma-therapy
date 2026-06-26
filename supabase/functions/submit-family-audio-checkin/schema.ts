import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const SubmitFamilyAudioCheckinSchema = z.object({
  patient_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transcricao: z.string().min(10).max(8000),
  audio_note_url: z.string().min(10).max(500),
  duration_seconds: z.number().int().min(1).max(300).optional(),
});
