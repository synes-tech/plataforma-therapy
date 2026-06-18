-- ============================================================
-- Resumo Proativo Clínico — cache por paciente (TTL 24h na app)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_proactive_summaries (
  patient_id UUID PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  summary_markdown TEXT NOT NULL,
  tokens_used INT,
  diary_entries_count INT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proactive_summaries_professional
  ON public.patient_proactive_summaries (professional_id, updated_at DESC);

CREATE TRIGGER trg_proactive_summaries_updated
  BEFORE UPDATE ON public.patient_proactive_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.patient_proactive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proactive_summaries_master_access"
  ON public.patient_proactive_summaries FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master');

CREATE POLICY "proactive_summaries_professional_own"
  ON public.patient_proactive_summaries FOR ALL
  USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "proactive_summaries_clinic_admin_read"
  ON public.patient_proactive_summaries FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  );

-- Contexto focado no diário semanal da família + sessões recentes
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
  v_trunc CONSTANT INT := 280;
BEGIN
  SELECT id, diagnoses, clinical_observations, created_at
  INTO v_patient
  FROM patients
  WHERE id = p_patient_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_profile := format(
    E'Diagnósticos: %s\nObservações: %s',
    COALESCE(array_to_string(v_patient.diagnoses, ', '), 'não informado'),
    COALESCE(NULLIF(trim(v_patient.clinical_observations), ''), 'nenhuma')
  );

  SELECT COUNT(*)::INT, string_agg(
    format(
      '%s | humor %s/5 | sono %s/5 | categorias: %s%s%s',
      de.entry_date,
      de.mood_score,
      de.sleep_quality,
      COALESCE(array_to_string(de.categories, ', '), '-'),
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
