-- ============================================================
-- Executive Summary — inclui campos de anamnese clínica
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
  v_anamnesis TEXT;
  v_initial_session TEXT := '';
  v_recent_sessions TEXT := '';
  v_diary TEXT := '';
  v_evolution TEXT := '';
  v_session_count INT;
  v_has_clinical_data BOOLEAN;
  v_trunc CONSTANT INT := 320;
  v_diag TEXT;
  v_acomp TEXT;
BEGIN
  SELECT *
  INTO v_patient
  FROM patients
  WHERE id = p_patient_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COUNT(*)::INT INTO v_session_count
  FROM session_notes
  WHERE patient_id = p_patient_id AND deleted_at IS NULL;

  SELECT COALESCE(string_agg(elem, ', '), 'não informado')
  INTO v_diag
  FROM jsonb_array_elements_text(COALESCE(v_patient.diagnoses, '[]'::jsonb)) AS elem;

  SELECT COALESCE(string_agg(elem, ', '), 'nenhum')
  INTO v_acomp
  FROM jsonb_array_elements_text(COALESCE(v_patient.acompanhamento_multi, '[]'::jsonb)) AS elem;

  v_profile := format(
    E'Cadastro: %s | Sexo: %s | Diagnósticos: %s\nObservações iniciais: %s',
    to_char(v_patient.created_at AT TIME ZONE 'UTC', 'DD/MM/YYYY'),
    COALESCE(v_patient.gender, 'não informado'),
    v_diag,
    COALESCE(NULLIF(trim(v_patient.clinical_observations), ''), 'nenhuma')
  );

  v_anamnesis := format(
    E'=== ANAMNESE CLÍNICA (cadastro) ===
Nome social: %s
Escolaridade/ocupação: %s
Queixa principal: %s
Medicamentos em uso: %s
Acompanhamento multidisciplinar: %s
Composição familiar: %s
Responsáveis: %s
Objetivos terapêuticos: %s
Hiperfocos e interesses: %s
Informações adicionais: %s',
    COALESCE(NULLIF(trim(v_patient.nome_social), ''), 'não informado'),
    COALESCE(NULLIF(trim(v_patient.escolaridade_ocupacao), ''), 'não informado'),
    COALESCE(NULLIF(trim(v_patient.queixa_principal), ''), 'não informada'),
    COALESCE(NULLIF(trim(v_patient.medicamentos), ''), 'nenhum registrado'),
    v_acomp,
    COALESCE(NULLIF(trim(v_patient.composicao_familiar), ''), 'não informada'),
    COALESCE(NULLIF(trim(v_patient.responsaveis), ''), 'não informados'),
    COALESCE(NULLIF(trim(v_patient.objetivos_terapeuticos), ''), 'não informados'),
    COALESCE(NULLIF(trim(v_patient.hiperfocos_interesses), ''), 'não informados'),
    COALESCE(NULLIF(trim(v_patient.informacoes_adicionais), ''), 'nenhuma')
  );

  v_profile := v_profile || E'\n\n' || v_anamnesis;

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
    OR (v_patient.queixa_principal IS NOT NULL AND trim(v_patient.queixa_principal) <> '')
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
