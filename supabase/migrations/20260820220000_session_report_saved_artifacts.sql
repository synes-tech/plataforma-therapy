-- Relatório de sessão aprovado vira documento salvo (canônico por session_note_id).
-- Backfill do histórico clínico aprovado.

ALTER TABLE public.recomendacoes_salvas
  ADD COLUMN IF NOT EXISTS session_note_id UUID REFERENCES public.session_notes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recomendacoes_session_note
  ON public.recomendacoes_salvas (session_note_id)
  WHERE session_note_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recomendacoes_session_note_lookup
  ON public.recomendacoes_salvas (session_note_id)
  WHERE session_note_id IS NOT NULL;

COMMENT ON COLUMN public.recomendacoes_salvas.session_note_id IS
  'Artefato canônico gerado a partir da aprovação da sessão. Cópias duplicadas ficam NULL.';

CREATE OR REPLACE FUNCTION public.session_note_report_markdown(p_content jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
  v_s1 text;
  v_s2 text;
  v_s3 text;
  v_s4 text;
  v_has_section boolean := false;
BEGIN
  IF p_content IS NULL THEN
    RETURN '';
  END IF;

  v_text := NULLIF(btrim(p_content->>'clinical_raw_text'), '');
  IF v_text IS NOT NULL THEN RETURN v_text; END IF;

  v_text := NULLIF(btrim(p_content->>'lapidated_text'), '');
  IF v_text IS NOT NULL THEN RETURN v_text; END IF;

  v_text := NULLIF(btrim(p_content->>'summary_markdown'), '');
  IF v_text IS NOT NULL THEN RETURN v_text; END IF;

  v_s1 := NULLIF(btrim(COALESCE(p_content->>'clinical_synthesis', p_content->>'objective', '')), '');
  v_s2 := NULLIF(btrim(COALESCE(p_content->>'patient_reports', p_content->>'subjective', '')), '');
  v_s3 := NULLIF(btrim(COALESCE(p_content->>'clinical_observations', p_content->>'assessment', '')), '');
  v_s4 := NULLIF(btrim(COALESCE(p_content->>'management_next_steps', p_content->>'plan', '')), '');
  v_has_section := v_s1 IS NOT NULL OR v_s2 IS NOT NULL OR v_s3 IS NOT NULL OR v_s4 IS NOT NULL;

  IF v_has_section THEN
    RETURN concat_ws(E'\n\n',
      '## Síntese da Sessão' || E'\n' || COALESCE(v_s1, 'Não relatado nesta sessão.'),
      '## Relatos e Conteúdo Trazido' || E'\n' || COALESCE(
        v_s2,
        'Durante a sessão, não foram trazidos relatos ou conteúdos verbais suficientes para este bloco.'
      ),
      '## Observações e Hipóteses' || E'\n' || COALESCE(
        v_s3,
        'Durante a sessão, o terapeuta não trouxe observações ou hipóteses clínicas explícitas.'
      ),
      '## Manejo e Próximos Passos' || E'\n' || COALESCE(
        v_s4,
        'Durante a sessão, não foram registrados manejo ou próximos passos explícitos.'
      )
    );
  END IF;

  RETURN COALESCE(NULLIF(btrim(p_content->>'transcription'), ''), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.session_report_artifact_title(
  p_session_at timestamptz,
  p_patient_name text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'Relatório da sessão de '
    || to_char(COALESCE(p_session_at, now()) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
    || ' — '
    || COALESCE(NULLIF(btrim(p_patient_name), ''), 'paciente');
$$;

INSERT INTO public.recomendacoes_salvas (
  paciente_id,
  terapeuta_id,
  clinica_id,
  tipo_artefato,
  titulo,
  conteudo_texto,
  artifact_fingerprint,
  compartilhado_familia,
  session_note_id,
  conteudo,
  criado_em
)
SELECT
  sn.patient_id,
  sn.professional_id,
  sn.clinic_id,
  'relatorio_sessao',
  public.session_report_artifact_title(
    COALESCE(ts.scheduled_at, sn.approved_at, sn.created_at),
    p.name
  ),
  md,
  encode(
    digest(md || E'\n#session_note:' || sn.id::text, 'sha256'),
    'hex'
  ),
  false,
  sn.id,
  jsonb_build_object(
    'source', 'session_approval_backfill',
    'tipo_artefato', 'relatorio_sessao',
    'session_note_id', sn.id,
    'text', md,
    'saved_at', COALESCE(sn.approved_at, sn.created_at)
  ),
  COALESCE(sn.approved_at, sn.created_at)
FROM public.session_notes sn
JOIN public.patients p ON p.id = sn.patient_id AND p.deleted_at IS NULL
LEFT JOIN public.therapist_schedule ts
  ON ts.id = sn.schedule_id AND ts.deleted_at IS NULL
CROSS JOIN LATERAL (
  SELECT public.session_note_report_markdown(sn.content) AS md
) report
WHERE sn.deleted_at IS NULL
  AND length(md) >= 10
  AND NOT EXISTS (
    SELECT 1
    FROM public.recomendacoes_salvas r
    WHERE r.session_note_id = sn.id
  )
ON CONFLICT DO NOTHING;

GRANT EXECUTE ON FUNCTION public.session_note_report_markdown(jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.session_report_artifact_title(timestamptz, text) TO PUBLIC;

NOTIFY pgrst, 'reload schema';
