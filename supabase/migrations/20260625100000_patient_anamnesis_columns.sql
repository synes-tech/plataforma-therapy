-- ============================================================
-- Anamnese Clínica Inteligente — novos campos em patients
-- Agentes: DBA + Segurança (RLS inalterada — policies por linha)
-- ============================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS nome_social TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade_ocupacao TEXT,
  ADD COLUMN IF NOT EXISTS queixa_principal TEXT,
  ADD COLUMN IF NOT EXISTS medicamentos TEXT,
  ADD COLUMN IF NOT EXISTS acompanhamento_multi JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS composicao_familiar TEXT,
  ADD COLUMN IF NOT EXISTS responsaveis TEXT,
  ADD COLUMN IF NOT EXISTS objetivos_terapeuticos TEXT,
  ADD COLUMN IF NOT EXISTS hiperfocos_interesses TEXT,
  ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;

COMMENT ON COLUMN patients.nome_social IS 'Nome social do paciente (opcional)';
COMMENT ON COLUMN patients.acompanhamento_multi IS 'Lista de acompanhamentos multidisciplinares (JSON array de strings)';

-- Índice GIN para buscas futuras em acompanhamento
CREATE INDEX IF NOT EXISTS idx_patients_acompanhamento_multi
  ON patients USING GIN (acompanhamento_multi)
  WHERE deleted_at IS NULL;
