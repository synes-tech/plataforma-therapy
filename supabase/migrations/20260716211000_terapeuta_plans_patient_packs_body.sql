-- ============================================================
-- UNITHERY — Planos Terapeuta (Inicial 10 / Intermediário 40) + Upsell de pacientes
-- Migration: 20260716211000_terapeuta_plans_patient_packs_body.sql
-- ============================================================

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS patient_quota_bonus INT NOT NULL DEFAULT 0
    CHECK (patient_quota_bonus >= 0);

COMMENT ON COLUMN public.professionals.patient_quota_bonus IS
  'Vagas extras de pacientes ativos (upsell +10/+20, acumulativo e ilimitado em compras).';

CREATE OR REPLACE FUNCTION public.increment_patient_quota_bonus(
  p_professional_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total integer;
BEGIN
  IF p_amount IS NULL OR p_amount NOT IN (10, 20) THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  UPDATE public.professionals
  SET patient_quota_bonus = patient_quota_bonus + p_amount
  WHERE id = p_professional_id
    AND deleted_at IS NULL
  RETURNING patient_quota_bonus INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'patient_quota_bonus', v_new_total,
    'increment', p_amount
  );
END;
$$;

COMMENT ON FUNCTION public.increment_patient_quota_bonus(uuid, integer) IS
  'Soma vagas extras de pacientes ativos no profissional (pacotes +10 ou +20).';

REVOKE ALL ON FUNCTION public.increment_patient_quota_bonus(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_patient_quota_bonus(uuid, integer) TO service_role;

INSERT INTO public.planos (
  id, nome, tipo_perfil, preco_mensal_cents,
  limite_profissionais, limite_pacientes_por_prof,
  descricao_curta, destaque, features, recomendado, sort_order, ativo
) VALUES
(
  'inicial',
  'Plano Inicial',
  'autonomo',
  14700,
  1,
  10,
  'Para quem está começando ou com carteira enxuta',
  '1 profissional · até 10 pacientes ativos',
  '[
    "Copiloto de IA com contexto isolado por paciente",
    "Diário familiar e alertas de crise",
    "Transcrição de sessões e relatórios",
    "Anexos vetorizados na base de conhecimento",
    "Portal da família incluso"
  ]'::jsonb,
  false,
  1,
  true
),
(
  'intermediario',
  'Plano Intermediário',
  'autonomo',
  24700,
  1,
  40,
  'Para terapeutas com carteira consolidada',
  '1 profissional · até 40 pacientes ativos',
  '[
    "Tudo do Plano Inicial",
    "Mais capacidade para carteira ampla",
    "Mesma IA clínica e recursos completos",
    "Upsell de pacientes (+10 ou +20) quando precisar"
  ]'::jsonb,
  true,
  2,
  true
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo_perfil = EXCLUDED.tipo_perfil,
  preco_mensal_cents = EXCLUDED.preco_mensal_cents,
  limite_profissionais = EXCLUDED.limite_profissionais,
  limite_pacientes_por_prof = EXCLUDED.limite_pacientes_por_prof,
  descricao_curta = EXCLUDED.descricao_curta,
  destaque = EXCLUDED.destaque,
  features = EXCLUDED.features,
  recomendado = EXCLUDED.recomendado,
  sort_order = EXCLUDED.sort_order,
  ativo = EXCLUDED.ativo,
  updated_at = now();

UPDATE public.planos
SET ativo = false, updated_at = now()
WHERE id = 'consultorio';

UPDATE public.clinics
SET subscription_plan = 'inicial'::subscription_plan
WHERE subscription_plan::text = 'consultorio'
  AND deleted_at IS NULL;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.clinics
    WHERE subscription_plan::text IN ('inicial', 'intermediario')
      AND deleted_at IS NULL
  LOOP
    PERFORM public.sync_clinic_settings_from_plano(r.id);
  END LOOP;
END $$;
