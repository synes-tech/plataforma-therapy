-- ============================================================
-- Multi-tenant: account_type, subscriptions, RLS clinic_admin
-- Agentes: DBA + Segurança
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('corporate', 'solo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');
  END IF;
END$$;

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS account_type account_type;

UPDATE clinics
SET account_type = CASE
  WHEN is_solo_professional THEN 'solo'::account_type
  ELSE 'corporate'::account_type
END
WHERE account_type IS NULL;

ALTER TABLE clinics
  ALTER COLUMN account_type SET DEFAULT 'corporate';

-- ============================================================
-- TABLE: clinic_subscriptions (histórico de assinatura por tenant)
-- ============================================================

CREATE TABLE IF NOT EXISTS clinic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_clinic
  ON clinic_subscriptions (clinic_id, started_at DESC);

CREATE TRIGGER trg_clinic_subscriptions_updated
  BEFORE UPDATE ON clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_subscriptions_master" ON clinic_subscriptions;
CREATE POLICY "clinic_subscriptions_master"
  ON clinic_subscriptions FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master');

DROP POLICY IF EXISTS "clinic_subscriptions_admin_read" ON clinic_subscriptions;
CREATE POLICY "clinic_subscriptions_admin_read"
  ON clinic_subscriptions FOR SELECT
  USING (
    clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
  );

-- Backfill assinatura ativa a partir do plano atual
INSERT INTO clinic_subscriptions (clinic_id, plan, status, started_at)
SELECT c.id, c.subscription_plan, 'active'::subscription_status, c.created_at
FROM clinics c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM clinic_subscriptions cs WHERE cs.clinic_id = c.id
  );

-- ============================================================
-- Helpers RLS (clinic_admin lê dados dos pacientes da clínica)
-- ============================================================

CREATE OR REPLACE FUNCTION public.auth_clinic_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.user_is_clinic_admin_for_patient(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = p_patient_id
      AND p.deleted_at IS NULL
      AND p.clinic_id = public.auth_clinic_id()
      AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
  );
$$;

-- session_notes: clinic_admin leitura dos pacientes da clínica
DROP POLICY IF EXISTS "session_notes_clinic_admin_read" ON session_notes;
CREATE POLICY "session_notes_clinic_admin_read"
  ON session_notes FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND public.user_is_clinic_admin_for_patient(patient_id)
    AND deleted_at IS NULL
  );

-- audio_recordings
DROP POLICY IF EXISTS "audio_recordings_clinic_admin_read" ON audio_recordings;
CREATE POLICY "audio_recordings_clinic_admin_read"
  ON audio_recordings FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND public.user_is_clinic_admin_for_patient(patient_id)
    AND deleted_at IS NULL
  );

-- audio_transcriptions
DROP POLICY IF EXISTS "audio_transcriptions_clinic_admin_read" ON audio_transcriptions;
CREATE POLICY "audio_transcriptions_clinic_admin_read"
  ON audio_transcriptions FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND public.user_is_clinic_admin_for_patient(patient_id)
  );

-- patient_embeddings (copiloto / RAG)
DROP POLICY IF EXISTS "embeddings_clinic_admin_read" ON patient_embeddings;
CREATE POLICY "embeddings_clinic_admin_read"
  ON patient_embeddings FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND public.user_is_clinic_admin_for_patient(patient_id)
  );

-- Storage: clinic_admin lê áudios dos pacientes da clínica
DROP POLICY IF EXISTS "audio_recordings_clinic_admin_select" ON storage.objects;
CREATE POLICY "audio_recordings_clinic_admin_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    WHERE p.clinic_id = public.auth_clinic_id()
      AND p.deleted_at IS NULL
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
);
