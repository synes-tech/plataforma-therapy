-- Aviso SES 24h antes do fim do trial B2B (job warn-clinic-trial-ending).
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS trial_ending_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.clinics.trial_ending_email_sent_at IS
  'Quando o e-mail de 24h antes do fim do trial foi enviado. NULL = ainda não avisado.';

CREATE INDEX IF NOT EXISTS clinics_trial_ending_email_idx
  ON public.clinics (trial_ends_at)
  WHERE subscription_status = 'trial_active'
    AND trial_ending_email_sent_at IS NULL
    AND deleted_at IS NULL;
