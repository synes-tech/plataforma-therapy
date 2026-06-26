-- ============================================================
-- Diário de Rotina — múltiplos registros por dia
-- Remove trava de 1 entrada/dia e agrega calendário familiar
-- ============================================================

ALTER TABLE diary_entries
  DROP CONSTRAINT IF EXISTS diary_entries_unique_daily;

CREATE INDEX IF NOT EXISTS idx_diary_entries_patient_date_created
  ON diary_entries (patient_id, entry_date DESC, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE diary_entries IS
  'Registros do diário familiar. Múltiplas entradas por dia são permitidas (crises intermitentes, oscilações de humor).';

-- Calendário do portal família: uma linha por data, com contagem de registros
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
      'date', agg.entry_date::text,
      'filled', true,
      'entry_count', agg.entry_count,
      'mood_score', agg.latest_mood,
      'crisis_occurred', agg.any_crisis
    ) AS day_row
    FROM (
      SELECT
        de.entry_date,
        COUNT(*)::int AS entry_count,
        (array_agg(de.mood_score ORDER BY de.created_at DESC))[1] AS latest_mood,
        BOOL_OR(de.crisis_occurred) AS any_crisis
      FROM diary_entries de
      WHERE de.patient_id = v_patient_id
        AND de.deleted_at IS NULL
        AND de.entry_date BETWEEN v_start AND v_end
      GROUP BY de.entry_date
    ) agg
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
