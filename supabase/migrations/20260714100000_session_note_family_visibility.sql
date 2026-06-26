-- Visibilidade familiar em relatórios de sessão aprovados
-- Default false: prontuário privado até opt-in explícito do terapeuta.

ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS visivel_familia BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN session_notes.visivel_familia IS
  'Se true, resumo da sessão aprovada fica visível no app da família. Default false = sigilo clínico.';

UPDATE session_notes
SET visivel_familia = false
WHERE visivel_familia IS DISTINCT FROM false;

CREATE INDEX IF NOT EXISTS idx_session_notes_family_visible
  ON session_notes (patient_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'approved' AND visivel_familia = true;

-- Família: SELECT apenas relatórios explicitamente compartilhados e aprovados
DROP POLICY IF EXISTS "session_notes_family_view_shared" ON session_notes;
CREATE POLICY "session_notes_family_view_shared"
  ON session_notes FOR SELECT
  USING (
    visivel_familia = true
    AND status = 'approved'
    AND deleted_at IS NULL
    AND patient_id IN (
      SELECT pfl.patient_id
      FROM public.patient_family_links pfl
      WHERE pfl.user_id = auth.uid()
    )
  );

-- RPC: família só vê sessões aprovadas e marcadas visivel_familia = true
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
