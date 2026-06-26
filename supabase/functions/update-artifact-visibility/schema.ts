import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const UpdateArtifactVisibilitySchema = z.object({
  artifact_id: z.string().uuid(),
  compartilhado_familia: z.boolean(),
});
