-- ============================================================
-- ERP Financeiro Unithery — MVP Core (Controle de Caixa)
-- ============================================================

-- 1) Planos comerciais por paciente
CREATE TABLE IF NOT EXISTS public.financeiro_planos_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  modelo TEXT NOT NULL CHECK (modelo IN ('avulso', 'pacote', 'social')),
  valor_sessao_cents INT NOT NULL DEFAULT 0 CHECK (valor_sessao_cents >= 0),
  pacote_qtd_sessoes INT CHECK (pacote_qtd_sessoes IS NULL OR pacote_qtd_sessoes > 0),
  pacote_valor_cents INT CHECK (pacote_valor_cents IS NULL OR pacote_valor_cents >= 0),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_planos_patient_active
  ON public.financeiro_planos_paciente (patient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_planos_clinic
  ON public.financeiro_planos_paciente (clinic_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_financeiro_planos_updated_at ON public.financeiro_planos_paciente;
CREATE TRIGGER trg_financeiro_planos_updated_at
  BEFORE UPDATE ON public.financeiro_planos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Transações (extrato)
CREATE TABLE IF NOT EXISTS public.financeiro_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  categoria TEXT NOT NULL CHECK (categoria IN (
    'SESSAO_AVULSA', 'PACOTE', 'SESSAO_SOCIAL', 'RENDIMENTO_EXTRA',
    'CUSTO_FIXO', 'CUSTO_VARIAVEL', 'IMPOSTO', 'REPASSE_PROFISSIONAL', 'OUTROS'
  )),
  descricao TEXT NOT NULL DEFAULT '',
  valor_cents INT NOT NULL CHECK (valor_cents >= 0),
  moeda TEXT NOT NULL DEFAULT 'BRL',
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PAGO', 'PENDENTE', 'ATRASADO', 'CANCELADO')),
  paciente_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  sessao_id UUID REFERENCES public.therapist_schedule(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  recorrente BOOLEAN NOT NULL DEFAULT false,
  recorrencia_chave TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_financeiro_tx_clinic_venc
  ON public.financeiro_transacoes (clinic_id, data_vencimento)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_tx_clinic_status
  ON public.financeiro_transacoes (clinic_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_tx_paciente
  ON public.financeiro_transacoes (paciente_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_tx_sessao_unique
  ON public.financeiro_transacoes (sessao_id)
  WHERE sessao_id IS NOT NULL AND deleted_at IS NULL AND status <> 'CANCELADO';

DROP TRIGGER IF EXISTS trg_financeiro_tx_updated_at ON public.financeiro_transacoes;
CREATE TRIGGER trg_financeiro_tx_updated_at
  BEFORE UPDATE ON public.financeiro_transacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) Saldos de pacote
CREATE TABLE IF NOT EXISTS public.financeiro_saldos_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  paciente_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  sessoes_disponiveis INT NOT NULL DEFAULT 0 CHECK (sessoes_disponiveis >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT financeiro_saldos_patient_unique UNIQUE (paciente_id)
);

CREATE INDEX IF NOT EXISTS idx_financeiro_saldos_clinic
  ON public.financeiro_saldos_pacientes (clinic_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_financeiro_saldos_updated_at ON public.financeiro_saldos_pacientes;
CREATE TRIGGER trg_financeiro_saldos_updated_at
  BEFORE UPDATE ON public.financeiro_saldos_pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4) Cobrança por sessão (ponte agenda)
CREATE TABLE IF NOT EXISTS public.financeiro_sessoes_cobranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  schedule_id UUID NOT NULL REFERENCES public.therapist_schedule(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  status_cobranca TEXT NOT NULL DEFAULT 'AGUARDANDO_SESSAO'
    CHECK (status_cobranca IN (
      'AGUARDANDO_SESSAO', 'PENDENTE_CONFIRMACAO', 'CONSUMIDO_PACOTE',
      'RECEBIDO_AVULSO', 'CORTESIA', 'REMARCADO', 'NAO_REALIZADO', 'CANCELADO'
    )),
  valor_previsto_cents INT NOT NULL DEFAULT 0 CHECK (valor_previsto_cents >= 0),
  transacao_id UUID REFERENCES public.financeiro_transacoes(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT financeiro_cobranca_schedule_unique UNIQUE (schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_financeiro_cobranca_clinic_status
  ON public.financeiro_sessoes_cobranca (clinic_id, status_cobranca)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_cobranca_patient
  ON public.financeiro_sessoes_cobranca (patient_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_financeiro_cobranca_updated_at ON public.financeiro_sessoes_cobranca;
CREATE TRIGGER trg_financeiro_cobranca_updated_at
  BEFORE UPDATE ON public.financeiro_sessoes_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.financeiro_planos_paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_saldos_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_sessoes_cobranca ENABLE ROW LEVEL SECURITY;

-- Helper: owner da clínica (admin, master, ou professional solo)
CREATE OR REPLACE FUNCTION public.is_finance_owner()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'professional'
      AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_solo')::boolean, false) = true
    );
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financeiro_planos_paciente',
    'financeiro_transacoes',
    'financeiro_saldos_pacientes',
    'financeiro_sessoes_cobranca'
  ]
  LOOP
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
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.financeiro_planos_paciente TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.financeiro_transacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.financeiro_saldos_pacientes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.financeiro_sessoes_cobranca TO authenticated;
GRANT ALL ON public.financeiro_planos_paciente TO service_role;
GRANT ALL ON public.financeiro_transacoes TO service_role;
GRANT ALL ON public.financeiro_saldos_pacientes TO service_role;
GRANT ALL ON public.financeiro_sessoes_cobranca TO service_role;

-- ============================================================
-- RPCs atômicas
-- ============================================================

CREATE OR REPLACE FUNCTION public.financeiro_vender_pacote(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_qtd INT,
  p_valor_cents INT,
  p_descricao TEXT,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
BEGIN
  IF p_qtd IS NULL OR p_qtd <= 0 THEN
    RAISE EXCEPTION 'QTD_INVALIDA';
  END IF;
  IF p_valor_cents IS NULL OR p_valor_cents < 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  INSERT INTO public.financeiro_transacoes (
    clinic_id, tipo, categoria, descricao, valor_cents,
    data_vencimento, data_pagamento, status,
    paciente_id, professional_id, created_by
  ) VALUES (
    p_clinic_id, 'ENTRADA', 'PACOTE', COALESCE(NULLIF(trim(p_descricao), ''), 'Pacote de sessões'),
    p_valor_cents, CURRENT_DATE, CURRENT_DATE, 'PAGO',
    p_patient_id, p_professional_id, p_created_by
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.financeiro_saldos_pacientes (clinic_id, paciente_id, sessoes_disponiveis)
  VALUES (p_clinic_id, p_patient_id, p_qtd)
  ON CONFLICT (paciente_id) DO UPDATE
    SET sessoes_disponiveis = public.financeiro_saldos_pacientes.sessoes_disponiveis + EXCLUDED.sessoes_disponiveis,
        updated_at = now(),
        deleted_at = NULL;

  RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_consumir_sessao_pacote(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_schedule_id UUID,
  p_professional_id UUID,
  p_created_by UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo INT;
BEGIN
  SELECT sessoes_disponiveis INTO v_saldo
  FROM public.financeiro_saldos_pacientes
  WHERE paciente_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_saldo IS NULL OR v_saldo < 1 THEN
    RAISE EXCEPTION 'NO_PACKAGE_BALANCE';
  END IF;

  UPDATE public.financeiro_saldos_pacientes
  SET sessoes_disponiveis = sessoes_disponiveis - 1,
      updated_at = now()
  WHERE paciente_id = p_patient_id
    AND clinic_id = p_clinic_id;

  INSERT INTO public.financeiro_sessoes_cobranca (
    clinic_id, schedule_id, patient_id, professional_id,
    status_cobranca, valor_previsto_cents
  ) VALUES (
    p_clinic_id, p_schedule_id, p_patient_id, p_professional_id,
    'CONSUMIDO_PACOTE', 0
  )
  ON CONFLICT (schedule_id) DO UPDATE
    SET status_cobranca = 'CONSUMIDO_PACOTE',
        updated_at = now(),
        deleted_at = NULL;

  RETURN v_saldo - 1;
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_vender_pacote FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_consumir_sessao_pacote FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_vender_pacote TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_consumir_sessao_pacote TO service_role;

-- Promove sessões passadas sem movimento para PENDENTE_CONFIRMACAO
CREATE OR REPLACE FUNCTION public.financeiro_promover_sessoes_stale()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- Cria cobrança faltante a partir de schedules passados
  INSERT INTO public.financeiro_sessoes_cobranca (
    clinic_id, schedule_id, patient_id, professional_id,
    status_cobranca, valor_previsto_cents
  )
  SELECT
    s.clinic_id,
    s.id,
    s.patient_id,
    s.professional_id,
    'PENDENTE_CONFIRMACAO',
    COALESCE(p.valor_sessao_cents, 0)
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
  SET status_cobranca = 'PENDENTE_CONFIRMACAO',
      updated_at = now()
  FROM public.therapist_schedule s
  WHERE c.schedule_id = s.id
    AND c.deleted_at IS NULL
    AND c.status_cobranca = 'AGUARDANDO_SESSAO'
    AND s.scheduled_at < now()
    AND s.status IN ('scheduled', 'in_progress', 'not_completed', 'completed');

  -- Marca transações vencidas
  UPDATE public.financeiro_transacoes
  SET status = 'ATRASADO', updated_at = now()
  WHERE deleted_at IS NULL
    AND status = 'PENDENTE'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_promover_sessoes_stale() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_promover_sessoes_stale() TO service_role;

-- Cron diário (reusa vault cron_secret se Edge for chamada depois; por ora só RPC)
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'financeiro_promover_sessoes_stale' LIMIT 1;
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'financeiro_promover_sessoes_stale',
  '15 * * * *',
  $$SELECT public.financeiro_promover_sessoes_stale();$$
);
