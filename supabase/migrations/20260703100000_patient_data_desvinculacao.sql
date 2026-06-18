-- ============================================================
-- Anti-Abuse: cooldown de 30 dias para reativação pós-desvínculo
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS data_desvinculacao TIMESTAMPTZ;

COMMENT ON COLUMN public.patients.data_desvinculacao IS
  'Timestamp do último desvínculo. NULL quando ativo. Trava reativação por 30 dias.';

CREATE INDEX IF NOT EXISTS idx_patients_data_desvinculacao
  ON public.patients (data_desvinculacao)
  WHERE deleted_at IS NULL AND data_desvinculacao IS NOT NULL;
