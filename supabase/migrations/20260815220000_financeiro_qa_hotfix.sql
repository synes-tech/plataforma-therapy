-- QA Prompt 10 hotfix:
-- 1) auth.uid() não explode com sub Firebase não-UUID
-- 2) is_finance_owner lê auth.app_metadata() (topo + aninhado)
-- 3) GRANT authenticated nas tabelas com RLS (PostgREST user JWT)
-- 4) alias j RECORD quebrava financeiro_expandir_agenda_contrato
-- 5) RPC de recorrência por clínica (transação isolada)

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN v::uuid
    ELSE NULL
  END
  FROM (
    SELECT NULLIF(
      COALESCE(
        current_setting('request.jwt.claim.sub', true),
        (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
      ),
      ''
    ) AS v
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.is_finance_owner()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    (auth.app_metadata() ->> 'role') = 'master'
    OR (auth.app_metadata() ->> 'role') = 'clinic_admin'
    OR (
      (auth.app_metadata() ->> 'role') = 'professional'
      AND COALESCE((auth.app_metadata() ->> 'is_solo')::boolean, false) = true
    );
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v')
      AND c.relrowsecurity = true
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      r.relname
    );
  END LOOP;
END $$;

GRANT SELECT ON public.financeiro_v_contratos_ativos TO authenticated;
GRANT SELECT ON public.financeiro_v_receitas_competencia TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Cloud SQL: postgres não é superuser; PostgREST precisa SET ROLE authenticated.
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

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
  v_janela RECORD;
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
    SELECT 1 FROM public.financeiro_contrato_janelas janela
    WHERE janela.contract_id = p_contract_id
      AND janela.deleted_at IS NULL
      AND janela.professional_id IS NOT NULL
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

  FOR v_janela IN
    SELECT *
    FROM public.financeiro_contrato_janelas
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
  LOOP
    FOR v_date IN
      SELECT d::date
      FROM generate_series(v_from, v_until, interval '1 day') AS d
      WHERE extract(isodow FROM d) = v_janela.weekday
    LOOP
      v_prof := COALESCE(v_janela.professional_id, v_plan.professional_id);
      IF v_prof IS NULL THEN
        v_conflicts := v_conflicts + 1;
        CONTINUE;
      END IF;
      v_ts := ((v_date + v_janela.start_time) AT TIME ZONE COALESCE(v_janela.timezone, 'America/Sao_Paulo'));
      v_end := v_ts + make_interval(mins => v_janela.duration_minutes);
      v_key := p_contract_id::text || ':' || v_janela.id::text || ':' || to_char(v_date, 'YYYY-MM-DD');

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
        v_janela.duration_minutes,
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

CREATE OR REPLACE FUNCTION public.financeiro_processar_recorrencia_clinica(
  p_clinic_id UUID,
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
  v_contract UUID;
  v_invoices INT := 0;
  v_expanded INT := 0;
  v_agenda JSONB;
  v_until DATE;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_REQUIRED';
  END IF;

  v_current := COALESCE(
    p_year_month,
    to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM')
  );
  IF v_current !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'MONTH_INVALID';
  END IF;
  v_next := to_char((to_date(v_current || '-01', 'YYYY-MM-DD') + interval '1 month'), 'YYYY-MM');
  v_until := (to_date(v_next || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;

  v_invoices := v_invoices + public.financeiro_gerar_faturas_mensais(p_clinic_id, v_current);
  v_invoices := v_invoices + public.financeiro_gerar_faturas_mensais(p_clinic_id, v_next);

  FOR v_contract IN
    SELECT p.id
    FROM public.financeiro_planos_paciente p
    WHERE p.deleted_at IS NULL
      AND p.ativo = true
      AND p.billing_type = 'MENSAL_RECORRENTE'
      AND p.clinic_id = p_clinic_id
  LOOP
    v_agenda := public.financeiro_expandir_agenda_contrato(v_contract, v_until);
    v_expanded := v_expanded + COALESCE((v_agenda->>'created')::INT, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'competence_month', v_current,
    'next_month', v_next,
    'invoices_created', v_invoices,
    'sessions_created', v_expanded,
    'horizon', v_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_processar_recorrencia_clinica(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_processar_recorrencia_clinica(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_expandir_agenda_contrato(UUID, DATE) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.financeiro_processar_recorrencia_clinica(UUID, TEXT) TO unithery_app;
    GRANT EXECUTE ON FUNCTION public.financeiro_expandir_agenda_contrato(UUID, DATE) TO unithery_app;
  END IF;
END $$;

COMMENT ON FUNCTION public.financeiro_expandir_agenda_contrato(UUID, DATE)
  IS 'Expande janelas do contrato em therapist_schedule (alias v_janela — sem colisão PL/pgSQL).';
COMMENT ON FUNCTION public.financeiro_processar_recorrencia_clinica(UUID, TEXT)
  IS 'Cron por clínica: faturas do mês atual + seguinte e expansão de agenda (transação isolada).';
