-- ============================================================
-- Recomendações salvas — histórico por paciente/terapeuta
-- Agentes: DBA + Segurança
-- ============================================================

CREATE TABLE IF NOT EXISTS recomendacoes_salvas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  clinica_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  conteudo JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recomendacoes_salvas_paciente
  ON recomendacoes_salvas (paciente_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_recomendacoes_salvas_terapeuta
  ON recomendacoes_salvas (terapeuta_id, criado_em DESC);

ALTER TABLE recomendacoes_salvas ENABLE ROW LEVEL SECURITY;

-- Master
DROP POLICY IF EXISTS "recomendacoes_master_all" ON recomendacoes_salvas;
CREATE POLICY "recomendacoes_master_all"
  ON recomendacoes_salvas FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master');

-- Profissional: SELECT/INSERT apenas da própria carteira
DROP POLICY IF EXISTS "recomendacoes_professional_select" ON recomendacoes_salvas;
CREATE POLICY "recomendacoes_professional_select"
  ON recomendacoes_salvas FOR SELECT
  USING (
    terapeuta_id IN (
      SELECT p.id FROM professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "recomendacoes_professional_insert" ON recomendacoes_salvas;
CREATE POLICY "recomendacoes_professional_insert"
  ON recomendacoes_salvas FOR INSERT
  WITH CHECK (
    terapeuta_id IN (
      SELECT p.id FROM professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND paciente_id IN (
      SELECT pat.id FROM patients pat
      WHERE pat.professional_id = terapeuta_id AND pat.deleted_at IS NULL
    )
  );

-- Clinic admin: SELECT de recomendações da clínica
DROP POLICY IF EXISTS "recomendacoes_clinic_admin_select" ON recomendacoes_salvas;
CREATE POLICY "recomendacoes_clinic_admin_select"
  ON recomendacoes_salvas FOR SELECT
  USING (
    clinica_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
  );

GRANT SELECT, INSERT ON recomendacoes_salvas TO authenticated;
