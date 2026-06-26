import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const SaveAiArtifactSchema = z.object({
  patient_id: z.string().uuid(),
  conteudo_texto: z.string().min(10).max(50000),
  tipo_artefato: z.enum(['acao_recomendada', 'resumo_proativo', 'relatorio_sessao']),
  compartilhado_familia: z.boolean().optional().default(false),
});
