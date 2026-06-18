-- ============================================================
-- Push Notifications — Web Push subscriptions + diary reminders
-- Agentes: DBA + Segurança + Backend
--
-- Provedor: Web Push API (VAPID) — compatível com PWA instalada
-- Agendamento: pg_cron → pg_net → Edge Function check-and-send-reminders
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- TABLE: push_subscriptions (Web Push endpoints por dispositivo)
-- ============================================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions (endpoint);

CREATE TRIGGER trg_push_subscriptions_updated
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário só gerencia tokens do próprio dispositivo
CREATE POLICY "push_subscriptions_own_select"
  ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "push_subscriptions_own_insert"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_own_update"
  ON push_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_own_delete"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- TABLE: push_reminder_log (anti-spam — máx. 1 lembrete / 24h)
-- ============================================================

CREATE TABLE push_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  message_title TEXT NOT NULL,
  message_body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT
);

CREATE INDEX idx_push_reminder_log_user_patient_sent
  ON push_reminder_log (user_id, patient_id, sent_at DESC);

ALTER TABLE push_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_reminder_log_own_select"
  ON push_reminder_log FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- RPC: famílias inativas no diário + tokens push
-- stale_after_days=2 → sem registro hoje nem ontem
-- ============================================================

CREATE OR REPLACE FUNCTION get_families_needing_diary_reminder(
  p_stale_after_days INT DEFAULT 2
)
RETURNS TABLE (
  user_id UUID,
  patient_id UUID,
  patient_name TEXT,
  last_entry_date DATE,
  subscription_id UUID,
  endpoint TEXT,
  p256dh TEXT,
  auth_key TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH linked AS (
    SELECT
      pfl.user_id,
      pfl.patient_id,
      p.name AS patient_name
    FROM patient_family_links pfl
    INNER JOIN patients p ON p.id = pfl.patient_id AND p.deleted_at IS NULL
    WHERE pfl.user_id IS NOT NULL
  ),
  last_diary AS (
    SELECT
      de.patient_id,
      MAX(de.entry_date) AS last_entry_date
    FROM diary_entries de
    WHERE de.deleted_at IS NULL
    GROUP BY de.patient_id
  ),
  inactive AS (
    SELECT
      l.user_id,
      l.patient_id,
      l.patient_name,
      ld.last_entry_date
    FROM linked l
    LEFT JOIN last_diary ld ON ld.patient_id = l.patient_id
    WHERE ld.last_entry_date IS NULL
       OR ld.last_entry_date < CURRENT_DATE - GREATEST(p_stale_after_days - 1, 0)
  )
  SELECT
    i.user_id,
    i.patient_id,
    i.patient_name,
    i.last_entry_date,
    ps.id AS subscription_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth_key
  FROM inactive i
  INNER JOIN push_subscriptions ps ON ps.user_id = i.user_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM push_reminder_log prl
    WHERE prl.user_id = i.user_id
      AND prl.patient_id = i.patient_id
      AND prl.sent_at > NOW() - INTERVAL '24 hours'
  );
$$;

REVOKE ALL ON FUNCTION get_families_needing_diary_reminder(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_families_needing_diary_reminder(INT) TO service_role;

-- ============================================================
-- CRON: invoca Edge Function diariamente às 18h (BRT ≈ 21h UTC)
-- Configure o secret no Vault antes de ativar:
--   SELECT vault.create_secret('<seu-cron-secret>', 'cron_secret');
-- O mesmo valor deve estar em CRON_SECRET na Edge Function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoke_check_diary_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT := 'https://yfzhjdfvaosezyjvbyid.supabase.co/functions/v1/check-and-send-reminders';
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'cron_secret não configurado no Vault — lembretes push ignorados';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', v_secret
    ),
    body := jsonb_build_object('stale_after_days', 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_check_diary_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_check_diary_reminders() TO postgres;

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'check_diary_reminders_daily' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'check_diary_reminders_daily',
  '0 21 * * *',
  $$SELECT public.invoke_check_diary_reminders();$$
);
