-- ============================================================
-- Fase 3 PLG — status trial_active (cartão engatilhado)
-- Migration: 20260701100000_trial_active_status.sql
-- ============================================================

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trial_active';

COMMENT ON TYPE subscription_status IS
  'trialing = conta criada sem cartão; trial_active = trial com cartão (bypass); active = assinante pago';
