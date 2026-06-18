import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

function sanitizeOptionalText(max: number) {
  return z
    .string()
    .max(max)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t.length > 0 ? t : null;
    });
}

export const AnamnesisFieldsSchema = z.object({
  nome_social: sanitizeOptionalText(200),
  escolaridade_ocupacao: sanitizeOptionalText(300),
  queixa_principal: sanitizeOptionalText(5000),
  medicamentos: sanitizeOptionalText(3000),
  acompanhamento_multi: z
    .array(z.string().min(1).max(120))
    .max(30)
    .optional()
    .default([]),
  composicao_familiar: sanitizeOptionalText(5000),
  responsaveis: sanitizeOptionalText(2000),
  objetivos_terapeuticos: sanitizeOptionalText(5000),
  hiperfocos_interesses: sanitizeOptionalText(3000),
  informacoes_adicionais: sanitizeOptionalText(8000),
});

export type AnamnesisFields = z.infer<typeof AnamnesisFieldsSchema>;

export function anamnesisToDbRow(fields: AnamnesisFields): Record<string, unknown> {
  return {
    nome_social: fields.nome_social ?? null,
    escolaridade_ocupacao: fields.escolaridade_ocupacao ?? null,
    queixa_principal: fields.queixa_principal ?? null,
    medicamentos: fields.medicamentos ?? null,
    acompanhamento_multi: fields.acompanhamento_multi ?? [],
    composicao_familiar: fields.composicao_familiar ?? null,
    responsaveis: fields.responsaveis ?? null,
    objetivos_terapeuticos: fields.objetivos_terapeuticos ?? null,
    hiperfocos_interesses: fields.hiperfocos_interesses ?? null,
    informacoes_adicionais: fields.informacoes_adicionais ?? null,
  };
}

export function anamnesisPartialToDbRow(fields: Partial<AnamnesisFields>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (fields.nome_social !== undefined) row.nome_social = fields.nome_social ?? null;
  if (fields.escolaridade_ocupacao !== undefined) row.escolaridade_ocupacao = fields.escolaridade_ocupacao ?? null;
  if (fields.queixa_principal !== undefined) row.queixa_principal = fields.queixa_principal ?? null;
  if (fields.medicamentos !== undefined) row.medicamentos = fields.medicamentos ?? null;
  if (fields.acompanhamento_multi !== undefined) row.acompanhamento_multi = fields.acompanhamento_multi ?? [];
  if (fields.composicao_familiar !== undefined) row.composicao_familiar = fields.composicao_familiar ?? null;
  if (fields.responsaveis !== undefined) row.responsaveis = fields.responsaveis ?? null;
  if (fields.objetivos_terapeuticos !== undefined) row.objetivos_terapeuticos = fields.objetivos_terapeuticos ?? null;
  if (fields.hiperfocos_interesses !== undefined) row.hiperfocos_interesses = fields.hiperfocos_interesses ?? null;
  if (fields.informacoes_adicionais !== undefined) row.informacoes_adicionais = fields.informacoes_adicionais ?? null;
  return row;
}
