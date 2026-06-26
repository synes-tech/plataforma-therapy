-- Controle de visibilidade granular — artefatos salvos do Copiloto de IA
-- Default false: nada vaza para a família sem opt-in explícito do terapeuta.

ALTER TABLE recomendacoes_salvas
  ADD COLUMN IF NOT EXISTS compartilhado_familia BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN recomendacoes_salvas.compartilhado_familia IS
  'Se true, artefato visível no app da família. Default false = sigilo clínico / uso interno.';

UPDATE recomendacoes_salvas
SET compartilhado_familia = false
WHERE compartilhado_familia IS DISTINCT FROM false;

CREATE INDEX IF NOT EXISTS idx_recomendacoes_familia_shared
  ON recomendacoes_salvas (paciente_id, criado_em DESC)
  WHERE compartilhado_familia = true AND tipo_artefato IS NOT NULL;

-- Família: SELECT apenas artefatos explicitamente compartilhados do paciente vinculado
DROP POLICY IF EXISTS "recomendacoes_family_view_shared" ON recomendacoes_salvas;
CREATE POLICY "recomendacoes_family_view_shared"
  ON recomendacoes_salvas FOR SELECT
  USING (
    compartilhado_familia = true
    AND tipo_artefato IS NOT NULL
    AND paciente_id IN (
      SELECT pfl.patient_id
      FROM public.patient_family_links pfl
      WHERE pfl.user_id = auth.uid()
    )
  );
