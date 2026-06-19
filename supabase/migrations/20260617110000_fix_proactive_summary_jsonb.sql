-- ============================================================
-- FIX: build_proactive_summary_context — JSONB diagnoses
-- 
-- A coluna patients.diagnoses é JSONB (array de strings), não TEXT[].
-- A função original usava array_to_string() que não funciona com JSONB.
-- Corrigido para usar jsonb_array_elements_text().
-- ============================================================

CREATE OR REPLACE FUNCTION public.build_proactive_summary_context(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_profile TEXT;
  v_diary TEXT := '';
  v_sessions TEXT := '';
  v_evolution TEXT := '';
  v_diary_count INT := 0;
  v_diagnoses_text TEXT := '';
  v_trunc CONSTANT INT := 280;
BEGIN
  SELECT id, diagnoses, clinical_observations, created_at
  INTO v_patient
  FROM patients
  WHERE id = p_patient_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Convert JSONB array to comma-separated text
  SELECT COALESCE(string_agg(elem, ', '), 'não informado')
  INTO v_diagnoses_text
  FROM jsonb_array_elements_text(COALESCE(v_patient.diagnoses, '[]'::jsonb)) AS elem;

  v_profile := format(
    E'Diagnósticos: %s\nObservações: %s',
    v_diagnoses_text,
    COALESCE(NULLIF(trim(v_patient.clinical_observations), ''), 'nenhuma')
  );

  SELECT COUNT(*)::INT, string_agg(
    format(
      '%s | humor %s/5 | sono %s/5 | categorias: %s%s%s',
      de.entry_date,
      de.mood_score,
      de.sleep_quality,
      COALESCE((SELECT string_agg(cat, ', ') FROM jsonb_array_elements_text(COALESCE(de.categories, '[]'::jsonb)) AS cat), '-'),
      CASE WHEN de.crisis_occurred THEN format(' | CRISE nível %s', COALESCE(de.crisis_level::text, '?')) ELSE '' END,
      CASE WHEN de.notes IS NOT NULL AND trim(de.notes) <> '' THEN E'\n  Nota: ' || left(de.notes, 250) ELSE '' END
    ),
    E'\n' ORDER BY de.entry_date DESC
  )
  INTO v_diary_count, v_diary
  FROM diary_entries de
  WHERE de.patient_id = p_patient_id
    AND de.deleted_at IS NULL
    AND de.entry_date >= (CURRENT_DATE - INTERVAL '7 days');

  SELECT string_agg(block, E'\n\n---\n\n' ORDER BY created_at DESC)
  INTO v_sessions
  FROM (
    SELECT
      sn.created_at,
      format(
        E'[%s]\nS: %s\nO: %s\nA: %s\nP: %s',
        to_char(sn.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY'),
        left(COALESCE(sn.content->>'subjective', ''), v_trunc),
        left(COALESCE(sn.content->>'objective', ''), v_trunc),
        left(COALESCE(sn.content->>'assessment', ''), v_trunc),
        left(COALESCE(sn.content->>'plan', ''), v_trunc)
      ) AS block
    FROM session_notes sn
    WHERE sn.patient_id = p_patient_id AND sn.deleted_at IS NULL
    ORDER BY sn.created_at DESC
    LIMIT 3
  ) recent;

  SELECT string_agg(line, E'\n' ORDER BY week_start DESC)
  INTO v_evolution
  FROM (
    SELECT
      pew.week_start,
      format(
        'Semana %s: humor %s | sono %s | crises %s',
        to_char(pew.week_start, 'DD/MM'),
        round(pew.avg_mood::numeric, 1),
        round(pew.avg_sleep::numeric, 1),
        pew.crisis_count
      ) AS line
    FROM patient_evolution_weekly pew
    WHERE pew.patient_id = p_patient_id
    ORDER BY pew.week_start DESC
    LIMIT 4
  ) evo;

  RETURN jsonb_build_object(
    'found', true,
    'has_diary_data', v_diary_count > 0,
    'diary_entries_count', v_diary_count,
    'patient_profile', v_profile,
    'weekly_diary', COALESCE(v_diary, ''),
    'recent_sessions', COALESCE(v_sessions, ''),
    'evolution_summary', COALESCE(v_evolution, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_proactive_summary_context(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_proactive_summary_context(UUID) TO service_role;
