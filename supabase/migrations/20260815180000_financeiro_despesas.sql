-- ============================================================
-- Despesas — baixa de saída + índice de parcela no gerador mensal
-- ============================================================

CREATE OR REPLACE FUNCTION public.financeiro_baixar_despesa(
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
    AND tipo = 'SAIDA'
    AND status IN ('PENDENTE', 'ATRASADO');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TX_NOT_PAYABLE';
  END IF;

  RETURN p_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_gerar_custos_mes(
  p_clinic_id UUID,
  p_year_month TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_year INT;
  v_month INT;
  r RECORD;
  v_due DATE;
  v_chave TEXT;
  v_status TEXT;
  v_comp DATE;
  v_cat TEXT;
  v_idx INT;
  v_desc TEXT;
BEGIN
  IF p_year_month IS NULL OR p_year_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'MONTH_INVALID';
  END IF;

  v_year := split_part(p_year_month, '-', 1)::INT;
  v_month := split_part(p_year_month, '-', 2)::INT;
  v_comp := make_date(v_year, v_month, 1);

  FOR r IN
    SELECT *
    FROM public.financeiro_custos_recorrentes
    WHERE clinic_id = p_clinic_id
      AND deleted_at IS NULL
      AND ativo = true
  LOOP
    IF r.kind = 'PONTUAL' THEN
      CONTINUE;
    END IF;
    IF r.kind = 'VARIAVEL_PARCELADA' THEN
      IF r.starts_on IS NULL OR r.months_total IS NULL THEN
        CONTINUE;
      END IF;
      IF v_comp < date_trunc('month', r.starts_on)::date THEN
        CONTINUE;
      END IF;
      IF v_comp > date_trunc('month', COALESCE(r.ends_on, public.financeiro_calcular_fim_parcelamento(r.starts_on, r.months_total)))::date THEN
        CONTINUE;
      END IF;
    END IF;

    v_due := public.financeiro_clamp_due_day(v_year, v_month, r.dia_vencimento);
    v_chave := r.id::TEXT || ':' || p_year_month;
    v_status := CASE WHEN v_due < CURRENT_DATE THEN 'ATRASADO' ELSE 'PENDENTE' END;
    v_cat := CASE
      WHEN r.kind = 'VARIAVEL_PARCELADA' THEN 'DESPESA_PARCELADA'
      ELSE r.categoria
    END;
    v_idx := CASE
      WHEN r.kind = 'VARIAVEL_PARCELADA' AND r.starts_on IS NOT NULL THEN
        ((v_year - extract(year FROM r.starts_on)::INT) * 12
          + (v_month - extract(month FROM r.starts_on)::INT) + 1)
      ELSE NULL
    END;
    v_desc := CASE
      WHEN r.kind = 'VARIAVEL_PARCELADA' AND v_idx IS NOT NULL THEN
        r.descricao || ' (' || v_idx || '/' || r.months_total || ')'
      ELSE r.descricao
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.financeiro_transacoes t
      WHERE t.clinic_id = p_clinic_id
        AND t.recorrencia_chave = v_chave
        AND t.deleted_at IS NULL
        AND t.status <> 'CANCELADO'
    ) THEN
      INSERT INTO public.financeiro_transacoes (
        clinic_id, tipo, categoria, descricao, valor_cents,
        data_vencimento, status, professional_id,
        recorrente, recorrencia_chave, competence_month,
        installment_current, installment_total, source, metadata, created_by
      ) VALUES (
        p_clinic_id, 'SAIDA', v_cat, v_desc, r.valor_cents,
        v_due, v_status, r.professional_id,
        true, v_chave, v_comp,
        v_idx,
        CASE WHEN r.kind = 'VARIAVEL_PARCELADA' THEN r.months_total ELSE NULL END,
        CASE WHEN r.kind = 'VARIAVEL_PARCELADA' THEN 'expense_installment' ELSE 'expense_fixed' END,
        jsonb_build_object('custo_recorrente_id', r.id),
        r.created_by
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE public.financeiro_transacoes
  SET status = 'ATRASADO', updated_at = now()
  WHERE clinic_id = p_clinic_id
    AND deleted_at IS NULL
    AND status = 'PENDENTE'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_baixar_despesa(UUID, UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_baixar_despesa(UUID, UUID, DATE, TEXT) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.financeiro_baixar_despesa(UUID, UUID, DATE, TEXT) TO unithery_app;
  END IF;
END $$;
