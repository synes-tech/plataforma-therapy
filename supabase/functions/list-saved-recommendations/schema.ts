import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ListSavedRecommendationsSchema = z.object({
  patient_id: z.string().uuid(),
});
