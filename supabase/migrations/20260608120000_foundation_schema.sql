-- ============================================================
-- THERAPY.AI — Foundation Schema
-- Migration: 20260608120000_foundation_schema.sql
-- Description: Base tables for multi-tenant SaaS hierarchy
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('master', 'clinic_admin', 'professional', 'family');
CREATE TYPE subscription_plan AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE entity_status AS ENUM ('active', 'inactive', 'suspended');

-- ============================================================
-- UTILITY: Trigger function for updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: platform_admins (Master SaaS — Camada 1)
-- ============================================================

CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_admins_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER trg_platform_admins_updated
  BEFORE UPDATE ON platform_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: Only masters can see/modify this table
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_master_access"
  ON platform_admins FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- ============================================================
-- TABLE: clinics (Tenant — Camada 2)
-- ============================================================

CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT,  -- CNPJ
  email TEXT NOT NULL,
  phone TEXT,
  status entity_status NOT NULL DEFAULT 'active',
  subscription_plan subscription_plan NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TRIGGER trg_clinics_updated
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_clinics_status ON clinics (status) WHERE deleted_at IS NULL;

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Masters can see all clinics
CREATE POLICY "clinics_master_full_access"
  ON clinics FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins can see their own clinic
CREATE POLICY "clinics_admin_view_own"
  ON clinics FOR SELECT
  USING (
    id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND deleted_at IS NULL
  );

-- Professionals can see their own clinic
CREATE POLICY "clinics_professional_view_own"
  ON clinics FOR SELECT
  USING (
    id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND deleted_at IS NULL
  );

-- ============================================================
-- TABLE: clinic_settings (Quotas and limits per clinic)
-- ============================================================

CREATE TABLE clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  max_professionals INT NOT NULL DEFAULT 5,
  max_patients_per_professional INT NOT NULL DEFAULT 30,
  max_family_members_per_patient INT NOT NULL DEFAULT 2,
  max_ai_queries_per_month INT NOT NULL DEFAULT 500,
  max_audio_minutes_per_month INT NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinic_settings_clinic_unique UNIQUE (clinic_id)
);

CREATE TRIGGER trg_clinic_settings_updated
  BEFORE UPDATE ON clinic_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Masters can manage all settings
CREATE POLICY "clinic_settings_master_access"
  ON clinic_settings FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins can view their own settings
CREATE POLICY "clinic_settings_admin_view"
  ON clinic_settings FOR SELECT
  USING (clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid));

-- ============================================================
-- TABLE: professionals (Collaborators — Camada 3)
-- ============================================================

CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  specialty TEXT,  -- Psicólogo, Fonoaudiólogo, T.O., etc.
  crp TEXT,  -- Conselho Regional de Psicologia number
  status entity_status NOT NULL DEFAULT 'active',
  max_patients_override INT,  -- If null, use clinic_settings.max_patients_per_professional
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT professionals_user_id_unique UNIQUE (user_id)
);

CREATE TRIGGER trg_professionals_updated
  BEFORE UPDATE ON professionals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_professionals_clinic ON professionals (clinic_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_professionals_user ON professionals (user_id) WHERE deleted_at IS NULL;

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

-- Masters see all
CREATE POLICY "professionals_master_access"
  ON professionals FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins manage their clinic's professionals
CREATE POLICY "professionals_clinic_admin_access"
  ON professionals FOR ALL
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
    AND deleted_at IS NULL
  );

-- Professionals can see themselves and colleagues in same clinic
CREATE POLICY "professionals_view_own_clinic"
  ON professionals FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND deleted_at IS NULL
  );

-- ============================================================
-- TABLE: audit_logs (Append-only immutable log)
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clinic_id UUID,
  action TEXT NOT NULL,          -- 'patient.create', 'note.approve', 'ai.query'
  resource_type TEXT NOT NULL,   -- 'patient', 'session_note', 'invite'
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BRIN index for time-series queries
CREATE INDEX idx_audit_logs_created ON audit_logs USING BRIN (created_at);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at);
CREATE INDEX idx_audit_logs_clinic ON audit_logs (clinic_id, created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Nobody can UPDATE or DELETE audit logs
CREATE POLICY "audit_logs_insert_only"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Masters can read all logs
CREATE POLICY "audit_logs_master_read"
  ON audit_logs FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admins can read their clinic's logs
CREATE POLICY "audit_logs_clinic_admin_read"
  ON audit_logs FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
  );

-- Explicitly revoke UPDATE/DELETE from all roles
-- (This is belt-and-suspenders with RLS)
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;

-- ============================================================
-- FUNCTION: Helper to get current user's clinic_id from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_clinic_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'clinic_id')::uuid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Helper to get current user's role from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_role()
RETURNS user_role AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role')::user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
