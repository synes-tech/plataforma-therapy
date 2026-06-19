import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ARTIFACT_FILTER_TYPES = [
  'todos',
  'acao_recomendada',
  'resumo_proativo',
  'relatorio_sessao',
] as const;

export const GetPatientArtifactsSchema = z.object({
  patient_id: z.string().uuid(),
  filtro_tipo: z.enum(ARTIFACT_FILTER_TYPES).optional().default('todos'),
});
