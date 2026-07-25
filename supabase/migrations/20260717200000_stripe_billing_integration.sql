-- ============================================================
-- Stripe billing produção — colunas clinics/planos + cron sync
-- Agentes: DBA + Backend
-- Ref: docs/plano-integracao-stripe-producao.md
-- ============================================================

-- Ação 1: IDs Stripe na clínica (tenant)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN public.clinics.stripe_customer_id IS
  'Customer ID no Stripe (cus_…). Fonte financeira: Stripe.';
COMMENT ON COLUMN public.clinics.stripe_subscription_id IS
  'Subscription ID ativa no Stripe (sub_…). Fonte financeira: Stripe.';

CREATE INDEX IF NOT EXISTS idx_clinics_stripe_customer
  ON public.clinics (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinics_stripe_subscription
  ON public.clinics (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL AND deleted_at IS NULL;

-- Ação 2: price_ids alinhados ao catálogo (Stripe = financeiro, DB = permissões)
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS stripe_price_id_test TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_live TEXT;

COMMENT ON COLUMN public.planos.stripe_price_id_test IS
  'Price ID Stripe (modo test) para checkout de produção da plataforma.';
COMMENT ON COLUMN public.planos.stripe_price_id_live IS
  'Price ID Stripe (modo live) para checkout de produção da plataforma.';

-- Terapeuta autônomo — IDs validados no laboratório Stripe
UPDATE public.planos
SET
  stripe_price_id_test = 'price_1TtyetAXhFKHrqfcLwcQ5r2e',
  stripe_price_id_live = 'price_1TtyMhAXhFKHrqfcHho1xWxM'
WHERE id = 'inicial';

UPDATE public.planos
SET
  stripe_price_id_test = 'price_1TtyevAXhFKHrqfcXEoJ7RtJ',
  stripe_price_id_live = 'price_1TtyNBAXhFKHrqfciic17hmt'
WHERE id = 'intermediario';

-- ============================================================
-- Malha de segurança: cron diário 03:00 America/Sao_Paulo (06:00 UTC)
-- Requer vault.cron_secret (mesmo valor de CRON_SECRET nas Edge Functions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoke_sync_stripe_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT := 'https://yfzhjdfvaosezyjvbyid.supabase.co/functions/v1/sync-stripe-subscriptions';
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'cron_secret não configurado no Vault — sync Stripe ignorado';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', v_secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_sync_stripe_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_sync_stripe_subscriptions() TO postgres;

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'sync_stripe_subscriptions_daily' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'sync_stripe_subscriptions_daily',
  '0 6 * * *',
  $$SELECT public.invoke_sync_stripe_subscriptions();$$
);
