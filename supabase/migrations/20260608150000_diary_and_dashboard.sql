-- ============================================================
-- THERAPY.AI — Diary Entries & Dashboard Data
-- Migration: 20260608150000_diary_and_dashboard.sql
-- Description: Family diary, mood tracking, alerts, materialized views
-- ============================================================

-- ============================================================
-- TABLE: diary_entries (Family reports daily behavior)
-- ============================================================

CREATE TABLE diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_score INT NOT NULL CHECK (mood_score BETWEEN 1 AND 5),  -- 1=muito ruim, 5=ótimo
  sleep_quality INT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  crisis_occurred BOOLEAN NOT NULL DEFAULT false,
  crisis_level INT CHECK (crisis_level BETWEEN 1 AND 5),  -- null if no crisis
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ['sono', 'escola', 'alimentacao', 'social']
  notes TEXT,  -- Free text observation (max 1000 chars)
  audio_note_url TEXT,  -- Optional audio note (Supabase Storage path)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  -- Prevent duplicate entries for same patient on same day by same family member
  CONSTRAINT diary_entries_unique_daily UNIQUE (patient_id, family_member_id, entry_date)
);

CREATE TRIGGER trg_diary_entries_updated
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for common access patterns
CREATE INDEX idx_diary_entries_patient_date ON diary_entries (patient_id, entry_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_diary_entries_clinic ON diary_entries (clinic_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_diary_entries_crisis ON diary_entries (patient_id, entry_date DESC) WHERE crisis_occurred = true AND deleted_at IS NULL;
CREATE INDEX idx_diary_entries_family ON diary_entries (family_member_id, entry_date DESC) WHERE deleted_at IS NULL;

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "diary_entries_master_access"
  ON diary_entries FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins see their clinic's entries
CREATE POLICY "diary_entries_clinic_admin_view"
  ON diary_entries FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
    AND deleted_at IS NULL
  );

-- Professionals see entries for their patients
CREATE POLICY "diary_entries_professional_view"
  ON diary_entries FOR SELECT
  USING (
    patient_id IN (
      SELECT p.id FROM patients p
      JOIN professionals prof ON p.professional_id = prof.id
      WHERE prof.user_id = auth.uid() AND prof.deleted_at IS NULL AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Family members can CRUD their own entries for their linked patient
CREATE POLICY "diary_entries_family_own"
  ON diary_entries FOR ALL
  USING (
    family_member_id IN (
      SELECT fm.id FROM family_members fm WHERE fm.user_id = auth.uid() AND fm.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ============================================================
-- TABLE: crisis_alerts (Generated from diary entries with crisis)
-- ============================================================

CREATE TABLE crisis_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE RESTRICT,
  crisis_level INT NOT NULL CHECK (crisis_level BETWEEN 1 AND 5),
  seen_at TIMESTAMPTZ,  -- When professional viewed it
  dismissed_at TIMESTAMPTZ,  -- When professional dismissed/resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crisis_alerts_professional_unseen ON crisis_alerts (professional_id, created_at DESC) WHERE seen_at IS NULL;
CREATE INDEX idx_crisis_alerts_patient ON crisis_alerts (patient_id, created_at DESC);

ALTER TABLE crisis_alerts ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "crisis_alerts_master_access"
  ON crisis_alerts FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Professionals see and manage their own alerts
CREATE POLICY "crisis_alerts_professional_own"
  ON crisis_alerts FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

-- ============================================================
-- FUNCTION: Auto-create crisis alert when diary has crisis
-- Triggered via database trigger on diary_entries insert
-- ============================================================

CREATE OR REPLACE FUNCTION create_crisis_alert_on_diary()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_id UUID;
BEGIN
  -- Only fire if crisis occurred
  IF NEW.crisis_occurred = true AND NEW.crisis_level IS NOT NULL AND NEW.crisis_level >= 3 THEN
    -- Get the professional for this patient
    SELECT professional_id INTO v_professional_id
    FROM patients
    WHERE id = NEW.patient_id AND deleted_at IS NULL;

    IF v_professional_id IS NOT NULL THEN
      INSERT INTO crisis_alerts (patient_id, clinic_id, professional_id, diary_entry_id, crisis_level)
      VALUES (NEW.patient_id, NEW.clinic_id, v_professional_id, NEW.id, NEW.crisis_level);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_diary_crisis_alert
  AFTER INSERT ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION create_crisis_alert_on_diary();

-- ============================================================
-- TABLE: therapist_schedule (Simple agenda entries)
-- ============================================================

CREATE TABLE therapist_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER trg_schedule_updated
  BEFORE UPDATE ON therapist_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_schedule_professional_date ON therapist_schedule (professional_id, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_patient ON therapist_schedule (patient_id, scheduled_at) WHERE deleted_at IS NULL;

ALTER TABLE therapist_schedule ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "schedule_master_access"
  ON therapist_schedule FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Professionals manage their own schedule
CREATE POLICY "schedule_professional_own"
  ON therapist_schedule FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Family can see their patient's schedule (read only)
CREATE POLICY "schedule_family_view"
  ON therapist_schedule FOR SELECT
  USING (
    patient_id IN (
      SELECT fm.patient_id FROM family_members fm WHERE fm.user_id = auth.uid() AND fm.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ============================================================
-- MATERIALIZED VIEW: Patient evolution summary (refreshed hourly)
-- Powers the evolution charts on the therapist dashboard
-- ============================================================

CREATE MATERIALIZED VIEW patient_evolution_weekly AS
SELECT
  de.patient_id,
  de.clinic_id,
  date_trunc('week', de.entry_date::timestamp)::date AS week_start,
  COUNT(*) AS total_entries,
  ROUND(AVG(de.mood_score)::numeric, 2) AS avg_mood,
  ROUND(AVG(de.sleep_quality)::numeric, 2) AS avg_sleep,
  COUNT(*) FILTER (WHERE de.crisis_occurred = true) AS crisis_count,
  ROUND(AVG(de.crisis_level) FILTER (WHERE de.crisis_occurred = true)::numeric, 2) AS avg_crisis_level
FROM diary_entries de
WHERE de.deleted_at IS NULL
GROUP BY de.patient_id, de.clinic_id, date_trunc('week', de.entry_date::timestamp)::date;

-- Index for quick lookups by patient
CREATE UNIQUE INDEX idx_patient_evolution_weekly_pk
  ON patient_evolution_weekly (patient_id, week_start);

-- Schedule hourly refresh
SELECT cron.schedule(
  'refresh_patient_evolution_weekly',
  '15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY patient_evolution_weekly'
);

-- ============================================================
-- FUNCTION: Get therapist dashboard summary
-- Returns today's schedule + unseen alerts count + recent diary entries
-- ============================================================

CREATE OR REPLACE FUNCTION get_therapist_dashboard(p_professional_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_today_schedule JSONB;
  v_unseen_alerts INT;
  v_recent_crises JSONB;
BEGIN
  -- Today's schedule
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ts.id,
      'patient_name', p.name,
      'scheduled_at', ts.scheduled_at,
      'duration_minutes', ts.duration_minutes,
      'status', ts.status
    ) ORDER BY ts.scheduled_at
  ), '[]'::jsonb)
  INTO v_today_schedule
  FROM therapist_schedule ts
  LEFT JOIN patients p ON ts.patient_id = p.id
  WHERE ts.professional_id = p_professional_id
    AND ts.scheduled_at::date = CURRENT_DATE
    AND ts.deleted_at IS NULL;

  -- Unseen alerts count
  SELECT COUNT(*)
  INTO v_unseen_alerts
  FROM crisis_alerts
  WHERE professional_id = p_professional_id
    AND seen_at IS NULL;

  -- Recent crises (last 7 days)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ca.id,
      'patient_name', p.name,
      'patient_id', ca.patient_id,
      'crisis_level', ca.crisis_level,
      'created_at', ca.created_at
    ) ORDER BY ca.created_at DESC
  ), '[]'::jsonb)
  INTO v_recent_crises
  FROM crisis_alerts ca
  JOIN patients p ON ca.patient_id = p.id
  WHERE ca.professional_id = p_professional_id
    AND ca.seen_at IS NULL
    AND ca.created_at > now() - interval '7 days';

  v_result := jsonb_build_object(
    'today_schedule', v_today_schedule,
    'unseen_alerts_count', v_unseen_alerts,
    'recent_crises', v_recent_crises
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
