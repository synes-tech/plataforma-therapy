-- Contato estruturado no paciente + fila de e-mails de sessão (SES)
-- Usado para: confirmação ao agendar, lembrete 24h e lembrete manual agendado.

-- ============================================================
-- 1) Contato em patients
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS contact_scope TEXT
    CHECK (contact_scope IS NULL OR contact_scope IN ('patient', 'responsible', 'both')),
  ADD COLUMN IF NOT EXISTS email_paciente TEXT,
  ADD COLUMN IF NOT EXISTS telefone_paciente TEXT,
  ADD COLUMN IF NOT EXISTS email_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS telefone_responsavel TEXT;

COMMENT ON COLUMN public.patients.contact_scope IS
  'Quem recebe lembretes: patient | responsible | both';
COMMENT ON COLUMN public.patients.email_paciente IS
  'E-mail do paciente para lembretes de sessão (SES)';
COMMENT ON COLUMN public.patients.email_responsavel IS
  'E-mail do responsável para lembretes de sessão (SES)';

-- ============================================================
-- 2) Fila de jobs de e-mail de sessão
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.therapist_schedule(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('booking_confirmation', 'reminder_24h', 'reminder_manual')),
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_role TEXT NOT NULL
    CHECK (recipient_role IN ('patient', 'responsible', 'family')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_email_jobs_pending_send_at
  ON public.session_email_jobs (send_at ASC)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_email_jobs_schedule
  ON public.session_email_jobs (schedule_id)
  WHERE deleted_at IS NULL;

-- Evita duplicar confirmação / lembrete 24h para o mesmo destinatário
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_email_jobs_unique_auto
  ON public.session_email_jobs (schedule_id, kind, lower(recipient_email))
  WHERE kind IN ('booking_confirmation', 'reminder_24h')
    AND status <> 'cancelled'
    AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_session_email_jobs_updated_at ON public.session_email_jobs;
CREATE TRIGGER trg_session_email_jobs_updated_at
  BEFORE UPDATE ON public.session_email_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.session_email_jobs ENABLE ROW LEVEL SECURITY;

-- Apenas service_role (Edge Functions) manipula a fila.
-- Políticas permissivas para authenticated são omitidas de propósito.

REVOKE ALL ON TABLE public.session_email_jobs FROM PUBLIC;
GRANT ALL ON TABLE public.session_email_jobs TO service_role;

-- ============================================================
-- 3) Cron → Edge Function process-session-email-queue
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoke_process_session_email_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT := 'https://yfzhjdfvaosezyjvbyid.supabase.co/functions/v1/process-session-email-queue';
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'cron_secret não configurado no Vault — fila de e-mails de sessão ignorada';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron', 'limit', 50)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_process_session_email_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_process_session_email_queue() TO postgres;

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'process_session_email_queue' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

-- A cada 15 minutos
SELECT cron.schedule(
  'process_session_email_queue',
  '*/15 * * * *',
  $$SELECT public.invoke_process_session_email_queue();$$
);
