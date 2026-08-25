-- Remove cotas de IA, áudio e sessões. O único limite do plano passa a ser pacientes ativos.
-- Copy dos planos pagos alinhada à landing.

UPDATE public.planos
SET
  limite_ia_interacoes_mes = NULL,
  limite_audio_minutos_mes = NULL,
  destaque = '1 paciente ativo',
  features = '[
    "1 paciente ativo",
    "Copiloto de IA",
    "Diário familiar & Portal"
  ]'::jsonb,
  updated_at = now()
WHERE id = 'free';

UPDATE public.planos
SET
  limite_ia_interacoes_mes = NULL,
  limite_audio_minutos_mes = NULL,
  destaque = 'Até 10 pacientes ativos',
  features = '[
    "Atende até 10 pacientes ativos",
    "Copiloto de IA com integração com paciente",
    "Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA",
    "Inclusão de anexos e prontuários com interatividade da IA",
    "Diário familiar com áudios transcritos para o terapeuta em tempo real",
    "Compra adicional de pacote de pacientes a qualquer momento, dentro do seu acesso"
  ]'::jsonb,
  updated_at = now()
WHERE id = 'standard';

UPDATE public.planos
SET
  limite_ia_interacoes_mes = NULL,
  limite_audio_minutos_mes = NULL,
  destaque = 'Até 20 pacientes ativos',
  features = '[
    "Atende de 11 a 20 pacientes ativos",
    "Copiloto de IA com integração com paciente",
    "Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA",
    "Inclusão de anexos e prontuários com interatividade da IA",
    "Diário familiar com áudios transcritos para o terapeuta em tempo real",
    "Compra adicional de pacote de pacientes a qualquer momento, dentro do seu acesso"
  ]'::jsonb,
  updated_at = now()
WHERE id = 'advanced';

UPDATE public.planos
SET
  limite_ia_interacoes_mes = NULL,
  limite_audio_minutos_mes = NULL,
  destaque = 'Até 30 pacientes ativos',
  features = '[
    "Atende de 21 a 30 pacientes ativos",
    "Copiloto de IA com integração com paciente",
    "Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA",
    "Inclusão de anexos e prontuários com interatividade da IA",
    "Diário familiar com áudios transcritos para o terapeuta em tempo real",
    "Compra adicional de pacote de pacientes a qualquer momento, com desconto exclusivo"
  ]'::jsonb,
  updated_at = now()
WHERE id = 'premium';

COMMENT ON COLUMN public.planos.limite_ia_interacoes_mes IS
  'Deprecated: IA não tem cota. NULL = ilimitado.';
COMMENT ON COLUMN public.planos.limite_audio_minutos_mes IS
  'Deprecated: áudio/transcrição não têm cota. NULL = ilimitado.';
COMMENT ON COLUMN public.planos.sessoes_por_paciente_mes IS
  'Deprecated: sessões não têm cota de plano. Mantido só por compatibilidade.';
COMMENT ON COLUMN public.planos.duracao_sessao_minutos IS
  'Deprecated: duração da sessão não é mais limitada pelo plano.';

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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'clinic_not_found');
  END IF;

  RETURN jsonb_build_object(
    'unlimited', true,
    'total_used', NULL,
    'total_limit', NULL,
    'patient_used', NULL,
    'patient_recommended', NULL,
    'warn_patient', false,
    'blocked_total', false
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM clinics c WHERE c.id = p_clinic_id AND c.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'clinic_not_found');
  END IF;

  RETURN jsonb_build_object(
    'unlimited', true,
    'used', NULL,
    'limit', NULL,
    'warn', false,
    'blocked', false
  );
END;
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
BEGIN
  SELECT c.subscription_plan::text INTO v_plan
  FROM clinics c
  WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN;
  END IF;

  SELECT limite_profissionais, limite_pacientes_por_prof
  INTO v_limite_prof, v_limite_pac
  FROM planos
  WHERE id = v_plan;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE clinic_settings
  SET
    max_professionals = COALESCE(v_limite_prof, max_professionals),
    max_patients_per_professional = COALESCE(v_limite_pac, max_patients_per_professional),
    max_ai_queries_per_month = 0,
    max_audio_minutes_per_month = 0,
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
      0,
      0
    );
  END IF;
END;
$$;

UPDATE public.clinic_settings
SET
  max_ai_queries_per_month = 0,
  max_audio_minutes_per_month = 0,
  updated_at = now();
