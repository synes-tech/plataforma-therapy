-- Unithery — Prompt 8: retroalimentação clínica consentida (ADR-06)
-- O chat cru NÃO entra no RAG. Só o resumo semanal, e só com opt-in.

BEGIN;

ALTER TABLE public.patient_embeddings
  DROP CONSTRAINT IF EXISTS patient_embeddings_document_type_check;

ALTER TABLE public.patient_embeddings
  ADD CONSTRAINT patient_embeddings_document_type_check
  CHECK (document_type IN (
    'session_note',
    'transcription',
    'diary_entry',
    'onboarding',
    'patient_attachment',
    'companion_summary'
  ));

CREATE TABLE IF NOT EXISTS companion_clinical_summaries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  summary        text NOT NULL,
  model          text,
  message_count  integer NOT NULL DEFAULT 0,
  tokens_used    integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companion_clinical_summaries_period_ck CHECK (period_end >= period_start)
);

COMMENT ON TABLE companion_clinical_summaries IS
  'Resumo clínico em terceira pessoa do Acompanhante. Nunca contém transcrição literal do chat (ADR-06). É o único insumo B2C que pode ir para patient_embeddings.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_companion_clinical_summaries_period
  ON companion_clinical_summaries (patient_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_companion_clinical_summaries_clinic
  ON companion_clinical_summaries (clinic_id, period_end DESC);

ALTER TABLE companion_clinical_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_summaries_master ON companion_clinical_summaries;
CREATE POLICY companion_summaries_master ON companion_clinical_summaries
  FOR ALL USING ((auth.app_metadata() ->> 'role') = 'master');

-- Terapeuta só lê se o paciente optou pelo compartilhamento.
DROP POLICY IF EXISTS companion_summaries_clinic_read ON companion_clinical_summaries;
CREATE POLICY companion_summaries_clinic_read ON companion_clinical_summaries
  FOR SELECT USING (
    patient_id IN (SELECT public.clinic_patient_ids())
    AND public.patient_allows_summary_sharing(patient_id)
  );

-- O paciente vê exatamente o que o terapeuta receberia (transparência do ADR-06).
DROP POLICY IF EXISTS companion_summaries_portal_read ON companion_clinical_summaries;
CREATE POLICY companion_summaries_portal_read ON companion_clinical_summaries
  FOR SELECT USING (patient_id IN (SELECT public.portal_self_patient_ids()));

GRANT SELECT ON companion_clinical_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON companion_clinical_summaries TO unithery_app;

COMMIT;
