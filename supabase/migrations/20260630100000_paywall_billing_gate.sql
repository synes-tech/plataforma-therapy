-- ============================================================
-- Fase 2 PLG — Paywall: cartão + contagem leve de pacientes
-- Migration: 20260630100000_paywall_billing_gate.sql
-- ============================================================

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS payment_method_on_file BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinics.payment_method_on_file IS
  'true após checkout (Fase 3); false durante trial sem cartão';

-- Contagem freemium por profissional (já existe idx_patients_professional; reforço parcial)
CREATE INDEX IF NOT EXISTS idx_patients_prof_paywall_count
  ON public.patients (professional_id)
  WHERE deleted_at IS NULL AND status = 'active';
