import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const DuplicateSavedArtifactSchema = z.object({
  patient_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
});

export type DuplicateSavedArtifactInput = z.infer<typeof DuplicateSavedArtifactSchema>;
