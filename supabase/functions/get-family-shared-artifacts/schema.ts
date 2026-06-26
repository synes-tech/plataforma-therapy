import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const GetFamilySharedArtifactsSchema = z.object({
  patient_id: z.string().uuid().optional(),
});
