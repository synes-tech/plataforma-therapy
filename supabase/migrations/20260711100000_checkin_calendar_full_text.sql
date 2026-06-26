-- Check-in calendar: payload completo (textos, transcrição, áudio) sem truncar notes

CREATE OR REPLACE FUNCTION public.get_patient_crisis_calendar(
  p_patient_id UUID,
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
  v_start DATE;
  v_end DATE;
  v_days JSONB;
  v_crisis_count INT;
  v_total_entries INT;
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'patient_id is required and cannot be null';
  END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  SELECT
    COALESCE(jsonb_agg(day_row ORDER BY (day_row->>'date')), '[]'::jsonb),
    COUNT(*) FILTER (WHERE (day_row->>'crisis_occurred')::boolean = true),
    COUNT(*)
  INTO v_days, v_crisis_count, v_total_entries
  FROM (
    SELECT jsonb_build_object(
      'id', de.id,
      'date', de.entry_date::text,
      'filled', true,
      'mood_score', de.mood_score,
      'sleep_quality', de.sleep_quality,
      'crisis_occurred', de.crisis_occurred,
      'crisis_level', de.crisis_level,
      'categories', de.categories,
      'notes', de.notes,
      'transcricao', de.transcricao,
      'audio_note_url', de.audio_note_url,
      'text_details', COALESCE(
        (
          SELECT jsonb_agg(detail ORDER BY ord)
          FROM (
            SELECT
              1 AS ord,
              jsonb_build_object(
                'kind', 'notes',
                'label', 'Observações da família',
                'text', de.notes
              ) AS detail
            WHERE de.notes IS NOT NULL AND btrim(de.notes) <> ''
            UNION ALL
            SELECT
              2 AS ord,
              jsonb_build_object(
                'kind', 'transcricao',
                'label', 'Relato em áudio (transcrição)',
                'text', de.transcricao
              ) AS detail
            WHERE de.transcricao IS NOT NULL AND btrim(de.transcricao) <> ''
          ) parts
        ),
        '[]'::jsonb
      ),
      'family_member_id', de.family_member_id
    ) AS day_row
    FROM diary_entries de
    WHERE de.patient_id = p_patient_id
      AND de.deleted_at IS NULL
      AND de.entry_date BETWEEN v_start AND v_end
    ORDER BY de.entry_date
  ) sub;

  RETURN jsonb_build_object(
    'patient_id', p_patient_id,
    'year', p_year,
    'month', p_month,
    'days', v_days,
    'summary', jsonb_build_object(
      'total_entries', v_total_entries,
      'crisis_count', v_crisis_count,
      'fill_rate', CASE
        WHEN (v_end - v_start + 1) > 0
        THEN round((v_total_entries::numeric / (v_end - v_start + 1)::numeric) * 100, 1)
        ELSE 0
      END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_crisis_calendar(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_crisis_calendar(UUID, INT, INT) TO service_role;
