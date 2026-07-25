-- ============================================================
-- UNITHERY — Planos de produção v2 (FREE / STANDARD / ADVANCED / PREMIUM)
-- Parte 2/2: catálogo, módulos adicionais, cotas de sessões/IA,
-- trava anual (12x emulado) e migração de dados
-- Ref: docs/plano-implementacao-planos-producao.md
-- ============================================================

-- ------------------------------------------------------------
-- 1. Novas colunas no catálogo `planos`
-- ------------------------------------------------------------

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS preco_anual_mensal_cents INT CHECK (preco_anual_mensal_cents >= 0),
  ADD COLUMN IF NOT EXISTS limite_ia_interacoes_mes INT,
  ADD COLUMN IF NOT EXISTS sessoes_por_paciente_mes INT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS duracao_sessao_minutos INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS stripe_price_id_test_anual TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_live_anual TEXT;

COMMENT ON COLUMN public.planos.preco_anual_mensal_cents IS
  'Parcela mensal do ciclo anual (12x emulado com 12% off). NULL = plano sem ciclo anual.';
COMMENT ON COLUMN public.planos.limite_ia_interacoes_mes IS
  'Interações de IA (chat copilot) por mês. NULL = usa default do código.';
COMMENT ON COLUMN public.planos.sessoes_por_paciente_mes IS
  'Recomendação soft de sessões por paciente/mês. Limite hard = pacientes efetivos × este valor.';
COMMENT ON COLUMN public.planos.duracao_sessao_minutos IS
  'Duração máxima da sessão em minutos (FREE 50, pagos 60).';

-- ------------------------------------------------------------
-- 2. Seed dos planos novos + desativação dos antigos
-- ------------------------------------------------------------

INSERT INTO public.planos (
  id, nome, tipo_perfil, preco_mensal_cents, preco_anual_mensal_cents,
  limite_profissionais, limite_pacientes_por_prof,
  limite_ia_interacoes_mes, sessoes_por_paciente_mes, duracao_sessao_minutos,
  descricao_curta, destaque, features, recomendado, sort_order, ativo
) VALUES
(
  'free',
  'Plano Free',
  'autonomo',
  0,
  NULL,
  1,
  1,
  20,
  4,
  50,
  'Experimente a plataforma sem custo',
  '1 paciente ativo · 4 sessões/mês · sessões de 50 min',
  '[
    "1 paciente ativo",
    "4 sessões por mês (50 minutos cada)",
    "Copiloto de IA (20 interações/mês)",
    "Diário familiar com áudios ilimitados",
    "Portal da família incluso"
  ]'::jsonb,
  false,
  0,
  true
),
(
  'standard',
  'Plano Standard',
  'autonomo',
  23120,
  20346,
  1,
  10,
  750,
  4,
  60,
  'Para quem está começando ou com carteira enxuta',
  'Até 10 pacientes ativos · 40 sessões/mês',
  '[
    "Até 10 pacientes ativos",
    "40 sessões por mês (60 minutos cada)",
    "Copiloto de IA com contexto isolado por paciente (750 interações/mês)",
    "Transcrição de sessões e relatórios",
    "Anexos vetorizados na base de conhecimento",
    "Diário familiar com áudios ilimitados",
    "Módulos Adicionais de +5 pacientes quando precisar"
  ]'::jsonb,
  false,
  1,
  true
),
(
  'advanced',
  'Plano Advanced',
  'autonomo',
  46240,
  40691,
  1,
  20,
  1500,
  4,
  60,
  'Para terapeutas com carteira consolidada',
  'Até 20 pacientes ativos · 80 sessões/mês',
  '[
    "Até 20 pacientes ativos",
    "80 sessões por mês (60 minutos cada)",
    "Copiloto de IA com contexto isolado por paciente (1.500 interações/mês)",
    "Transcrição de sessões e relatórios",
    "Anexos vetorizados na base de conhecimento",
    "Diário familiar com áudios ilimitados",
    "Módulos Adicionais de +5 pacientes quando precisar"
  ]'::jsonb,
  true,
  2,
  true
),
(
  'premium',
  'Plano Premium',
  'autonomo',
  69360,
  61037,
  1,
  30,
  2250,
  4,
  60,
  'Máxima capacidade para carteira ampla',
  'Até 30 pacientes ativos · 120 sessões/mês',
  '[
    "Até 30 pacientes ativos",
    "120 sessões por mês (60 minutos cada)",
    "Copiloto de IA com contexto isolado por paciente (2.250 interações/mês)",
    "Transcrição de sessões e relatórios",
    "Anexos vetorizados na base de conhecimento",
    "Diário familiar com áudios ilimitados",
    "Módulo Adicional com desconto exclusivo"
  ]'::jsonb,
  false,
  3,
  true
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo_perfil = EXCLUDED.tipo_perfil,
  preco_mensal_cents = EXCLUDED.preco_mensal_cents,
  preco_anual_mensal_cents = EXCLUDED.preco_anual_mensal_cents,
  limite_profissionais = EXCLUDED.limite_profissionais,
  limite_pacientes_por_prof = EXCLUDED.limite_pacientes_por_prof,
  limite_ia_interacoes_mes = EXCLUDED.limite_ia_interacoes_mes,
  sessoes_por_paciente_mes = EXCLUDED.sessoes_por_paciente_mes,
  duracao_sessao_minutos = EXCLUDED.duracao_sessao_minutos,
  descricao_curta = EXCLUDED.descricao_curta,
  destaque = EXCLUDED.destaque,
  features = EXCLUDED.features,
  recomendado = EXCLUDED.recomendado,
  sort_order = EXCLUDED.sort_order,
  ativo = EXCLUDED.ativo,
  updated_at = now();

UPDATE public.planos
SET ativo = false, updated_at = now()
WHERE id IN ('inicial', 'intermediario');

-- Ajuste no FREE: sessão de 50 min (default da coluna é 60)
UPDATE public.planos SET duracao_sessao_minutos = 50 WHERE id = 'free';

-- ------------------------------------------------------------
-- 3. Módulos Adicionais (catálogo + contratações por clínica)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plan_addons (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  pacientes_bonus INT NOT NULL CHECK (pacientes_bonus > 0),
  ia_bonus_mes INT NOT NULL DEFAULT 0,
  preco_mensal_cents INT NOT NULL CHECK (preco_mensal_cents >= 0),
  preco_anual_mensal_cents INT CHECK (preco_anual_mensal_cents >= 0),
  planos_aplicaveis TEXT[] NOT NULL DEFAULT '{}',
  stripe_price_id_test_mensal TEXT,
  stripe_price_id_test_anual TEXT,
  stripe_price_id_live_mensal TEXT,
  stripe_price_id_live_anual TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_addons IS
  'Catálogo de Módulos Adicionais (upsell de pacientes). Cada módulo = +5 pacientes, +20 sessões, +375 IA.';

DROP TRIGGER IF EXISTS trg_plan_addons_updated ON public.plan_addons;
CREATE TRIGGER trg_plan_addons_updated
  BEFORE UPDATE ON public.plan_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.plan_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_addons_public_read" ON public.plan_addons;
CREATE POLICY "plan_addons_public_read"
  ON public.plan_addons FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

GRANT SELECT ON public.plan_addons TO anon, authenticated;

INSERT INTO public.plan_addons (
  id, nome, pacientes_bonus, ia_bonus_mes,
  preco_mensal_cents, preco_anual_mensal_cents, planos_aplicaveis, ativo
) VALUES
(
  'modulo_sa',
  'Módulo Adicional (+5 pacientes)',
  5,
  375,
  12943,
  11390,
  ARRAY['standard', 'advanced'],
  true
),
(
  'modulo_p',
  'Módulo Adicional Premium (+5 pacientes)',
  5,
  375,
  10632,
  9356,
  ARRAY['premium'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  pacientes_bonus = EXCLUDED.pacientes_bonus,
  ia_bonus_mes = EXCLUDED.ia_bonus_mes,
  preco_mensal_cents = EXCLUDED.preco_mensal_cents,
  preco_anual_mensal_cents = EXCLUDED.preco_anual_mensal_cents,
  planos_aplicaveis = EXCLUDED.planos_aplicaveis,
  ativo = EXCLUDED.ativo,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.clinic_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  addon_id TEXT NOT NULL REFERENCES public.plan_addons(id),
  quantidade INT NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_subscription_item_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at TIMESTAMPTZ
);

COMMENT ON TABLE public.clinic_addons IS
  'Módulos Adicionais contratados por clínica (fonte de verdade dos bônus de pacientes/IA).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_addons_active_unique
  ON public.clinic_addons (clinic_id, addon_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_clinic_addons_clinic
  ON public.clinic_addons (clinic_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_clinic_addons_updated ON public.clinic_addons;
CREATE TRIGGER trg_clinic_addons_updated
  BEFORE UPDATE ON public.clinic_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.clinic_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_addons_master" ON public.clinic_addons;
CREATE POLICY "clinic_addons_master"
  ON public.clinic_addons FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master');

DROP POLICY IF EXISTS "clinic_addons_member_read" ON public.clinic_addons;
CREATE POLICY "clinic_addons_member_read"
  ON public.clinic_addons FOR SELECT
  USING (
    clinic_id IN (
      SELECT p.clinic_id FROM public.professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    OR (
      clinic_id = ((auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
      AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    )
  );

GRANT SELECT ON public.clinic_addons TO authenticated;

-- ------------------------------------------------------------
-- 4. Colunas de billing na clínica (ciclo, trial único, trava anual)
-- ------------------------------------------------------------

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS downgraded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commitment_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_schedule_id TEXT;

COMMENT ON COLUMN public.clinics.trial_used IS
  'True quando a clínica já consumiu o trial de 14 dias (concedido uma única vez).';
COMMENT ON COLUMN public.clinics.commitment_ends_at IS
  'Fim do compromisso anual (12x emulado). Enquanto no futuro: trava remoção de cartão e aplica quebra de fidelidade em cancelamento.';
COMMENT ON COLUMN public.clinics.stripe_schedule_id IS
  'Subscription Schedule ID (sub_sched_…) do ciclo anual 12x na Stripe.';

-- ------------------------------------------------------------
-- 5. Registro de consumo de IA (1 linha por interação)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID,
  feature TEXT NOT NULL DEFAULT 'copilot',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_events IS
  'Consumo de interações de IA (chat copilot etc.) para cota mensal por clínica.';

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_clinic_month
  ON public.ai_usage_events (clinic_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Escrita/leitura apenas via service_role (Edge Functions); sem policies para clients.

-- ------------------------------------------------------------
-- 6. Funções de cota
-- ------------------------------------------------------------

-- Bônus ativos (pacientes / IA) a partir dos módulos contratados
CREATE OR REPLACE FUNCTION public.get_clinic_addon_bonuses(p_clinic_id UUID)
RETURNS TABLE (pacientes_bonus INT, ia_bonus INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(pa.pacientes_bonus * ca.quantidade), 0)::int,
    COALESCE(SUM(pa.ia_bonus_mes * ca.quantidade), 0)::int
  FROM clinic_addons ca
  JOIN plan_addons pa ON pa.id = ca.addon_id
  WHERE ca.clinic_id = p_clinic_id AND ca.status = 'active';
$$;

-- Estado da cota de sessões do mês corrente
-- Soft: sessoes_por_paciente_mes por paciente | Hard: pacientes efetivos × sessoes_por_paciente_mes
CREATE OR REPLACE FUNCTION public.check_session_quota(
  p_clinic_id UUID,
  p_patient_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_pac_limit INT;
  v_per_patient INT;
  v_addon_pacientes INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_total_used INT;
  v_patient_used INT := 0;
  v_total_limit INT;
BEGIN
  SELECT c.subscription_plan::text INTO v_plan
  FROM clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('error', 'clinic_not_found');
  END IF;

  SELECT p.limite_pacientes_por_prof, p.sessoes_por_paciente_mes
  INTO v_pac_limit, v_per_patient
  FROM planos p WHERE p.id = v_plan;

  -- Plano sem limite definido (ex.: enterprise) → sem cota
  IF v_pac_limit IS NULL THEN
    RETURN jsonb_build_object(
      'unlimited', true,
      'total_used', NULL, 'total_limit', NULL,
      'patient_used', NULL, 'patient_recommended', NULL,
      'warn_patient', false, 'blocked_total', false
    );
  END IF;

  v_per_patient := COALESCE(v_per_patient, 4);

  SELECT b.pacientes_bonus INTO v_addon_pacientes
  FROM get_clinic_addon_bonuses(p_clinic_id) b;

  v_total_limit := (v_pac_limit + COALESCE(v_addon_pacientes, 0)) * v_per_patient;

  SELECT COUNT(*)::int INTO v_total_used
  FROM therapist_schedule ts
  WHERE ts.clinic_id = p_clinic_id
    AND ts.deleted_at IS NULL
    AND ts.status <> 'cancelled'
    AND ts.scheduled_at >= v_month_start
    AND ts.scheduled_at < v_month_start + INTERVAL '1 month';

  IF p_patient_id IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_patient_used
    FROM therapist_schedule ts
    WHERE ts.clinic_id = p_clinic_id
      AND ts.patient_id = p_patient_id
      AND ts.deleted_at IS NULL
      AND ts.status <> 'cancelled'
      AND ts.scheduled_at >= v_month_start
      AND ts.scheduled_at < v_month_start + INTERVAL '1 month';
  END IF;

  RETURN jsonb_build_object(
    'unlimited', false,
    'total_used', v_total_used,
    'total_limit', v_total_limit,
    'patient_used', v_patient_used,
    'patient_recommended', v_per_patient,
    'warn_patient', p_patient_id IS NOT NULL AND v_patient_used >= v_per_patient,
    'blocked_total', v_total_used >= v_total_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_session_quota(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_session_quota(UUID, UUID) TO service_role;

-- Estado da cota de interações de IA do mês corrente
CREATE OR REPLACE FUNCTION public.check_ai_interaction_quota(p_clinic_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limit INT;
  v_addon_ia INT;
  v_used INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  SELECT c.subscription_plan::text INTO v_plan
  FROM clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('error', 'clinic_not_found');
  END IF;

  SELECT p.limite_ia_interacoes_mes INTO v_limit
  FROM planos p WHERE p.id = v_plan;

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object(
      'unlimited', true,
      'used', NULL, 'limit', NULL,
      'warn', false, 'blocked', false
    );
  END IF;

  SELECT b.ia_bonus INTO v_addon_ia
  FROM get_clinic_addon_bonuses(p_clinic_id) b;

  v_limit := v_limit + COALESCE(v_addon_ia, 0);

  SELECT COUNT(*)::int INTO v_used
  FROM ai_usage_events e
  WHERE e.clinic_id = p_clinic_id
    AND e.created_at >= v_month_start;

  RETURN jsonb_build_object(
    'unlimited', false,
    'used', v_used,
    'limit', v_limit,
    'warn', v_used >= (v_limit * 0.8)::int,
    'blocked', v_used >= v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_interaction_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ai_interaction_quota(UUID) TO service_role;

-- Sincroniza professionals.patient_quota_bonus a partir dos módulos ativos
-- (compatibilidade com o enforcement existente de limite de pacientes)
CREATE OR REPLACE FUNCTION public.sync_patient_quota_bonus_from_addons(p_clinic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus INT;
BEGIN
  SELECT b.pacientes_bonus INTO v_bonus
  FROM get_clinic_addon_bonuses(p_clinic_id) b;

  UPDATE professionals
  SET patient_quota_bonus = COALESCE(v_bonus, 0)
  WHERE clinic_id = p_clinic_id AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_patient_quota_bonus_from_addons(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_patient_quota_bonus_from_addons(UUID) TO service_role;

-- ------------------------------------------------------------
-- 7. sync_clinic_settings_from_plano v2 (inclui cota de IA)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_clinic_settings_from_plano(p_clinic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limite_prof INT;
  v_limite_pac INT;
  v_limite_ia INT;
BEGIN
  SELECT c.subscription_plan::text INTO v_plan
  FROM clinics c
  WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN;
  END IF;

  SELECT limite_profissionais, limite_pacientes_por_prof, limite_ia_interacoes_mes
  INTO v_limite_prof, v_limite_pac, v_limite_ia
  FROM planos
  WHERE id = v_plan;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE clinic_settings
  SET
    max_professionals = COALESCE(v_limite_prof, max_professionals),
    max_patients_per_professional = COALESCE(v_limite_pac, max_patients_per_professional),
    max_ai_queries_per_month = COALESCE(v_limite_ia, max_ai_queries_per_month),
    updated_at = now()
  WHERE clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    INSERT INTO clinic_settings (
      clinic_id,
      max_professionals,
      max_patients_per_professional,
      max_ai_queries_per_month
    ) VALUES (
      p_clinic_id,
      COALESCE(v_limite_prof, 5),
      COALESCE(v_limite_pac, 30),
      COALESCE(v_limite_ia, 500)
    );
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 8. Migração de dados das clínicas existentes
-- ------------------------------------------------------------

-- 8.1 Quem já tem billing/cartão consumiu o trial
UPDATE public.clinics
SET trial_used = true
WHERE deleted_at IS NULL
  AND (
    payment_method_on_file = true
    OR stripe_subscription_id IS NOT NULL
    OR subscription_status::text IN ('active', 'trial_active', 'past_due')
  );

-- 8.2 Planos antigos → novos (mantém status/billing)
UPDATE public.clinics
SET subscription_plan = 'standard'::subscription_plan
WHERE subscription_plan::text = 'inicial' AND deleted_at IS NULL;

UPDATE public.clinics
SET subscription_plan = 'advanced'::subscription_plan
WHERE subscription_plan::text = 'intermediario' AND deleted_at IS NULL;

-- 8.3 Clínicas em trial PLG sem cartão → FREE (novo modelo de entrada)
UPDATE public.clinics
SET subscription_plan = 'free'::subscription_plan
WHERE subscription_status::text = 'trialing'
  AND payment_method_on_file = false
  AND stripe_subscription_id IS NULL
  AND deleted_at IS NULL;

-- 8.4 Reaplica limites de settings a partir do plano
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.clinics WHERE deleted_at IS NULL
  LOOP
    PERFORM public.sync_clinic_settings_from_plano(r.id);
  END LOOP;
END $$;
