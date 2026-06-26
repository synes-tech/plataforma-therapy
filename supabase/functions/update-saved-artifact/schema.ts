import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const UpdateSavedArtifactSchema = z.object({
  patient_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  titulo: z.string().trim().max(200).nullable().optional(),
  conteudo_texto: z.string().trim().min(1).max(100_000),
});

export type UpdateSavedArtifactInput = z.infer<typeof UpdateSavedArtifactSchema>;
