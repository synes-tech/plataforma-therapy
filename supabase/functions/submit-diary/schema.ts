import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const SubmitDiarySchema = z.object({
  patient_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Defaults to today
  mood_score: z.number().int().min(1).max(5),
  sleep_quality: z.number().int().min(1).max(5),
  crisis_occurred: z.boolean().default(false),
  crisis_level: z.number().int().min(1).max(5).optional(),
  categories: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional(),
  audio_note_url: z.string().max(500).optional(),
  transcricao: z.string().max(5000).optional(),
});
