-- Expand session_email_jobs kinds/roles for reschedule notifications.
-- Cloud SQL staging + future Supabase parity.

ALTER TABLE public.session_email_jobs
  DROP CONSTRAINT IF EXISTS session_email_jobs_kind_check;

ALTER TABLE public.session_email_jobs
  ADD CONSTRAINT session_email_jobs_kind_check
  CHECK (kind IN (
    'booking_confirmation',
    'reminder_24h',
    'reminder_manual',
    'reschedule_notice'
  ));

ALTER TABLE public.session_email_jobs
  DROP CONSTRAINT IF EXISTS session_email_jobs_recipient_role_check;

ALTER TABLE public.session_email_jobs
  ADD CONSTRAINT session_email_jobs_recipient_role_check
  CHECK (recipient_role IN (
    'patient',
    'responsible',
    'family',
    'professional'
  ));
