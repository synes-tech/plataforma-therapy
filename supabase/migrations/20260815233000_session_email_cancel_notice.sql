-- Expand session_email_jobs kinds for cancellation notifications.
-- Cloud SQL staging + future Supabase parity.

ALTER TABLE public.session_email_jobs
  DROP CONSTRAINT IF EXISTS session_email_jobs_kind_check;

ALTER TABLE public.session_email_jobs
  ADD CONSTRAINT session_email_jobs_kind_check
  CHECK (kind IN (
    'booking_confirmation',
    'reminder_24h',
    'reminder_manual',
    'reschedule_notice',
    'cancel_notice'
  ));
