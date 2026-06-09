import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const UploadAudioSchema = z.object({
  patient_id: z.string().uuid(),
  recording_type: z.enum(['onboarding', 'post_session', 'note']),
  duration_seconds: z.number().int().min(1).max(600).optional(), // Max 10 min
});
