-- ============================================================
-- Gerenciamento de Vínculo de Pacientes — Fase 1 (Motor de Dados)
-- Agentes: DBA + Segurança + Backend
-- ============================================================

-- Enum de vínculo (distinto de entity_status: active/inactive/suspended)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_vinculo_status') THEN
    CREATE TYPE patient_vinculo_status AS ENUM ('ativo', 'desvinculado');
  END IF;
END$$;

-- ------------------------------------------------------------
-- patients: CPF + status de vínculo
-- ------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(11),
  ADD COLUMN IF NOT EXISTS status_vinculo patient_vinculo_status NOT NULL DEFAULT 'ativo';

COMMENT ON COLUMN public.patients.cpf IS
  'CPF somente dígitos (11). Único por profissional quando preenchido.';
COMMENT ON COLUMN public.patients.status_vinculo IS
  'ativo = ocupa cota do plano; desvinculado = arquivado (consome licença de backup).';

UPDATE public.patients
SET status_vinculo = 'ativo'
WHERE status_vinculo IS NULL;

-- Índices de busca e contagem de cotas
CREATE INDEX IF NOT EXISTS idx_patients_cpf_search
  ON public.patients (cpf)
  WHERE deleted_at IS NULL AND cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_prof_vinculo
  ON public.patients (professional_id, status_vinculo)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_professional_cpf_unique
  ON public.patients (professional_id, cpf)
  WHERE cpf IS NOT NULL AND deleted_at IS NULL;

-- Reforço paywall: conta apenas vínculos ativos
DROP INDEX IF EXISTS public.idx_patients_prof_paywall_count;
CREATE INDEX idx_patients_prof_paywall_count
  ON public.patients (professional_id)
  WHERE deleted_at IS NULL
    AND status = 'active'
    AND status_vinculo = 'ativo';

-- ------------------------------------------------------------
-- Licenças de backup por clínica (add-on monetizado)
-- ------------------------------------------------------------
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS quantidade_backup_pacientes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_quantidade_backup_pacientes_nonneg;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_quantidade_backup_pacientes_nonneg
  CHECK (quantidade_backup_pacientes >= 0);

COMMENT ON COLUMN public.clinics.quantidade_backup_pacientes IS
  'Licenças contratadas de Backup de Paciente (pacientes desvinculados).';

ALTER TABLE public.clinic_subscriptions
  ADD COLUMN IF NOT EXISTS quantidade_backup_pacientes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.clinic_subscriptions
  DROP CONSTRAINT IF EXISTS clinic_subscriptions_backup_nonneg;
ALTER TABLE public.clinic_subscriptions
  ADD CONSTRAINT clinic_subscriptions_backup_nonneg
  CHECK (quantidade_backup_pacientes >= 0);

-- ------------------------------------------------------------
-- RLS — Segurança (ativo + desvinculado visíveis ao terapeuta; família só ativo)
-- ------------------------------------------------------------

-- Família: apenas pacientes com vínculo ativo
DROP POLICY IF EXISTS "patients_family_view_linked" ON public.patients;
CREATE POLICY "patients_family_view_linked"
  ON public.patients FOR SELECT
  USING (
    status_vinculo = 'ativo'
    AND id IN (
      SELECT fm.patient_id FROM family_members fm
      WHERE fm.user_id = auth.uid() AND fm.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Hard delete: clinic_admin da clínica do paciente
DROP POLICY IF EXISTS "patients_clinic_admin_delete" ON public.patients;
CREATE POLICY "patients_clinic_admin_delete"
  ON public.patients FOR DELETE
  USING (
    clinic_id = public.auth_clinic_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND deleted_at IS NULL
  );

-- Hard delete: terapeuta dono do registro (explícito; complementa patients_professional_own)
DROP POLICY IF EXISTS "patients_professional_hard_delete" ON public.patients;
CREATE POLICY "patients_professional_hard_delete"
  ON public.patients FOR DELETE
  USING (
    clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    AND professional_id IN (
      SELECT p.id FROM professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Índice para contagem de backup por profissional
CREATE INDEX IF NOT EXISTS idx_patients_prof_backup_count
  ON public.patients (professional_id)
  WHERE deleted_at IS NULL
    AND status_vinculo = 'desvinculado';
