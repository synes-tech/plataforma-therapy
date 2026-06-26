-- ============================================================
-- Portal Família — calendário de terapias com histórico
-- Inclui sessões realizadas + flag de relatório compartilhado
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_family_scheduled_therapies_month(
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

  WITH session_rows AS (
    SELECT
      ts.id AS schedule_id,
      (ts.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS session_date,
      ts.scheduled_at,
      ts.duration_minutes,
      ts.status,
      COALESCE(NULLIF(trim(ts.title), ''), 'Sessão de terapia') AS title,
      prof.name AS therapist_name,
      (
        SELECT sn.id
        FROM session_notes sn
        WHERE sn.deleted_at IS NULL
          AND (
            sn.id = ts.session_note_id
            OR sn.schedule_id = ts.id
          )
        ORDER BY sn.created_at DESC
        LIMIT 1
      ) AS session_note_id,
      (
        SELECT (sn.status = 'approved' AND sn.visivel_familia = true)
        FROM session_notes sn
        WHERE sn.deleted_at IS NULL
          AND (
            sn.id = ts.session_note_id
            OR sn.schedule_id = ts.id
          )
        ORDER BY sn.created_at DESC
        LIMIT 1
      ) AS has_shared_report
    FROM therapist_schedule ts
    INNER JOIN professionals prof
      ON prof.id = ts.professional_id
      AND prof.deleted_at IS NULL
    WHERE ts.patient_id = v_patient_id
      AND ts.deleted_at IS NULL
      AND ts.status NOT IN ('cancelled', 'no_show')
      AND (ts.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end

    UNION ALL

    SELECT
      NULL::uuid AS schedule_id,
      (sn.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS session_date,
      sn.created_at AS scheduled_at,
      50 AS duration_minutes,
      'completed'::text AS status,
      'Sessão registrada'::text AS title,
      prof.name AS therapist_name,
      sn.id AS session_note_id,
      (sn.status = 'approved' AND sn.visivel_familia = true) AS has_shared_report
    FROM session_notes sn
    INNER JOIN professionals prof
      ON prof.id = sn.professional_id
      AND prof.deleted_at IS NULL
    WHERE sn.patient_id = v_patient_id
      AND sn.deleted_at IS NULL
      AND sn.status = 'approved'
      AND sn.schedule_id IS NULL
      AND (sn.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
  )
  SELECT COALESCE(jsonb_agg(day_group ORDER BY (day_group->>'date')), '[]'::jsonb)
  INTO v_days
  FROM (
    SELECT jsonb_build_object(
      'date', sr.session_date::text,
      'sessions', jsonb_agg(
        jsonb_build_object(
          'id', COALESCE(sr.schedule_id::text, sr.session_note_id::text),
          'schedule_id', sr.schedule_id,
          'session_note_id', sr.session_note_id,
          'scheduled_at', sr.scheduled_at,
          'time', to_char(sr.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
          'therapist_name', sr.therapist_name,
          'status', sr.status,
          'duration_minutes', sr.duration_minutes,
          'title', sr.title,
          'has_shared_report', COALESCE(sr.has_shared_report, false)
        )
        ORDER BY sr.scheduled_at
      )
    ) AS day_group
    FROM session_rows sr
    GROUP BY sr.session_date
  ) grouped;

  RETURN jsonb_build_object(
    'found', true,
    'patient_id', v_patient_id,
    'year', p_year,
    'month', p_month,
    'days', v_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_family_scheduled_therapies_month(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_family_scheduled_therapies_month(UUID, INT, INT) TO service_role;
