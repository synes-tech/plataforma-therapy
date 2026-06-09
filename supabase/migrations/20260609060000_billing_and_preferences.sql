-- ============================================================
-- THERAPY.AI — Billing & Clinic Preferences
-- Migration: 20260609060000_billing_and_preferences.sql
-- Agentes: DBA (4) + Backend (2) + Segurança (6)
-- Description: Tabelas de faturas (billing) e preferências da clínica
--              para as telas de Faturas e Configurações do admin.
-- ============================================================

-- ============================================================
-- ENUM: invoice_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'canceled', 'refunded');
  END IF;
END$$;

-- ============================================================
-- TABLE: invoices (Faturas por clínica — geradas pelo sistema/Master)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  plan_label TEXT NOT NULL,                       -- snapshot do plano cobrado
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status invoice_status NOT NULL DEFAULT 'pending',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT invoices_period_valid CHECK (period_end >= period_start)
);

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices (query patterns: listar faturas da clínica por data; filtrar por status)
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_created
  ON invoices (clinic_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_status
  ON invoices (clinic_id, status) WHERE deleted_at IS NULL;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Master: acesso total (gera/edita faturas)
DROP POLICY IF EXISTS "invoices_master_access" ON invoices;
CREATE POLICY "invoices_master_access"
  ON invoices FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admin: APENAS leitura das faturas da própria clínica
DROP POLICY IF EXISTS "invoices_clinic_admin_read" ON invoices;
CREATE POLICY "invoices_clinic_admin_read"
  ON invoices FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
    AND deleted_at IS NULL
  );

-- Defesa em profundidade (least privilege): admin só lê faturas
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON invoices FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON invoices FROM anon;

-- ============================================================
-- TABLE: clinic_preferences (Preferências de notificação da clínica)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  crisis_alerts_email BOOLEAN NOT NULL DEFAULT true,
  weekly_digest_email BOOLEAN NOT NULL DEFAULT true,
  ai_usage_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinic_preferences_clinic_unique UNIQUE (clinic_id)
);

CREATE TRIGGER trg_clinic_preferences_updated
  BEFORE UPDATE ON clinic_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_preferences ENABLE ROW LEVEL SECURITY;

-- Master: acesso total
DROP POLICY IF EXISTS "clinic_preferences_master_access" ON clinic_preferences;
CREATE POLICY "clinic_preferences_master_access"
  ON clinic_preferences FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

-- Clinic admin: ler e atualizar preferências da própria clínica
DROP POLICY IF EXISTS "clinic_preferences_admin_read" ON clinic_preferences;
CREATE POLICY "clinic_preferences_admin_read"
  ON clinic_preferences FOR SELECT
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
  );

DROP POLICY IF EXISTS "clinic_preferences_admin_update" ON clinic_preferences;
CREATE POLICY "clinic_preferences_admin_update"
  ON clinic_preferences FOR UPDATE
  USING (
    clinic_id = ((auth.jwt() ->> 'clinic_id')::uuid)
    AND (auth.jwt() ->> 'role') = 'clinic_admin'
  );

-- Least privilege: admin só lê/atualiza preferências (insert/delete via service role)
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON clinic_preferences FROM authenticated;
REVOKE ALL ON clinic_preferences FROM anon;

-- ============================================================
-- BACKFILL: garantir preferências para clínicas existentes
-- ============================================================
INSERT INTO clinic_preferences (clinic_id)
SELECT c.id FROM clinics c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM clinic_preferences cp WHERE cp.clinic_id = c.id);
