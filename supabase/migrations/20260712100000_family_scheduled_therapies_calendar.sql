-- Calendário de terapias agendadas — Portal da Família (separado do diário de rotina)

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

  SELECT COALESCE(jsonb_agg(day_group ORDER BY (day_group->>'date')), '[]'::jsonb)
  INTO v_days
  FROM (
    SELECT jsonb_build_object(
      'date', ms.session_date::text,
      'sessions', jsonb_agg(
        jsonb_build_object(
          'id', ms.id,
          'scheduled_at', ms.scheduled_at,
          'time', to_char(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
          'therapist_name', ms.therapist_name,
          'status', ms.status,
          'duration_minutes', ms.duration_minutes,
          'title', ms.title
        )
        ORDER BY ms.scheduled_at
      )
    ) AS day_group
    FROM (
      SELECT
        ts.id,
        (ts.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS session_date,
        ts.scheduled_at,
        ts.duration_minutes,
        ts.status,
        ts.title,
        prof.name AS therapist_name
      FROM therapist_schedule ts
      INNER JOIN professionals prof
        ON prof.id = ts.professional_id
        AND prof.deleted_at IS NULL
      WHERE ts.patient_id = v_patient_id
        AND ts.deleted_at IS NULL
        AND ts.status IN ('scheduled', 'in_progress')
        AND (ts.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_start AND v_end
    ) ms
    GROUP BY ms.session_date
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

CREATE INDEX IF NOT EXISTS idx_schedule_patient_status_date
  ON public.therapist_schedule (patient_id, scheduled_at)
  WHERE deleted_at IS NULL AND status IN ('scheduled', 'in_progress');
