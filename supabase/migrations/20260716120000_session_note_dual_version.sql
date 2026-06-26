-- Versão clínica bruta (privada) + versão para família (family_text)
-- Família só enxerga family_text; prontuário mantém clinical_raw_text intacto.

COMMENT ON COLUMN public.session_notes.content IS
  'JSON SOAP + metadados. Após aprovação: clinical_raw_text (privado), family_text (opcional, visível à família).';

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
    left(
      COALESCE(
        sn.content->>'family_text',
        sn.content->>'lapidated_text',
        sn.content->>'summary_markdown',
        sn.content->>'subjective',
        ''
      ),
      600
    ) AS subjective,
    left(COALESCE(sn.content->>'plan', ''), 600) AS plan,
    left(COALESCE(sn.content->>'assessment', ''), 400) AS assessment
  INTO v_session
  FROM session_notes sn
  WHERE sn.patient_id = v_patient_id
    AND sn.deleted_at IS NULL
    AND sn.status = 'approved'
    AND sn.visivel_familia = true
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
        'subjective', v_session.subjective,
        'plan', v_session.plan,
        'assessment', v_session.assessment
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

REVOKE ALL ON FUNCTION public.get_family_session_brief(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_family_session_brief(UUID) TO service_role;
