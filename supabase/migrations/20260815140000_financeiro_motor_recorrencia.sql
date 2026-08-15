-- ============================================================
-- Motor de recorrência — sincronizar janelas + cron mensal
-- Transação única: janelas → agenda → fatura (idempotente).
-- ============================================================

CREATE OR REPLACE FUNCTION public.financeiro_sincronizar_recorrencia(
  p_clinic_id UUID,
  p_contract_id UUID,
  p_janelas JSONB,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.financeiro_planos_paciente%ROWTYPE;
  v_item JSONB;
  v_weekday INT;
  v_time TIME;
  v_duration INT;
  v_tz TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_key TEXT;
  v_janelas_count INT := 0;
  v_cancelled INT := 0;
  v_agenda JSONB;
  v_fatura_atual INT;
  v_comp TEXT;
BEGIN
  IF p_clinic_id IS NULL OR p_contract_id IS NULL THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND';
  END IF;
  IF p_janelas IS NULL OR jsonb_typeof(p_janelas) <> 'array' OR jsonb_array_length(p_janelas) < 1 THEN
    RAISE EXCEPTION 'WINDOWS_REQUIRED';
  END IF;
  IF jsonb_array_length(p_janelas) > 14 THEN
    RAISE EXCEPTION 'WINDOW_INVALID';
  END IF;

  SELECT * INTO v_plan
  FROM public.financeiro_planos_paciente
  WHERE id = p_contract_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND';
  END IF;
  IF v_plan.billing_type <> 'MENSAL_RECORRENTE' OR v_plan.ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'CONTRACT_NOT_RECURRING';
  END IF;

  UPDATE public.financeiro_contrato_janelas
  SET deleted_at = now()
  WHERE contract_id = p_contract_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_janelas)
  LOOP
    BEGIN
      v_weekday := (v_item->>'weekday')::INT;
      v_time := (v_item->>'start_time')::TIME;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'WINDOW_INVALID';
    END;
    IF v_weekday IS NULL OR v_weekday < 1 OR v_weekday > 7 OR v_time IS NULL THEN
      RAISE EXCEPTION 'WINDOW_INVALID';
    END IF;

    v_duration := COALESCE(NULLIF(v_item->>'duration_minutes', '')::INT, 50);
    IF v_duration < 15 OR v_duration > 240 THEN
      RAISE EXCEPTION 'WINDOW_INVALID';
    END IF;
    v_tz := COALESCE(NULLIF(v_item->>'timezone', ''), 'America/Sao_Paulo');
    v_key := v_weekday::text || '@' || v_time::text;
    IF v_key = ANY (v_seen) THEN
      RAISE EXCEPTION 'WINDOW_DUPLICATE';
    END IF;
    v_seen := array_append(v_seen, v_key);

    INSERT INTO public.financeiro_contrato_janelas (
      clinic_id, contract_id, patient_id, professional_id,
      weekday, start_time, duration_minutes, timezone, created_by
    ) VALUES (
      p_clinic_id,
      p_contract_id,
      v_plan.patient_id,
      COALESCE(v_plan.professional_id, NULL),
      v_weekday,
      v_time,
      v_duration,
      v_tz,
      p_created_by
    );
    v_janelas_count := v_janelas_count + 1;
  END LOOP;

  UPDATE public.therapist_schedule s
  SET deleted_at = now(), status = 'cancelled'
  WHERE s.financial_contract_id = p_contract_id
    AND s.clinic_id = p_clinic_id
    AND s.schedule_source = 'recurrence'
    AND s.deleted_at IS NULL
    AND s.status = 'scheduled'
    AND s.started_at IS NULL
    AND s.scheduled_at > now();
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.financeiro_sessoes_cobranca c
  SET status_cobranca = 'CANCELADO', deleted_at = now()
  FROM public.therapist_schedule s
  WHERE c.schedule_id = s.id
    AND s.financial_contract_id = p_contract_id
    AND s.clinic_id = p_clinic_id
    AND s.schedule_source = 'recurrence'
    AND s.status = 'cancelled'
    AND s.deleted_at IS NOT NULL
    AND c.deleted_at IS NULL
    AND c.status_cobranca IN ('INCLUIDO_MENSALIDADE', 'AGUARDANDO_SESSAO');

  v_agenda := public.financeiro_expandir_agenda_contrato(p_contract_id, NULL);

  v_comp := to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM');
  v_fatura_atual := public.financeiro_gerar_faturas_mensais(p_clinic_id, v_comp);

  RETURN jsonb_build_object(
    'contract_id', p_contract_id,
    'janelas_count', v_janelas_count,
    'cancelled_future', v_cancelled,
    'agenda', v_agenda,
    'invoices_created', v_fatura_atual,
    'competence_month', v_comp
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_processar_recorrencia_todas(
  p_year_month TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current TEXT;
  v_next TEXT;
  v_clinic UUID;
  v_contract UUID;
  v_invoices INT := 0;
  v_clinics INT := 0;
  v_expanded INT := 0;
  v_agenda JSONB;
  v_until DATE;
BEGIN
  v_current := COALESCE(
    p_year_month,
    to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM')
  );
  IF v_current !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'MONTH_INVALID';
  END IF;
  v_next := to_char((to_date(v_current || '-01', 'YYYY-MM-DD') + interval '1 month'), 'YYYY-MM');
  v_until := (to_date(v_next || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;

  FOR v_clinic IN
    SELECT DISTINCT p.clinic_id
    FROM public.financeiro_planos_paciente p
    WHERE p.deleted_at IS NULL
      AND p.ativo = true
      AND p.billing_type = 'MENSAL_RECORRENTE'
  LOOP
    v_invoices := v_invoices + public.financeiro_gerar_faturas_mensais(v_clinic, v_current);
    v_invoices := v_invoices + public.financeiro_gerar_faturas_mensais(v_clinic, v_next);
    v_clinics := v_clinics + 1;
  END LOOP;

  FOR v_contract IN
    SELECT p.id
    FROM public.financeiro_planos_paciente p
    WHERE p.deleted_at IS NULL
      AND p.ativo = true
      AND p.billing_type = 'MENSAL_RECORRENTE'
  LOOP
    v_agenda := public.financeiro_expandir_agenda_contrato(v_contract, v_until);
    v_expanded := v_expanded + COALESCE((v_agenda->>'created')::INT, 0);
  END LOOP;

  PERFORM public.financeiro_promover_sessoes_stale();

  RETURN jsonb_build_object(
    'competence_month', v_current,
    'next_month', v_next,
    'clinics', v_clinics,
    'invoices_created', v_invoices,
    'sessions_created', v_expanded,
    'horizon', v_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_sincronizar_recorrencia(UUID, UUID, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_processar_recorrencia_todas(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_sincronizar_recorrencia(UUID, UUID, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_processar_recorrencia_todas(TEXT) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.financeiro_sincronizar_recorrencia(UUID, UUID, JSONB, UUID) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_processar_recorrencia_todas(TEXT) TO unithery_app;
  END IF;
END $$;

COMMENT ON FUNCTION public.financeiro_sincronizar_recorrencia(UUID, UUID, JSONB, UUID)
  IS 'Substitui janelas do contrato mensal, reprojeta agenda futura e gera fatura do mês (atômico).';
COMMENT ON FUNCTION public.financeiro_processar_recorrencia_todas(TEXT)
  IS 'Cron: faturas do mês atual + seguinte, expansão de agenda e promoção de atrasados.';
