-- ============================================================
-- Portal da Família — calendário de rotina + brief da sessão
-- ============================================================

-- Dias do mês com status do diário (leve: só datas + flags)
CREATE OR REPLACE FUNCTION public.get_family_calendar_month(
  p_user_id UUID,
  p_year INT,
  p_month INT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_start DATE;
  v_end DATE;
  v_days JSONB;
BEGIN
  SELECT pfl.patient_id INTO v_patient_id
  FROM patient_family_links pfl
  WHERE pfl.user_id = p_user_id
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'NO_PATIENT_LINK');
  END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  SELECT COALESCE(jsonb_agg(day_row ORDER BY (day_row->>'date')), '[]'::jsonb)
  INTO v_days
  FROM (
    SELECT jsonb_build_object(
      'date', de.entry_date::text,
      'filled', true,
      'mood_score', de.mood_score,
      'crisis_occurred', de.crisis_occurred
    ) AS day_row
    FROM diary_entries de
    WHERE de.patient_id = v_patient_id
      AND de.deleted_at IS NULL
      AND de.entry_date BETWEEN v_start AND v_end
  ) sub;

  RETURN jsonb_build_object(
    'found', true,
    'patient_id', v_patient_id,
    'year', p_year,
    'month', p_month,
    'days', v_days
  );
END;
$$;

-- Última sessão + resumo proativo (para combinados familiares)
CREATE OR REPLACE FUNCTION public.get_family_session_brief(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_patient_name TEXT;
  v_session RECORD;
  v_summary TEXT;
  v_summary_at TIMESTAMPTZ;
BEGIN
  SELECT pfl.patient_id, pat.name
  INTO v_patient_id, v_patient_name
  FROM patient_family_links pfl
  INNER JOIN patients pat ON pat.id = pfl.patient_id AND pat.deleted_at IS NULL
  WHERE pfl.user_id = p_user_id
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'NO_PATIENT_LINK');
  END IF;

  SELECT
    sn.id,
    sn.created_at,
    sn.status,
    COALESCE(sn.content->>'subjective', '') AS subjective,
    COALESCE(sn.content->>'plan', '') AS plan,
    COALESCE(sn.content->>'assessment', '') AS assessment
  INTO v_session
  FROM session_notes sn
  WHERE sn.patient_id = v_patient_id
    AND sn.deleted_at IS NULL
    AND sn.status IN ('approved', 'draft')
  ORDER BY sn.created_at DESC
  LIMIT 1;

  SELECT ps.summary_markdown, ps.updated_at
  INTO v_summary, v_summary_at
  FROM patient_proactive_summaries ps
  WHERE ps.patient_id = v_patient_id;

  RETURN jsonb_build_object(
    'found', true,
    'patient_id', v_patient_id,
    'patient_name', v_patient_name,
    'last_session', CASE
      WHEN v_session.id IS NOT NULL THEN jsonb_build_object(
        'id', v_session.id,
        'date', v_session.created_at,
        'status', v_session.status,
        'subjective', left(v_session.subjective, 600),
        'plan', left(v_session.plan, 600),
        'assessment', left(v_session.assessment, 400)
      )
      ELSE NULL
    END,
    'proactive_summary', CASE
      WHEN v_summary IS NOT NULL AND trim(v_summary) <> '' THEN jsonb_build_object(
        'markdown', v_summary,
        'updated_at', v_summary_at
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_family_calendar_month(UUID, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_family_session_brief(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_family_calendar_month(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_family_session_brief(UUID) TO service_role;
