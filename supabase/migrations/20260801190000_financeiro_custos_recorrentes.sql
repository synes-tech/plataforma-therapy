-- Controle de custos fixos mensais (templates + geração de títulos)

CREATE TABLE IF NOT EXISTS public.financeiro_custos_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'CUSTO_FIXO'
    CHECK (categoria IN ('CUSTO_FIXO', 'IMPOSTO', 'OUTROS')),
  valor_cents INT NOT NULL CHECK (valor_cents >= 0),
  dia_vencimento INT NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 28),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_financeiro_custos_clinic_ativo
  ON public.financeiro_custos_recorrentes (clinic_id, ativo)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_financeiro_custos_updated_at ON public.financeiro_custos_recorrentes;
CREATE TRIGGER trg_financeiro_custos_updated_at
  BEFORE UPDATE ON public.financeiro_custos_recorrentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Evita duplicar título do mesmo custo no mesmo mês
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_tx_recorrencia_chave
  ON public.financeiro_transacoes (clinic_id, recorrencia_chave)
  WHERE recorrencia_chave IS NOT NULL
    AND deleted_at IS NULL
    AND status <> 'CANCELADO';

ALTER TABLE public.financeiro_custos_recorrentes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT := 'financeiro_custos_recorrentes';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_master_all', t);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated
     USING ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''master'')
     WITH CHECK ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''master'')',
    t || '_master_all', t
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_select', t);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated
     USING (
       clinic_id = ((auth.jwt() -> ''app_metadata'' ->> ''clinic_id'')::uuid)
       AND public.is_finance_owner()
       AND deleted_at IS NULL
     )',
    t || '_owner_select', t
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_write', t);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR INSERT TO authenticated
     WITH CHECK (
       clinic_id = ((auth.jwt() -> ''app_metadata'' ->> ''clinic_id'')::uuid)
       AND public.is_finance_owner()
     )',
    t || '_owner_write', t
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_update', t);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR UPDATE TO authenticated
     USING (
       clinic_id = ((auth.jwt() -> ''app_metadata'' ->> ''clinic_id'')::uuid)
       AND public.is_finance_owner()
     )
     WITH CHECK (
       clinic_id = ((auth.jwt() -> ''app_metadata'' ->> ''clinic_id'')::uuid)
       AND public.is_finance_owner()
     )',
    t || '_owner_update', t
  );
END $$;

GRANT SELECT, INSERT, UPDATE ON public.financeiro_custos_recorrentes TO authenticated;
GRANT ALL ON public.financeiro_custos_recorrentes TO service_role;

-- Gera títulos PENDENTE do mês para custos ativos (idempotente)
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
BEGIN
  IF p_year_month IS NULL OR p_year_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'MONTH_INVALID';
  END IF;

  v_year := split_part(p_year_month, '-', 1)::INT;
  v_month := split_part(p_year_month, '-', 2)::INT;

  FOR r IN
    SELECT *
    FROM public.financeiro_custos_recorrentes
    WHERE clinic_id = p_clinic_id
      AND deleted_at IS NULL
      AND ativo = true
  LOOP
    v_due := make_date(v_year, v_month, r.dia_vencimento);
    v_chave := r.id::TEXT || ':' || p_year_month;
    v_status := CASE WHEN v_due < CURRENT_DATE THEN 'ATRASADO' ELSE 'PENDENTE' END;

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
        recorrente, recorrencia_chave, metadata, created_by
      ) VALUES (
        p_clinic_id, 'SAIDA', r.categoria, r.descricao, r.valor_cents,
        v_due, v_status, r.professional_id,
        true, v_chave,
        jsonb_build_object('custo_recorrente_id', r.id),
        r.created_by
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Marca atrasados de custos (e demais) deste clinic
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

REVOKE ALL ON FUNCTION public.financeiro_gerar_custos_mes(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_gerar_custos_mes(UUID, TEXT) TO service_role;
