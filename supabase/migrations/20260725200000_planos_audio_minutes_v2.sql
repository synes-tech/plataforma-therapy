-- ============================================================
-- UNITHERY — Cota de minutos de áudio alinhada às sessões
-- Fórmula: pacientes × sessões/paciente × duração (min) × 1,3
-- Ref: alinhamento sessões × tempo de sessão + margem operacional
-- ============================================================

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS limite_audio_minutos_mes INT;

COMMENT ON COLUMN public.planos.limite_audio_minutos_mes IS
  'Minutos de áudio de sessão/mês. Derivado de pacientes × sessões × duração × 1,3.';

UPDATE public.planos
SET limite_audio_minutos_mes = FLOOR(
  COALESCE(limite_pacientes_por_prof, 0)
  * sessoes_por_paciente_mes
  * duracao_sessao_minutos
  * 1.3
)::INT
WHERE limite_pacientes_por_prof IS NOT NULL;

ALTER TABLE public.plan_addons
  ADD COLUMN IF NOT EXISTS audio_bonus_mes INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.plan_addons.audio_bonus_mes IS
  'Minutos de áudio extras por módulo (+5 pacientes = +20 sessões × 60 min × 1,3).';

-- +5 pacientes → +20 sessões × 60 min × 1,3 = 1.560 min/módulo
UPDATE public.plan_addons
SET audio_bonus_mes = FLOOR(5 * 4 * 60 * 1.3)::INT
WHERE audio_bonus_mes = 0;

-- Bônus ativos (pacientes / IA / áudio) a partir dos módulos contratados
DROP FUNCTION IF EXISTS public.get_clinic_addon_bonuses(UUID);

CREATE OR REPLACE FUNCTION public.get_clinic_addon_bonuses(p_clinic_id UUID)
RETURNS TABLE (pacientes_bonus INT, ia_bonus INT, audio_bonus INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(pa.pacientes_bonus * ca.quantidade), 0)::int,
    COALESCE(SUM(pa.ia_bonus_mes * ca.quantidade), 0)::int,
    COALESCE(SUM(pa.audio_bonus_mes * ca.quantidade), 0)::int
  FROM clinic_addons ca
  JOIN plan_addons pa ON pa.id = ca.addon_id
  WHERE ca.clinic_id = p_clinic_id AND ca.status = 'active';
$$;

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
  v_limite_audio INT;
  v_audio_addon INT;
BEGIN
  SELECT c.subscription_plan::text INTO v_plan
  FROM clinics c
  WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN;
  END IF;

  SELECT
    limite_profissionais,
    limite_pacientes_por_prof,
    limite_ia_interacoes_mes,
    limite_audio_minutos_mes
  INTO v_limite_prof, v_limite_pac, v_limite_ia, v_limite_audio
  FROM planos
  WHERE id = v_plan;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Fallback dinâmico se a coluna ainda não estiver populada
  IF v_limite_audio IS NULL AND v_limite_pac IS NOT NULL THEN
    SELECT FLOOR(
      v_limite_pac * p.sessoes_por_paciente_mes * p.duracao_sessao_minutos * 1.3
    )::INT
    INTO v_limite_audio
    FROM planos p
    WHERE p.id = v_plan;
  END IF;

  SELECT b.audio_bonus INTO v_audio_addon
  FROM get_clinic_addon_bonuses(p_clinic_id) b;

  UPDATE clinic_settings
  SET
    max_professionals = COALESCE(v_limite_prof, max_professionals),
    max_patients_per_professional = COALESCE(v_limite_pac, max_patients_per_professional),
    max_ai_queries_per_month = COALESCE(v_limite_ia, max_ai_queries_per_month),
    max_audio_minutes_per_month = COALESCE(v_limite_audio, 0) + COALESCE(v_audio_addon, 0),
    updated_at = now()
  WHERE clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    INSERT INTO clinic_settings (
      clinic_id,
      max_professionals,
      max_patients_per_professional,
      max_ai_queries_per_month,
      max_audio_minutes_per_month
    ) VALUES (
      p_clinic_id,
      COALESCE(v_limite_prof, 5),
      COALESCE(v_limite_pac, 30),
      COALESCE(v_limite_ia, 500),
      COALESCE(v_limite_audio, 0) + COALESCE(v_audio_addon, 0)
    );
  END IF;
END;
$$;

-- Backfill de todas as clínicas ativas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM clinics WHERE deleted_at IS NULL LOOP
    PERFORM public.sync_clinic_settings_from_plano(r.id);
  END LOOP;
END;
$$;
