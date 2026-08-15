-- ============================================================
-- Financeiro v2 — Contratos, janelas de agenda, faturas mensais
-- Evolui o caixa MVP (não cria livro paralelo).
-- PENDENTE no extrato = "A Receber" na UI.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Contrato = financeiro_planos_paciente (regra do paciente)
-- ------------------------------------------------------------
ALTER TABLE public.financeiro_planos_paciente
  ADD COLUMN IF NOT EXISTS model_type TEXT,
  ADD COLUMN IF NOT EXISTS billing_type TEXT,
  ADD COLUMN IF NOT EXISTS valor_acordado_cents INT,
  ADD COLUMN IF NOT EXISTS due_day INT,
  ADD COLUMN IF NOT EXISTS sessions_per_month INT,
  ADD COLUMN IF NOT EXISTS sessions_custom BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_duration_months INT,
  ADD COLUMN IF NOT EXISTS contract_starts_on DATE,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

UPDATE public.financeiro_planos_paciente
SET
  model_type = COALESCE(model_type, 'PARTICULAR'),
  billing_type = COALESCE(
    billing_type,
    CASE modelo
      WHEN 'pacote' THEN 'PACOTE'
      ELSE 'AVULSO'
    END
  ),
  valor_acordado_cents = COALESCE(
    valor_acordado_cents,
    CASE
      WHEN modelo = 'pacote' THEN COALESCE(pacote_valor_cents, valor_sessao_cents, 0)
      ELSE COALESCE(valor_sessao_cents, 0)
    END
  ),
  sessions_per_month = COALESCE(sessions_per_month, pacote_qtd_sessoes),
  contract_starts_on = COALESCE(contract_starts_on, (created_at AT TIME ZONE 'America/Sao_Paulo')::date);

ALTER TABLE public.financeiro_planos_paciente
  ALTER COLUMN model_type SET DEFAULT 'PARTICULAR',
  ALTER COLUMN billing_type SET DEFAULT 'AVULSO',
  ALTER COLUMN valor_acordado_cents SET DEFAULT 0;

UPDATE public.financeiro_planos_paciente
SET model_type = 'PARTICULAR'
WHERE model_type IS NULL;

UPDATE public.financeiro_planos_paciente
SET billing_type = 'AVULSO'
WHERE billing_type IS NULL;

UPDATE public.financeiro_planos_paciente
SET valor_acordado_cents = 0
WHERE valor_acordado_cents IS NULL;

ALTER TABLE public.financeiro_planos_paciente
  ALTER COLUMN model_type SET NOT NULL,
  ALTER COLUMN billing_type SET NOT NULL,
  ALTER COLUMN valor_acordado_cents SET NOT NULL;

ALTER TABLE public.financeiro_planos_paciente
  DROP CONSTRAINT IF EXISTS financeiro_planos_model_type_check;
ALTER TABLE public.financeiro_planos_paciente
  ADD CONSTRAINT financeiro_planos_model_type_check
  CHECK (model_type IN ('PARTICULAR', 'CONVENIO'));

ALTER TABLE public.financeiro_planos_paciente
  DROP CONSTRAINT IF EXISTS financeiro_planos_billing_type_check;
ALTER TABLE public.financeiro_planos_paciente
  ADD CONSTRAINT financeiro_planos_billing_type_check
  CHECK (billing_type IN ('AVULSO', 'MENSAL_RECORRENTE', 'PACOTE'));

ALTER TABLE public.financeiro_planos_paciente
  DROP CONSTRAINT IF EXISTS financeiro_planos_due_day_check;
ALTER TABLE public.financeiro_planos_paciente
  ADD CONSTRAINT financeiro_planos_due_day_check
  CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 28));

ALTER TABLE public.financeiro_planos_paciente
  DROP CONSTRAINT IF EXISTS financeiro_planos_sessions_check;
ALTER TABLE public.financeiro_planos_paciente
  ADD CONSTRAINT financeiro_planos_sessions_check
  CHECK (sessions_per_month IS NULL OR sessions_per_month > 0);

ALTER TABLE public.financeiro_planos_paciente
  DROP CONSTRAINT IF EXISTS financeiro_planos_duration_check;
ALTER TABLE public.financeiro_planos_paciente
  ADD CONSTRAINT financeiro_planos_duration_check
  CHECK (contract_duration_months IS NULL OR contract_duration_months > 0);

ALTER TABLE public.financeiro_planos_paciente
  DROP CONSTRAINT IF EXISTS financeiro_planos_valor_acordado_check;
ALTER TABLE public.financeiro_planos_paciente
  ADD CONSTRAINT financeiro_planos_valor_acordado_check
  CHECK (valor_acordado_cents >= 0);

COMMENT ON COLUMN public.financeiro_planos_paciente.model_type IS 'PARTICULAR | CONVENIO';
COMMENT ON COLUMN public.financeiro_planos_paciente.billing_type IS 'AVULSO | MENSAL_RECORRENTE | PACOTE (legado)';
COMMENT ON COLUMN public.financeiro_planos_paciente.valor_acordado_cents IS 'Mensal = valor da fatura; avulso = valor da sessão';
COMMENT ON COLUMN public.financeiro_planos_paciente.due_day IS 'Dia 1–28; obrigatório se MENSAL_RECORRENTE';
COMMENT ON COLUMN public.financeiro_planos_paciente.modelo IS 'Legado UI: avulso|pacote|social — derivado de billing_type';

CREATE INDEX IF NOT EXISTS idx_financeiro_planos_clinic_billing
  ON public.financeiro_planos_paciente (clinic_id, billing_type)
  WHERE deleted_at IS NULL AND ativo = true;

-- ------------------------------------------------------------
-- 2) Janelas semanais do contrato (motor de agenda)
-- weekday = ISO 1=segunda … 7=domingo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_contrato_janelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.financeiro_planos_paciente(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  weekday INT NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
  start_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 50 CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_janela_unica
  ON public.financeiro_contrato_janelas (contract_id, weekday, start_time)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_janela_clinic
  ON public.financeiro_contrato_janelas (clinic_id, contract_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_financeiro_janelas_updated_at ON public.financeiro_contrato_janelas;
CREATE TRIGGER trg_financeiro_janelas_updated_at
  BEFORE UPDATE ON public.financeiro_contrato_janelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.financeiro_contrato_janelas ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3) Agenda: origem da ocorrência + chave idempotente
-- ------------------------------------------------------------
ALTER TABLE public.therapist_schedule
  ADD COLUMN IF NOT EXISTS financial_contract_id UUID REFERENCES public.financeiro_planos_paciente(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_key TEXT,
  ADD COLUMN IF NOT EXISTS schedule_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.therapist_schedule
  DROP CONSTRAINT IF EXISTS therapist_schedule_source_check;
ALTER TABLE public.therapist_schedule
  ADD CONSTRAINT therapist_schedule_source_check
  CHECK (schedule_source IN ('manual', 'recurrence', 'finance_manual'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_occurrence_key
  ON public.therapist_schedule (occurrence_key)
  WHERE occurrence_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_contract
  ON public.therapist_schedule (financial_contract_id, scheduled_at)
  WHERE deleted_at IS NULL AND financial_contract_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4) Livro-caixa: contrato, competência, parcelas
-- ------------------------------------------------------------
ALTER TABLE public.financeiro_transacoes
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.financeiro_planos_paciente(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS competence_month DATE,
  ADD COLUMN IF NOT EXISTS installment_current INT,
  ADD COLUMN IF NOT EXISTS installment_total INT,
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.financeiro_transacoes
  DROP CONSTRAINT IF EXISTS financeiro_transacoes_categoria_check;
ALTER TABLE public.financeiro_transacoes
  ADD CONSTRAINT financeiro_transacoes_categoria_check
  CHECK (categoria IN (
    'SESSAO_AVULSA', 'PACOTE', 'SESSAO_SOCIAL', 'RENDIMENTO_EXTRA',
    'MENSALIDADE', 'CONVENIO_MENSAL', 'CONVENIO_AVULSO', 'SESSAO_MANUAL',
    'CUSTO_FIXO', 'CUSTO_VARIAVEL', 'IMPOSTO', 'REPASSE_PROFISSIONAL',
    'DESPESA_PARCELADA', 'DESPESA_PONTUAL', 'OUTROS'
  ));

ALTER TABLE public.financeiro_transacoes
  DROP CONSTRAINT IF EXISTS financeiro_tx_installment_check;
ALTER TABLE public.financeiro_transacoes
  ADD CONSTRAINT financeiro_tx_installment_check
  CHECK (
    (installment_current IS NULL AND installment_total IS NULL)
    OR (
      installment_current IS NOT NULL
      AND installment_total IS NOT NULL
      AND installment_current >= 1
      AND installment_total >= 1
      AND installment_current <= installment_total
    )
  );

ALTER TABLE public.financeiro_transacoes
  DROP CONSTRAINT IF EXISTS financeiro_tx_source_check;
ALTER TABLE public.financeiro_transacoes
  ADD CONSTRAINT financeiro_tx_source_check
  CHECK (
    source IS NULL OR source IN (
      'monthly_invoice', 'session_avulso', 'session_manual', 'package',
      'expense_fixed', 'expense_installment', 'expense_oneoff', 'manual'
    )
  );

COMMENT ON COLUMN public.financeiro_transacoes.status IS 'PENDENTE = A Receber na UI; PAGO; ATRASADO; CANCELADO';
COMMENT ON COLUMN public.financeiro_transacoes.competence_month IS 'Primeiro dia do mês de competência';

CREATE INDEX IF NOT EXISTS idx_financeiro_tx_contract
  ON public.financeiro_transacoes (contract_id, competence_month)
  WHERE deleted_at IS NULL AND contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_tx_competence
  ON public.financeiro_transacoes (clinic_id, competence_month, tipo, status)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 5) Cobrança por sessão: mensalidade não vira "a receber" por sessão
-- ------------------------------------------------------------
ALTER TABLE public.financeiro_sessoes_cobranca
  DROP CONSTRAINT IF EXISTS financeiro_sessoes_cobranca_status_cobranca_check;
ALTER TABLE public.financeiro_sessoes_cobranca
  ADD CONSTRAINT financeiro_sessoes_cobranca_status_cobranca_check
  CHECK (status_cobranca IN (
    'AGUARDANDO_SESSAO', 'PENDENTE_CONFIRMACAO', 'CONSUMIDO_PACOTE',
    'RECEBIDO_AVULSO', 'CORTESIA', 'REMARCADO', 'NAO_REALIZADO', 'CANCELADO',
    'INCLUIDO_MENSALIDADE', 'REGISTRADO_MANUAL'
  ));

-- ------------------------------------------------------------
-- 6) Despesas: fixa | variável parcelada | pontual
-- ------------------------------------------------------------
ALTER TABLE public.financeiro_custos_recorrentes
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'FIXA',
  ADD COLUMN IF NOT EXISTS starts_on DATE,
  ADD COLUMN IF NOT EXISTS months_total INT,
  ADD COLUMN IF NOT EXISTS ends_on DATE;

ALTER TABLE public.financeiro_custos_recorrentes
  DROP CONSTRAINT IF EXISTS financeiro_custos_kind_check;
ALTER TABLE public.financeiro_custos_recorrentes
  ADD CONSTRAINT financeiro_custos_kind_check
  CHECK (kind IN ('FIXA', 'VARIAVEL_PARCELADA', 'PONTUAL'));

ALTER TABLE public.financeiro_custos_recorrentes
  DROP CONSTRAINT IF EXISTS financeiro_custos_parcelas_check;
ALTER TABLE public.financeiro_custos_recorrentes
  ADD CONSTRAINT financeiro_custos_parcelas_check
  CHECK (
    kind <> 'VARIAVEL_PARCELADA'
    OR (starts_on IS NOT NULL AND months_total IS NOT NULL AND months_total >= 1)
  );

ALTER TABLE public.financeiro_custos_recorrentes
  DROP CONSTRAINT IF EXISTS financeiro_custos_recorrentes_categoria_check;
ALTER TABLE public.financeiro_custos_recorrentes
  ADD CONSTRAINT financeiro_custos_recorrentes_categoria_check
  CHECK (categoria IN ('CUSTO_FIXO', 'CUSTO_VARIAVEL', 'IMPOSTO', 'DESPESA_PARCELADA', 'DESPESA_PONTUAL', 'OUTROS'));

-- ------------------------------------------------------------
-- 7) RLS da tabela nova (mesmo padrão do caixa)
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT := 'financeiro_contrato_janelas';
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

GRANT SELECT, INSERT, UPDATE ON public.financeiro_contrato_janelas TO authenticated;
GRANT ALL ON public.financeiro_contrato_janelas TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_contrato_janelas TO unithery_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_planos_paciente TO unithery_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_transacoes TO unithery_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_saldos_pacientes TO unithery_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_sessoes_cobranca TO unithery_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_custos_recorrentes TO unithery_app;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8) Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_clamp_due_day(p_year INT, p_month INT, p_day INT)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT make_date(
    p_year,
    p_month,
    LEAST(GREATEST(COALESCE(p_day, 1), 1), 28)
  );
$$;

CREATE OR REPLACE FUNCTION public.financeiro_calcular_fim_parcelamento(
  p_starts_on DATE,
  p_months_total INT
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_starts_on IS NULL OR p_months_total IS NULL OR p_months_total < 1 THEN
    RAISE EXCEPTION 'PARCELA_PARAMS_INVALID';
  END IF;
  RETURN (p_starts_on + make_interval(months => p_months_total - 1))::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_contrato_vigente_em(
  p_starts_on DATE,
  p_duration_months INT,
  p_competence DATE
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_competence >= date_trunc('month', COALESCE(p_starts_on, p_competence))::date
    AND (
      p_duration_months IS NULL
      OR p_competence < (date_trunc('month', COALESCE(p_starts_on, p_competence)) + make_interval(months => p_duration_months))::date
    );
$$;

-- ------------------------------------------------------------
-- 9) RPC: gerar faturas mensais (1 título / contrato / mês)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_gerar_faturas_mensais(
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
  v_comp DATE;
  r RECORD;
  v_due DATE;
  v_chave TEXT;
  v_cat TEXT;
  v_status TEXT;
  v_desc TEXT;
BEGIN
  IF p_clinic_id IS NULL OR p_year_month IS NULL OR p_year_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'MONTH_INVALID';
  END IF;

  v_year := split_part(p_year_month, '-', 1)::INT;
  v_month := split_part(p_year_month, '-', 2)::INT;
  v_comp := make_date(v_year, v_month, 1);

  FOR r IN
    SELECT p.*
    FROM public.financeiro_planos_paciente p
    WHERE p.clinic_id = p_clinic_id
      AND p.deleted_at IS NULL
      AND p.ativo = true
      AND p.billing_type = 'MENSAL_RECORRENTE'
  LOOP
    IF NOT public.financeiro_contrato_vigente_em(r.contract_starts_on, r.contract_duration_months, v_comp) THEN
      CONTINUE;
    END IF;

    v_due := public.financeiro_clamp_due_day(v_year, v_month, r.due_day);
    v_chave := 'contrato:' || r.id::text || ':' || p_year_month;
    v_cat := CASE WHEN r.model_type = 'CONVENIO' THEN 'CONVENIO_MENSAL' ELSE 'MENSALIDADE' END;
    v_status := CASE WHEN v_due < CURRENT_DATE THEN 'ATRASADO' ELSE 'PENDENTE' END;
    v_desc := 'Mensalidade ' || p_year_month;

    INSERT INTO public.financeiro_transacoes (
      clinic_id, tipo, categoria, descricao, valor_cents,
      data_vencimento, status, paciente_id, professional_id, contract_id,
      recorrente, recorrencia_chave, competence_month, source, created_by
    )
    SELECT
      r.clinic_id, 'ENTRADA', v_cat, v_desc, COALESCE(r.valor_acordado_cents, 0),
      v_due, v_status, r.patient_id, r.professional_id, r.id,
      true, v_chave, v_comp, 'monthly_invoice', r.created_by
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.financeiro_transacoes t
      WHERE t.clinic_id = r.clinic_id
        AND t.recorrencia_chave = v_chave
        AND t.deleted_at IS NULL
        AND t.status <> 'CANCELADO'
    );

    IF FOUND THEN
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

-- ------------------------------------------------------------
-- 10) RPC: expandir agenda a partir das janelas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_expandir_agenda_contrato(
  p_contract_id UUID,
  p_until DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.financeiro_planos_paciente%ROWTYPE;
  v_from DATE;
  v_until DATE;
  v_created INT := 0;
  v_skipped INT := 0;
  v_conflicts INT := 0;
  v_prof UUID;
  j RECORD;
  v_date DATE;
  v_ts TIMESTAMPTZ;
  v_key TEXT;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_plan
  FROM public.financeiro_planos_paciente
  WHERE id = p_contract_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND';
  END IF;

  IF v_plan.billing_type <> 'MENSAL_RECORRENTE' THEN
    RETURN jsonb_build_object('created', 0, 'skipped', 0, 'conflicts', 0, 'reason', 'not_recurring');
  END IF;
  IF v_plan.professional_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_contrato_janelas j
    WHERE j.contract_id = p_contract_id AND j.deleted_at IS NULL AND j.professional_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CONTRACT_PROFESSIONAL_REQUIRED';
  END IF;

  v_from := GREATEST(COALESCE(v_plan.contract_starts_on, CURRENT_DATE), CURRENT_DATE);
  IF p_until IS NOT NULL THEN
    v_until := p_until;
  ELSIF v_plan.contract_duration_months IS NOT NULL THEN
    v_until := (COALESCE(v_plan.contract_starts_on, CURRENT_DATE) + make_interval(months => v_plan.contract_duration_months) - interval '1 day')::date;
  ELSE
    v_until := (CURRENT_DATE + interval '90 days')::date;
  END IF;

  IF v_until < v_from THEN
    RETURN jsonb_build_object('created', 0, 'skipped', 0, 'conflicts', 0, 'from', v_from, 'until', v_until);
  END IF;

  FOR j IN
    SELECT *
    FROM public.financeiro_contrato_janelas
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
  LOOP
    FOR v_date IN
      SELECT d::date
      FROM generate_series(v_from, v_until, interval '1 day') AS d
      WHERE extract(isodow FROM d) = j.weekday
    LOOP
      v_prof := COALESCE(j.professional_id, v_plan.professional_id);
      IF v_prof IS NULL THEN
        v_conflicts := v_conflicts + 1;
        CONTINUE;
      END IF;
      v_ts := ((v_date + j.start_time) AT TIME ZONE COALESCE(j.timezone, 'America/Sao_Paulo'));
      v_end := v_ts + make_interval(mins => j.duration_minutes);
      v_key := p_contract_id::text || ':' || j.id::text || ':' || to_char(v_date, 'YYYY-MM-DD');

      IF EXISTS (
        SELECT 1 FROM public.therapist_schedule s
        WHERE s.occurrence_key = v_key AND s.deleted_at IS NULL
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.therapist_schedule s
        WHERE s.professional_id = v_prof
          AND s.deleted_at IS NULL
          AND s.status NOT IN ('cancelled', 'no_show')
          AND s.scheduled_at < v_end
          AND (s.scheduled_at + make_interval(mins => COALESCE(s.duration_minutes, 50))) > v_ts
          AND COALESCE(s.occurrence_key, '') <> v_key
      ) THEN
        v_conflicts := v_conflicts + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.therapist_schedule (
        professional_id, patient_id, clinic_id, title, scheduled_at, duration_minutes,
        status, financial_contract_id, occurrence_key, schedule_source
      ) VALUES (
        v_prof,
        v_plan.patient_id,
        v_plan.clinic_id,
        'Sessão recorrente',
        v_ts,
        j.duration_minutes,
        'scheduled',
        p_contract_id,
        v_key,
        'recurrence'
      );

      INSERT INTO public.financeiro_sessoes_cobranca (
        clinic_id, schedule_id, patient_id, professional_id,
        status_cobranca, valor_previsto_cents
      )
      SELECT
        v_plan.clinic_id, s.id, v_plan.patient_id, s.professional_id,
        'INCLUIDO_MENSALIDADE', COALESCE(v_plan.valor_acordado_cents, 0)
      FROM public.therapist_schedule s
      WHERE s.occurrence_key = v_key AND s.deleted_at IS NULL
      ON CONFLICT (schedule_id) DO NOTHING;

      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'conflicts', v_conflicts,
    'from', v_from,
    'until', v_until
  );
END;
$$;

-- ------------------------------------------------------------
-- 11) RPC: despesa parcelada (N títulos + mês final)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_gerar_despesa_parcelada(
  p_custo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.financeiro_custos_recorrentes%ROWTYPE;
  v_end DATE;
  i INT;
  v_due DATE;
  v_chave TEXT;
  v_comp DATE;
  v_created INT := 0;
  v_ym TEXT;
BEGIN
  SELECT * INTO r
  FROM public.financeiro_custos_recorrentes
  WHERE id = p_custo_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUSTO_NOT_FOUND';
  END IF;
  IF r.kind <> 'VARIAVEL_PARCELADA' THEN
    RAISE EXCEPTION 'CUSTO_NOT_INSTALLMENT';
  END IF;

  v_end := public.financeiro_calcular_fim_parcelamento(r.starts_on, r.months_total);

  UPDATE public.financeiro_custos_recorrentes
  SET ends_on = v_end, updated_at = now()
  WHERE id = r.id;

  FOR i IN 1..r.months_total LOOP
    v_comp := (date_trunc('month', r.starts_on) + make_interval(months => i - 1))::date;
    v_due := public.financeiro_clamp_due_day(
      extract(year FROM v_comp)::INT,
      extract(month FROM v_comp)::INT,
      r.dia_vencimento
    );
    v_ym := to_char(v_comp, 'YYYY-MM');
    v_chave := r.id::text || ':' || v_ym;

    INSERT INTO public.financeiro_transacoes (
      clinic_id, tipo, categoria, descricao, valor_cents,
      data_vencimento, status, professional_id,
      recorrente, recorrencia_chave, competence_month,
      installment_current, installment_total, source, created_by
    )
    SELECT
      r.clinic_id, 'SAIDA', 'DESPESA_PARCELADA',
      r.descricao || ' (' || i || '/' || r.months_total || ')',
      r.valor_cents,
      v_due,
      CASE WHEN v_due < CURRENT_DATE THEN 'ATRASADO' ELSE 'PENDENTE' END,
      r.professional_id,
      true, v_chave, v_comp, i, r.months_total, 'expense_installment', r.created_by
    WHERE NOT EXISTS (
      SELECT 1 FROM public.financeiro_transacoes t
      WHERE t.clinic_id = r.clinic_id
        AND t.recorrencia_chave = v_chave
        AND t.deleted_at IS NULL
        AND t.status <> 'CANCELADO'
    );

    IF FOUND THEN
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'months_total', r.months_total,
    'starts_on', r.starts_on,
    'ends_on', v_end,
    'total_cents', r.valor_cents * r.months_total
  );
END;
$$;

-- ------------------------------------------------------------
-- 12) RPC: baixa em 1 clique
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_baixar_transacao(
  p_clinic_id UUID,
  p_tx_id UUID,
  p_paid_date DATE DEFAULT CURRENT_DATE
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
    updated_at = now()
  WHERE id = p_tx_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL
    AND status IN ('PENDENTE', 'ATRASADO');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TX_NOT_PAYABLE';
  END IF;

  RETURN p_tx_id;
END;
$$;

-- ------------------------------------------------------------
-- 13) RPC: sessão avulsa / extra lançada no financeiro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_registrar_sessao_avulsa(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_valor_cents INT,
  p_schedule_id UUID DEFAULT NULL,
  p_paid BOOLEAN DEFAULT false,
  p_created_by UUID DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL
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
BEGIN
  IF p_valor_cents IS NULL OR p_valor_cents < 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  SELECT * INTO v_plan
  FROM public.financeiro_planos_paciente
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL
  LIMIT 1;

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
    CURRENT_DATE,
    CASE WHEN p_paid THEN CURRENT_DATE ELSE NULL END,
    v_status,
    p_patient_id, p_schedule_id, p_professional_id, v_plan.id,
    date_trunc('month', CURRENT_DATE)::date,
    CASE WHEN p_schedule_id IS NULL THEN 'session_manual' ELSE 'session_avulso' END,
    p_created_by
  )
  RETURNING id INTO v_tx;

  IF p_schedule_id IS NOT NULL THEN
    INSERT INTO public.financeiro_sessoes_cobranca (
      clinic_id, schedule_id, patient_id, professional_id,
      status_cobranca, valor_previsto_cents, transacao_id
    ) VALUES (
      p_clinic_id, p_schedule_id, p_patient_id, p_professional_id,
      CASE WHEN p_paid THEN 'RECEBIDO_AVULSO' ELSE 'PENDENTE_CONFIRMACAO' END,
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

-- ------------------------------------------------------------
-- 14) Atualiza promoção de sessões: mensal ≠ a receber por sessão
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_promover_sessoes_stale()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.financeiro_sessoes_cobranca (
    clinic_id, schedule_id, patient_id, professional_id,
    status_cobranca, valor_previsto_cents
  )
  SELECT
    s.clinic_id,
    s.id,
    s.patient_id,
    s.professional_id,
    CASE
      WHEN p.billing_type = 'MENSAL_RECORRENTE' THEN 'INCLUIDO_MENSALIDADE'
      ELSE 'PENDENTE_CONFIRMACAO'
    END,
    COALESCE(p.valor_acordado_cents, p.valor_sessao_cents, 0)
  FROM public.therapist_schedule s
  LEFT JOIN public.financeiro_planos_paciente p
    ON p.patient_id = s.patient_id AND p.deleted_at IS NULL
  WHERE s.deleted_at IS NULL
    AND s.patient_id IS NOT NULL
    AND s.scheduled_at < now()
    AND s.status IN ('scheduled', 'in_progress', 'not_completed', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_sessoes_cobranca c
      WHERE c.schedule_id = s.id AND c.deleted_at IS NULL
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.financeiro_sessoes_cobranca c
  SET status_cobranca = CASE
        WHEN p.billing_type = 'MENSAL_RECORRENTE' THEN 'INCLUIDO_MENSALIDADE'
        ELSE 'PENDENTE_CONFIRMACAO'
      END,
      updated_at = now()
  FROM public.therapist_schedule s
  LEFT JOIN public.financeiro_planos_paciente p
    ON p.patient_id = s.patient_id AND p.deleted_at IS NULL
  WHERE c.schedule_id = s.id
    AND c.deleted_at IS NULL
    AND c.status_cobranca = 'AGUARDANDO_SESSAO'
    AND s.scheduled_at < now()
    AND s.status IN ('scheduled', 'in_progress', 'not_completed', 'completed');

  UPDATE public.financeiro_transacoes
  SET status = 'ATRASADO', updated_at = now()
  WHERE deleted_at IS NULL
    AND status = 'PENDENTE'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;

  RETURN v_count;
END;
$$;

-- Custos: não gera parcela fora da vigência
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
        recorrente, recorrencia_chave, competence_month, source, metadata, created_by
      ) VALUES (
        p_clinic_id, 'SAIDA', v_cat, r.descricao, r.valor_cents,
        v_due, v_status, r.professional_id,
        true, v_chave, v_comp,
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

-- ------------------------------------------------------------
-- 15) Views de leitura (dashboard / aba pacientes)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.financeiro_v_contratos_ativos AS
SELECT
  p.id,
  p.clinic_id,
  p.patient_id,
  pt.name AS patient_name,
  p.professional_id,
  p.model_type,
  p.billing_type,
  p.modelo,
  p.valor_acordado_cents,
  p.valor_sessao_cents,
  p.due_day,
  p.sessions_per_month,
  p.sessions_custom,
  p.contract_duration_months,
  p.contract_starts_on,
  CASE
    WHEN p.contract_starts_on IS NOT NULL AND p.contract_duration_months IS NOT NULL
      THEN (p.contract_starts_on + make_interval(months => p.contract_duration_months) - interval '1 day')::date
    ELSE NULL
  END AS contract_ends_on,
  p.ativo,
  p.observacoes,
  (
    SELECT count(*)::int
    FROM public.financeiro_contrato_janelas j
    WHERE j.contract_id = p.id AND j.deleted_at IS NULL
  ) AS janelas_count
FROM public.financeiro_planos_paciente p
JOIN public.patients pt ON pt.id = p.patient_id
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.financeiro_v_receitas_competencia AS
SELECT
  t.clinic_id,
  t.competence_month,
  t.status,
  t.categoria,
  t.source,
  count(*)::int AS qtd,
  coalesce(sum(t.valor_cents), 0)::int AS total_cents
FROM public.financeiro_transacoes t
WHERE t.deleted_at IS NULL
  AND t.tipo = 'ENTRADA'
GROUP BY t.clinic_id, t.competence_month, t.status, t.categoria, t.source;

GRANT SELECT ON public.financeiro_v_contratos_ativos TO authenticated, service_role;
GRANT SELECT ON public.financeiro_v_receitas_competencia TO authenticated, service_role;

-- ------------------------------------------------------------
-- 16) Grants de execute
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.financeiro_clamp_due_day(INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_calcular_fim_parcelamento(DATE, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_contrato_vigente_em(DATE, INT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_gerar_faturas_mensais(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_expandir_agenda_contrato(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_gerar_despesa_parcelada(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_baixar_transacao(UUID, UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.financeiro_clamp_due_day(INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_calcular_fim_parcelamento(DATE, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_contrato_vigente_em(DATE, INT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_gerar_faturas_mensais(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_expandir_agenda_contrato(UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_gerar_despesa_parcelada(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_baixar_transacao(UUID, UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.financeiro_clamp_due_day(INT, INT, INT) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_calcular_fim_parcelamento(DATE, INT) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_contrato_vigente_em(DATE, INT, DATE) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_gerar_faturas_mensais(UUID, TEXT) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_expandir_agenda_contrato(UUID, DATE) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_gerar_despesa_parcelada(UUID) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_baixar_transacao(UUID, UUID, DATE) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_registrar_sessao_avulsa(UUID, UUID, UUID, INT, UUID, BOOLEAN, UUID, TEXT) TO unithery_app;
    GRANT SELECT ON public.financeiro_v_contratos_ativos TO unithery_app;
    GRANT SELECT ON public.financeiro_v_receitas_competencia TO unithery_app;
  END IF;
END $$;
