-- ============================================================
-- Fase 1 PLG — Trial 14 dias no onboarding
-- Migration: 20260629100000_trial_onboarding.sql
-- ============================================================

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Contas existentes permanecem ativas (sem trial)
UPDATE public.clinics
SET subscription_status = 'active'::subscription_status
WHERE subscription_status IS NULL;

ALTER TABLE public.clinics
  ALTER COLUMN subscription_status SET DEFAULT 'trialing'::subscription_status;

ALTER TABLE public.clinics
  ALTER COLUMN subscription_status SET NOT NULL;

COMMENT ON COLUMN public.clinics.subscription_status IS
  'trialing | active | past_due | canceled — gestão SaaS por tenant';

COMMENT ON COLUMN public.clinics.trial_ends_at IS
  'Fim do período de teste grátis (14 dias a partir do cadastro). NULL se não aplicável.';

CREATE INDEX IF NOT EXISTS idx_clinics_subscription_status
  ON public.clinics (subscription_status)
  WHERE deleted_at IS NULL;
