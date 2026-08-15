-- ============================================================
-- Recebíveis — promover atrasados + sessão avulsa no histórico
-- ============================================================

CREATE OR REPLACE FUNCTION public.financeiro_promover_recebiveis_atrasados(
  p_clinic_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_REQUIRED';
  END IF;

  UPDATE public.financeiro_transacoes
  SET status = 'ATRASADO', updated_at = now()
  WHERE clinic_id = p_clinic_id
    AND deleted_at IS NULL
    AND tipo = 'ENTRADA'
    AND status = 'PENDENTE'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DROP FUNCTION IF EXISTS public.financeiro_baixar_transacao(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION public.financeiro_baixar_transacao(
  p_clinic_id UUID,
  p_tx_id UUID,
  p_paid_date DATE DEFAULT CURRENT_DATE,
  p_forma_pagamento TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.financeiro_transacoes
  SET
    status = 'PAGO',
    data_pagamento = COALESCE(p_paid_date, CURRENT_DATE),
    metadata = CASE
      WHEN p_forma_pagamento IS NULL OR btrim(p_forma_pagamento) = '' THEN metadata
      ELSE coalesce(metadata, '{}'::jsonb) || jsonb_build_object('forma_pagamento', p_forma_pagamento)
    END,
    updated_at = now()
  WHERE id = p_tx_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL
    AND tipo = 'ENTRADA'
    AND status IN ('PENDENTE', 'ATRASADO');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TX_NOT_PAYABLE';
  END IF;

  RETURN p_tx_id;
END;
$$;

DROP FUNCTION IF EXISTS public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.financeiro_registrar_sessao_avulsa(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_valor_cents INT,
  p_schedule_id UUID DEFAULT NULL,
  p_paid BOOLEAN DEFAULT false,
  p_created_by UUID DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx UUID;
  v_plan public.financeiro_planos_paciente%ROWTYPE;
  v_cat TEXT;
  v_status TEXT;
  v_schedule UUID;
  v_when TIMESTAMPTZ;
BEGIN
  IF p_valor_cents IS NULL OR p_valor_cents < 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients pt
    WHERE pt.id = p_patient_id
      AND pt.clinic_id = p_clinic_id
      AND pt.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  SELECT * INTO v_plan
  FROM public.financeiro_planos_paciente
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL
  LIMIT 1;

  v_schedule := p_schedule_id;
  v_when := COALESCE(p_occurred_at, now());

  IF v_schedule IS NULL AND p_professional_id IS NOT NULL THEN
    INSERT INTO public.therapist_schedule (
      professional_id, patient_id, clinic_id, title, scheduled_at, duration_minutes,
      status, financial_contract_id, schedule_source
    ) VALUES (
      p_professional_id,
      p_patient_id,
      p_clinic_id,
      COALESCE(NULLIF(trim(p_descricao), ''), 'Sessão avulsa'),
      v_when,
      50,
      'completed',
      v_plan.id,
      'finance_manual'
    )
    RETURNING id INTO v_schedule;
  END IF;

  v_cat := CASE
    WHEN v_plan.model_type = 'CONVENIO' THEN 'CONVENIO_AVULSO'
    WHEN p_schedule_id IS NULL THEN 'SESSAO_MANUAL'
    ELSE 'SESSAO_AVULSA'
  END;
  v_status := CASE WHEN p_paid THEN 'PAGO' ELSE 'PENDENTE' END;

  INSERT INTO public.financeiro_transacoes (
    clinic_id, tipo, categoria, descricao, valor_cents,
    data_vencimento, data_pagamento, status,
    paciente_id, sessao_id, professional_id, contract_id,
    competence_month, source, created_by
  ) VALUES (
    p_clinic_id, 'ENTRADA', v_cat,
    COALESCE(NULLIF(trim(p_descricao), ''), 'Sessão avulsa'),
    p_valor_cents,
    v_when::date,
    CASE WHEN p_paid THEN v_when::date ELSE NULL END,
    v_status,
    p_patient_id, v_schedule, p_professional_id, v_plan.id,
    date_trunc('month', v_when AT TIME ZONE 'America/Sao_Paulo')::date,
    CASE WHEN p_schedule_id IS NULL THEN 'session_manual' ELSE 'session_avulso' END,
    p_created_by
  )
  RETURNING id INTO v_tx;

  IF v_schedule IS NOT NULL THEN
    INSERT INTO public.financeiro_sessoes_cobranca (
      clinic_id, schedule_id, patient_id, professional_id,
      status_cobranca, valor_previsto_cents, transacao_id
    ) VALUES (
      p_clinic_id, v_schedule, p_patient_id, p_professional_id,
      CASE
        WHEN p_paid THEN 'RECEBIDO_AVULSO'
        WHEN p_schedule_id IS NULL THEN 'REGISTRADO_MANUAL'
        ELSE 'PENDENTE_CONFIRMACAO'
      END,
      p_valor_cents, v_tx
    )
    ON CONFLICT (schedule_id) DO UPDATE
      SET status_cobranca = EXCLUDED.status_cobranca,
          transacao_id = v_tx,
          valor_previsto_cents = p_valor_cents,
          updated_at = now(),
          deleted_at = NULL;
  END IF;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_promover_recebiveis_atrasados(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_baixar_transacao(UUID, UUID, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.financeiro_promover_recebiveis_atrasados(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_baixar_transacao(UUID, UUID, DATE, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT, TIMESTAMPTZ) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.financeiro_promover_recebiveis_atrasados(UUID) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_baixar_transacao(UUID, UUID, DATE, TEXT) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT, TIMESTAMPTZ) TO unithery_app;
  END IF;
END $$;
