-- ============================================================
-- UNITHERY — Conta administrativa isenta de billing/cotas
-- Exceção única: joao@synes.tech (flag billing_exempt na clínica)
-- ============================================================

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS billing_exempt BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinics.billing_exempt IS
  'Conta administrativa da plataforma: sem cobrança Stripe, paywall ou limites de cota.';

CREATE INDEX IF NOT EXISTS idx_clinics_billing_exempt
  ON public.clinics (billing_exempt)
  WHERE billing_exempt = true AND deleted_at IS NULL;

-- Isenta a conta joao@synes.tech e normaliza status (sem assinatura Stripe real)
UPDATE public.clinics
SET
  billing_exempt = true,
  subscription_plan = 'premium'::subscription_plan,
  subscription_status = 'active'::subscription_status,
  payment_method_on_file = false,
  stripe_subscription_id = NULL,
  stripe_customer_id = NULL,
  billing_cycle = 'monthly',
  commitment_ends_at = NULL,
  stripe_schedule_id = NULL,
  downgraded_at = NULL
WHERE deleted_at IS NULL
  AND lower(email) = 'joao@synes.tech';

-- Cotas ilimitadas para clínicas isentas (SQL)
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
  v_exempt BOOLEAN;
  v_pac_limit INT;
  v_per_patient INT;
  v_addon_pacientes INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_total_used INT;
  v_patient_used INT := 0;
  v_total_limit INT;
BEGIN
  SELECT c.subscription_plan::text, COALESCE(c.billing_exempt, false)
  INTO v_plan, v_exempt
  FROM clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('error', 'clinic_not_found');
  END IF;

  IF v_exempt THEN
    RETURN jsonb_build_object(
      'unlimited', true,
      'total_used', NULL, 'total_limit', NULL,
      'patient_used', NULL, 'patient_recommended', NULL,
      'warn_patient', false, 'blocked_total', false
    );
  END IF;

  SELECT p.limite_pacientes_por_prof, p.sessoes_por_paciente_mes
  INTO v_pac_limit, v_per_patient
  FROM planos p WHERE p.id = v_plan;

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

CREATE OR REPLACE FUNCTION public.check_ai_interaction_quota(p_clinic_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_exempt BOOLEAN;
  v_limit INT;
  v_addon_ia INT;
  v_used INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  SELECT c.subscription_plan::text, COALESCE(c.billing_exempt, false)
  INTO v_plan, v_exempt
  FROM clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('error', 'clinic_not_found');
  END IF;

  IF v_exempt THEN
    RETURN jsonb_build_object(
      'unlimited', true,
      'used', NULL, 'limit', NULL,
      'warn', false, 'blocked', false
    );
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
