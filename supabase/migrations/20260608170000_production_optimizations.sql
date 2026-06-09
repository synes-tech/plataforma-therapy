-- ============================================================
-- THERAPY.AI — Production Optimizations
-- Migration: 20260608170000_production_optimizations.sql
-- Description: Index tuning, statement timeouts, monitoring views
-- Agente: DBA (4) — Performance e Operação
-- ============================================================

-- ============================================================
-- PERFORMANCE: Statement timeout for Edge Functions (30s max)
-- Agente 4 - Section 6.4: Connection Pooling
-- ============================================================

ALTER DATABASE postgres SET statement_timeout = '30s';

-- ============================================================
-- ADDITIONAL INDEXES based on observed query patterns
-- Agente 4 - Section 6.1: Indexação Estratégica
-- ============================================================

-- Dashboard: therapist loads patients list frequently
CREATE INDEX IF NOT EXISTS idx_patients_professional_active
  ON patients (professional_id, name)
  WHERE deleted_at IS NULL AND status = 'active';

-- Copilot: frequent embedding searches need fast patient lookup
CREATE INDEX IF NOT EXISTS idx_embeddings_patient_created
  ON patient_embeddings (patient_id, created_at DESC);

-- Auth hook: fast role resolution on every token refresh
CREATE INDEX IF NOT EXISTS idx_clinic_admins_user_active
  ON clinic_admins (user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_family_members_user_active
  ON family_members (user_id)
  WHERE deleted_at IS NULL;

-- Diary: family submits daily, therapist queries weekly
CREATE INDEX IF NOT EXISTS idx_diary_entries_patient_week
  ON diary_entries (patient_id, entry_date DESC)
  WHERE deleted_at IS NULL;

-- Session notes: therapist reviews drafts frequently
CREATE INDEX IF NOT EXISTS idx_session_notes_draft_patient
  ON session_notes (patient_id, created_at DESC)
  WHERE status = 'draft' AND deleted_at IS NULL;

-- ============================================================
-- MONITORING: Usage statistics view for billing/quotas
-- Agente 4 - Section 7: Compliance e Governança
-- ============================================================

CREATE OR REPLACE VIEW clinic_usage_stats AS
SELECT
  c.id AS clinic_id,
  c.name AS clinic_name,
  c.subscription_plan,
  cs.max_professionals,
  cs.max_patients_per_professional,
  cs.max_ai_queries_per_month,
  cs.max_audio_minutes_per_month,
  (SELECT COUNT(*) FROM professionals p WHERE p.clinic_id = c.id AND p.deleted_at IS NULL) AS current_professionals,
  (SELECT COUNT(*) FROM patients pt WHERE pt.clinic_id = c.id AND pt.deleted_at IS NULL) AS current_patients,
  (SELECT COUNT(*) FROM ai_jobs aj
   WHERE aj.clinic_id = c.id
     AND aj.created_at >= date_trunc('month', now())
     AND aj.status = 'completed'
  ) AS ai_queries_this_month,
  (SELECT COALESCE(SUM(ar.duration_seconds), 0) / 60 FROM audio_recordings ar
   WHERE ar.clinic_id = c.id
     AND ar.created_at >= date_trunc('month', now())
  ) AS audio_minutes_this_month
FROM clinics c
LEFT JOIN clinic_settings cs ON cs.clinic_id = c.id
WHERE c.deleted_at IS NULL;

-- ============================================================
-- FUNCTION: Check quota before AI usage
-- Used by Edge Functions to verify limits before processing
-- ============================================================

CREATE OR REPLACE FUNCTION check_ai_quota(p_clinic_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_max_queries INT;
  v_current_queries INT;
  v_max_audio INT;
  v_current_audio INT;
BEGIN
  SELECT max_ai_queries_per_month, max_audio_minutes_per_month
  INTO v_max_queries, v_max_audio
  FROM clinic_settings WHERE clinic_id = p_clinic_id;

  SELECT COUNT(*) INTO v_current_queries
  FROM ai_jobs
  WHERE clinic_id = p_clinic_id
    AND created_at >= date_trunc('month', now())
    AND status = 'completed';

  SELECT COALESCE(SUM(duration_seconds), 0) / 60 INTO v_current_audio
  FROM audio_recordings
  WHERE clinic_id = p_clinic_id
    AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'ai_queries_remaining', GREATEST(v_max_queries - v_current_queries, 0),
    'audio_minutes_remaining', GREATEST(v_max_audio - v_current_audio, 0),
    'ai_queries_used', v_current_queries,
    'audio_minutes_used', v_current_audio,
    'within_limits', (v_current_queries < v_max_queries AND v_current_audio < v_max_audio)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- PARTITIONING: Archive old audit logs (> 6 months to cold)
-- Agente 4 - Section 6.2: Particionamento
-- ============================================================

-- Create archive table for old audit logs
CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING ALL);

-- Schedule monthly archival (move logs older than 6 months)
SELECT cron.schedule(
  'archive_old_audit_logs',
  '0 3 1 * *',  -- 3AM on 1st of every month
  $$INSERT INTO audit_logs_archive SELECT * FROM audit_logs WHERE created_at < now() - interval '6 months';
    DELETE FROM audit_logs WHERE created_at < now() - interval '6 months';$$
);

-- ============================================================
-- SECURITY: Ensure no table has RLS disabled
-- Agente 6 - Compliance check
-- ============================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations', 'audit_logs_archive')
      AND NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = tablename AND n.nspname = schemaname AND c.relrowsecurity = true
      )
  LOOP
    RAISE WARNING 'Table %.% does NOT have RLS enabled!', t.schemaname, t.tablename;
  END LOOP;
END $$;
