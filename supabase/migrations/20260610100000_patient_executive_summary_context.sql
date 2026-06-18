-- ============================================================
-- Executive Summary — contexto otimizado para LLM
-- Chamada APENAS via service_role (Edge Function após auth)
-- ============================================================

CREATE OR REPLACE FUNCTION public.build_patient_summary_context(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_profile TEXT;
  v_initial_session TEXT := '';
  v_recent_sessions TEXT := '';
  v_diary TEXT := '';
  v_evolution TEXT := '';
  v_session_count INT;
  v_has_clinical_data BOOLEAN;
  v_trunc CONSTANT INT := 320; -- chars máx por campo SOAP
BEGIN
  SELECT id, name, birth_date, gender, diagnoses, clinical_observations, created_at
  INTO v_patient
  FROM patients
  WHERE id = p_patient_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COUNT(*)::INT INTO v_session_count
  FROM session_notes
  WHERE patient_id = p_patient_id AND deleted_at IS NULL;

  v_profile := format(
    E'Cadastro: %s | Sexo: %s | Diagnósticos: %s\nObservações iniciais: %s',
    to_char(v_patient.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY'),
    COALESCE(v_patient.gender, 'não informado'),
    COALESCE(array_to_string(v_patient.diagnoses, ', '), 'não informado'),
    COALESCE(NULLIF(trim(v_patient.clinical_observations), ''), 'nenhuma')
  );

  -- Primeira sessão com conteúdo (linha de base / intake)
  SELECT format(
    E'[%s | %s]\nS: %s\nO: %s\nA: %s\nP: %s',
    to_char(sn.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY'),
    sn.status,
    left(COALESCE(sn.content->>'subjective', ''), v_trunc),
    left(COALESCE(sn.content->>'objective', ''), v_trunc),
    left(COALESCE(sn.content->>'assessment', ''), v_trunc),
    left(COALESCE(sn.content->>'plan', ''), v_trunc)
  )
  INTO v_initial_session
  FROM session_notes sn
  WHERE sn.patient_id = p_patient_id
    AND sn.deleted_at IS NULL
    AND (
      COALESCE(sn.content->>'subjective', '') <> ''
      OR COALESCE(sn.content->>'objective', '') <> ''
      OR COALESCE(sn.content->>'assessment', '') <> ''
      OR COALESCE(sn.content->>'plan', '') <> ''
    )
  ORDER BY sn.created_at ASC
  LIMIT 1;

  -- Últimas 10 sessões (cronológico: mais antiga → mais recente)
  SELECT string_agg(block, E'\n\n---\n\n' ORDER BY created_at ASC)
  INTO v_recent_sessions
  FROM (
    SELECT
      sn.created_at,
      format(
        E'[%s | %s]\nS: %s\nO: %s\nA: %s\nP: %s',
        to_char(sn.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY'),
        sn.status,
        left(COALESCE(sn.content->>'subjective', ''), v_trunc),
        left(COALESCE(sn.content->>'objective', ''), v_trunc),
        left(COALESCE(sn.content->>'assessment', ''), v_trunc),
        left(COALESCE(sn.content->>'plan', ''), v_trunc)
      ) AS block
    FROM session_notes sn
    WHERE sn.patient_id = p_patient_id AND sn.deleted_at IS NULL
    ORDER BY sn.created_at DESC
    LIMIT 10
  ) recent;

  -- Diário familiar — últimos 14 dias
  SELECT string_agg(
    format(
      '%s | humor %s/5 | sono %s/5%s%s',
      de.entry_date,
      de.mood_score,
      de.sleep_quality,
      CASE WHEN de.crisis_occurred THEN format(' | CRISE nível %s', COALESCE(de.crisis_level::text, '?')) ELSE '' END,
      CASE WHEN de.notes IS NOT NULL AND trim(de.notes) <> '' THEN ' | ' || left(de.notes, 200) ELSE '' END
    ),
    E'\n' ORDER BY de.entry_date DESC
  )
  INTO v_diary
  FROM diary_entries de
  WHERE de.patient_id = p_patient_id
    AND de.deleted_at IS NULL
    AND de.entry_date >= (CURRENT_DATE - INTERVAL '14 days');

  -- Evolução semanal agregada (últimas 8 semanas)
  SELECT string_agg(line, E'\n' ORDER BY week_start DESC)
  INTO v_evolution
  FROM (
    SELECT
      pew.week_start,
      format(
        'Semana de %s: humor médio %s | sono %s | crises %s | registros %s',
        to_char(pew.week_start, 'DD/MM'),
        round(pew.avg_mood::numeric, 1),
        round(pew.avg_sleep::numeric, 1),
        pew.crisis_count,
        pew.total_entries
      ) AS line
    FROM patient_evolution_weekly pew
    WHERE pew.patient_id = p_patient_id
    ORDER BY pew.week_start DESC
    LIMIT 8
  ) evo;

  v_has_clinical_data := v_session_count > 0
    OR (v_patient.clinical_observations IS NOT NULL AND trim(v_patient.clinical_observations) <> '')
    OR (v_diary IS NOT NULL AND v_diary <> '');

  RETURN jsonb_build_object(
    'found', true,
    'session_count', v_session_count,
    'has_clinical_data', v_has_clinical_data,
    'patient_profile', v_profile,
    'initial_session', COALESCE(v_initial_session, ''),
    'recent_sessions', COALESCE(v_recent_sessions, ''),
    'diary_summary', COALESCE(v_diary, ''),
    'evolution_summary', COALESCE(v_evolution, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_patient_summary_context(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_patient_summary_context(UUID) TO service_role;

COMMENT ON FUNCTION public.build_patient_summary_context IS
  'Agrega perfil + 10 últimas sessões + diário 14d + evolução semanal para Executive Summary IA. Somente service_role.';
