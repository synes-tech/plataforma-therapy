-- ============================================================
-- UNITHERY — Auth Custom Claims
-- Migration: 20260608130000_auth_custom_claims.sql
-- Description: Inject role + clinic_id into JWT via Database Hook
-- ============================================================

-- ============================================================
-- FUNCTION: Custom Access Token Hook
-- Supabase calls this function on every token refresh.
-- It injects 'role' and 'clinic_id' into the JWT claims.
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_id UUID;
  user_role TEXT;
  user_clinic_id UUID;
BEGIN
  -- Extract user_id from the event
  user_id := (event ->> 'user_id')::uuid;

  -- Get current claims
  claims := event -> 'claims';

  -- Check if user is a platform admin (master)
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE platform_admins.user_id = custom_access_token_hook.user_id) THEN
    claims := jsonb_set(claims, '{role}', '"master"');
    claims := jsonb_set(claims, '{clinic_id}', 'null');
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END IF;

  -- Check if user is a clinic admin
  -- (A clinic admin is stored in a separate lookup or has their user_id in clinics.created_by)
  IF EXISTS (
    SELECT 1 FROM public.clinic_admins
    WHERE clinic_admins.user_id = custom_access_token_hook.user_id
    AND clinic_admins.deleted_at IS NULL
  ) THEN
    SELECT clinic_admins.clinic_id INTO user_clinic_id
    FROM public.clinic_admins
    WHERE clinic_admins.user_id = custom_access_token_hook.user_id
    AND clinic_admins.deleted_at IS NULL
    LIMIT 1;

    claims := jsonb_set(claims, '{role}', '"clinic_admin"');
    claims := jsonb_set(claims, '{clinic_id}', to_jsonb(user_clinic_id::text));
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END IF;

  -- Check if user is a professional
  IF EXISTS (
    SELECT 1 FROM public.professionals
    WHERE professionals.user_id = custom_access_token_hook.user_id
    AND professionals.deleted_at IS NULL
  ) THEN
    SELECT professionals.clinic_id INTO user_clinic_id
    FROM public.professionals
    WHERE professionals.user_id = custom_access_token_hook.user_id
    AND professionals.deleted_at IS NULL
    LIMIT 1;

    claims := jsonb_set(claims, '{role}', '"professional"');
    claims := jsonb_set(claims, '{clinic_id}', to_jsonb(user_clinic_id::text));
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END IF;

  -- Check if user is a family member
  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_members.user_id = custom_access_token_hook.user_id
    AND family_members.deleted_at IS NULL
  ) THEN
    SELECT family_members.clinic_id INTO user_clinic_id
    FROM public.family_members
    WHERE family_members.user_id = custom_access_token_hook.user_id
    AND family_members.deleted_at IS NULL
    LIMIT 1;

    claims := jsonb_set(claims, '{role}', '"family"');
    claims := jsonb_set(claims, '{clinic_id}', to_jsonb(user_clinic_id::text));
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END IF;

  -- Default: no role assigned yet (new user pending assignment)
  claims := jsonb_set(claims, '{role}', '"family"');
  claims := jsonb_set(claims, '{clinic_id}', 'null');
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to supabase_auth_admin (required for hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;

-- ============================================================
-- TABLE: clinic_admins (Links auth.users to clinic admin role)
-- ============================================================

CREATE TABLE clinic_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT clinic_admins_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER trg_clinic_admins_updated
  BEFORE UPDATE ON clinic_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_clinic_admins_clinic ON clinic_admins (clinic_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clinic_admins_user ON clinic_admins (user_id) WHERE deleted_at IS NULL;

ALTER TABLE clinic_admins ENABLE ROW LEVEL SECURITY;

-- Masters full access
CREATE POLICY "clinic_admins_master_access"
  ON clinic_admins FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins can see themselves
CREATE POLICY "clinic_admins_view_own"
  ON clinic_admins FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- TABLE: family_members (Links auth.users to family role)
-- Will be populated when invite codes are consumed (Phase 2)
-- ============================================================

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id UUID,  -- Will reference patients table (created in Phase 2)
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'responsável',  -- pai, mãe, avó, etc.
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT family_members_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER trg_family_members_updated
  BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_family_members_clinic ON family_members (clinic_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_family_members_patient ON family_members (patient_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_family_members_user ON family_members (user_id) WHERE deleted_at IS NULL;

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- Masters full access
CREATE POLICY "family_members_master_access"
  ON family_members FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins manage their clinic's family members
CREATE POLICY "family_members_clinic_admin_access"
  ON family_members FOR ALL
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
  );

-- Professionals can see family of their patients
CREATE POLICY "family_members_professional_view"
  ON family_members FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'professional'
    AND deleted_at IS NULL
  );

-- Family members can see themselves
CREATE POLICY "family_members_view_own"
  ON family_members FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);
