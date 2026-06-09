-- ============================================================
-- THERAPY.AI — Patients & Invite System
-- Migration: 20260608140000_patients_and_invites.sql
-- Description: Patients table, invite codes, and patient-family links
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE invite_status AS ENUM ('pending', 'consumed', 'expired', 'revoked');

-- ============================================================
-- TABLE: patients (Core clinical entity)
-- ============================================================

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'not_informed')) DEFAULT 'not_informed',
  diagnoses JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of diagnosis strings
  clinical_observations TEXT,
  status entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER trg_patients_updated
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Composite indexes optimized for common query patterns
CREATE INDEX idx_patients_clinic_professional ON patients (clinic_id, professional_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_professional ON patients (professional_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_name_search ON patients (clinic_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_diagnoses ON patients USING GIN (diagnoses) WHERE deleted_at IS NULL;

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "patients_master_access"
  ON patients FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins see all patients in their clinic
CREATE POLICY "patients_clinic_admin_access"
  ON patients FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
    AND deleted_at IS NULL
  );

-- Professionals see ONLY their own patients
CREATE POLICY "patients_professional_own"
  ON patients FOR ALL
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Family members see only their linked patient
CREATE POLICY "patients_family_view_linked"
  ON patients FOR SELECT
  USING (
    id IN (
      SELECT fm.patient_id FROM family_members fm
      WHERE fm.user_id = auth.uid() AND fm.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ============================================================
-- TABLE: invites (Invite codes for family members)
-- ============================================================

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,  -- 8-char alphanumeric, unique
  status invite_status NOT NULL DEFAULT 'pending',
  relationship TEXT NOT NULL DEFAULT 'responsável',  -- pai, mãe, avó, etc.
  max_uses INT NOT NULL DEFAULT 1,
  times_used INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT invites_code_unique UNIQUE (code)
);

CREATE TRIGGER trg_invites_updated
  BEFORE UPDATE ON invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_invites_code ON invites (code) WHERE status = 'pending';
CREATE INDEX idx_invites_patient ON invites (patient_id);
CREATE INDEX idx_invites_professional ON invites (professional_id);
CREATE INDEX idx_invites_expires ON invites (expires_at) WHERE status = 'pending';

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "invites_master_access"
  ON invites FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins see their clinic's invites
CREATE POLICY "invites_clinic_admin_access"
  ON invites FOR ALL
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
  );

-- Professionals manage their own invites
CREATE POLICY "invites_professional_own"
  ON invites FOR ALL
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND professional_id IN (
      SELECT p.id FROM professionals p WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

-- ============================================================
-- TABLE: patient_family_links (Junction: which family sees which patient)
-- Redundant with family_members.patient_id but allows future multi-patient scenarios
-- ============================================================

CREATE TABLE patient_family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  relationship TEXT NOT NULL DEFAULT 'responsável',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT patient_family_links_unique UNIQUE (patient_id, family_member_id)
);

CREATE INDEX idx_patient_family_links_patient ON patient_family_links (patient_id);
CREATE INDEX idx_patient_family_links_family ON patient_family_links (family_member_id);

ALTER TABLE patient_family_links ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "patient_family_links_master_access"
  ON patient_family_links FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Professionals can manage links for their patients
CREATE POLICY "patient_family_links_professional"
  ON patient_family_links FOR ALL
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND patient_id IN (
      SELECT pat.id FROM patients pat
      JOIN professionals prof ON pat.professional_id = prof.id
      WHERE prof.user_id = auth.uid() AND prof.deleted_at IS NULL AND pat.deleted_at IS NULL
    )
  );

-- Family can see their own links
CREATE POLICY "patient_family_links_family_view"
  ON patient_family_links FOR SELECT
  USING (
    family_member_id IN (
      SELECT fm.id FROM family_members fm WHERE fm.user_id = auth.uid() AND fm.deleted_at IS NULL
    )
  );

-- ============================================================
-- FUNCTION: Generate secure random invite code (8 chars alphanumeric)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  -- 8 characters from 55-char alphabet = 55^8 ≈ 83 billion combinations
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================
-- FUNCTION: Consume invite (transactional, idempotent)
-- ============================================================

CREATE OR REPLACE FUNCTION consume_invite(
  p_code TEXT,
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_family_member_id UUID;
  v_clinic_id UUID;
  v_patient_id UUID;
  v_max_family INT;
  v_current_family INT;
BEGIN
  -- 1. Find and lock the invite
  SELECT * INTO v_invite
  FROM invites
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  IF v_invite.status = 'consumed' THEN
    RAISE EXCEPTION 'INVITE_CONSUMED';
  END IF;

  IF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    -- Mark as expired if not already
    UPDATE invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;

  IF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'INVITE_REVOKED';
  END IF;

  v_clinic_id := v_invite.clinic_id;
  v_patient_id := v_invite.patient_id;

  -- 2. Check family member quota for this patient
  SELECT cs.max_family_members_per_patient INTO v_max_family
  FROM clinic_settings cs
  WHERE cs.clinic_id = v_clinic_id;

  v_max_family := COALESCE(v_max_family, 2);

  SELECT COUNT(*) INTO v_current_family
  FROM patient_family_links pfl
  WHERE pfl.patient_id = v_patient_id;

  IF v_current_family >= v_max_family THEN
    RAISE EXCEPTION 'FAMILY_QUOTA_EXCEEDED';
  END IF;

  -- 3. Create family_member record
  INSERT INTO family_members (user_id, clinic_id, patient_id, name, email, phone, relationship, created_by)
  VALUES (p_user_id, v_clinic_id, v_patient_id, p_name, p_email, p_phone, v_invite.relationship, p_user_id)
  RETURNING id INTO v_family_member_id;

  -- 4. Create patient_family_link
  INSERT INTO patient_family_links (patient_id, family_member_id, clinic_id, relationship, created_by)
  VALUES (v_patient_id, v_family_member_id, v_clinic_id, v_invite.relationship, p_user_id);

  -- 5. Mark invite as consumed
  UPDATE invites
  SET status = 'consumed',
      consumed_at = now(),
      consumed_by = p_user_id,
      times_used = times_used + 1
  WHERE id = v_invite.id;

  -- 6. Return result
  RETURN jsonb_build_object(
    'family_member_id', v_family_member_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'relationship', v_invite.relationship
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CRON: Expire stale invites every hour
-- ============================================================

SELECT cron.schedule(
  'expire_stale_invites',
  '0 * * * *',
  $$UPDATE invites SET status = 'expired' WHERE status = 'pending' AND expires_at < now()$$
);

-- ============================================================
-- Update family_members to add FK to patients (now that patients exists)
-- ============================================================

ALTER TABLE family_members
  ADD CONSTRAINT family_members_patient_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;
