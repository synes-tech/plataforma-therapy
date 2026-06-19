-- Artefatos salvos do Copiloto (Save As) — extensão de recomendacoes_salvas
ALTER TABLE recomendacoes_salvas
  ADD COLUMN IF NOT EXISTS tipo_artefato TEXT,
  ADD COLUMN IF NOT EXISTS conteudo_texto TEXT,
  ADD COLUMN IF NOT EXISTS artifact_fingerprint TEXT;

ALTER TABLE recomendacoes_salvas
  DROP CONSTRAINT IF EXISTS recomendacoes_salvas_tipo_artefato_check;

ALTER TABLE recomendacoes_salvas
  ADD CONSTRAINT recomendacoes_salvas_tipo_artefato_check
  CHECK (
    tipo_artefato IS NULL
    OR tipo_artefato IN ('acao_recomendada', 'resumo_proativo', 'relatorio_sessao')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_recomendacoes_artifact_dedup
  ON recomendacoes_salvas (paciente_id, terapeuta_id, tipo_artefato, artifact_fingerprint)
  WHERE artifact_fingerprint IS NOT NULL AND tipo_artefato IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recomendacoes_artifact_patient
  ON recomendacoes_salvas (paciente_id, tipo_artefato, criado_em DESC)
  WHERE tipo_artefato IS NOT NULL;
