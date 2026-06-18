import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const DeleteSavedRecommendationSchema = z.object({
  patient_id: z.string().uuid(),
  recommendation_id: z.string().uuid(),
});
