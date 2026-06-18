-- ============================================================
-- UNITHERY — View de Sessões (histórico unificado)
-- Migration: 20260627100000_sessoes_view.sql
--
-- O modelo normalizado usa session_notes + audio_recordings +
-- audio_transcriptions. Esta VIEW expõe o contrato legível para
-- histórico de sessões sem duplicar dados.
-- RLS das tabelas base aplica via security_invoker.
-- ============================================================

CREATE OR REPLACE VIEW public.sessoes
WITH (security_invoker = true) AS
SELECT
  sn.id,
  sn.patient_id                    AS paciente_id,
  sn.professional_id               AS terapeuta_id,
  sn.clinic_id                     AS clinica_id,
  ar.storage_path                  AS audio_url,
  ar.mime_type                     AS audio_mime_type,
  ar.duration_seconds              AS audio_duracao_segundos,
  at.raw_text                      AS transcricao_completa,
  sn.content                       AS resumo_ia,
  sn.status                        AS status_nota,
  sn.created_at                    AS data_sessao,
  sn.updated_at                    AS atualizado_em
FROM public.session_notes sn
LEFT JOIN public.audio_recordings ar
  ON ar.id = sn.audio_recording_id
  AND ar.deleted_at IS NULL
LEFT JOIN public.audio_transcriptions at
  ON at.id = sn.transcription_id
WHERE sn.deleted_at IS NULL;

COMMENT ON VIEW public.sessoes IS
  'Histórico de sessões: une nota SOAP, áudio e transcrição. Ordenar por data_sessao DESC.';

-- Índice composto para listagem paginada (notas com áudio)
CREATE INDEX IF NOT EXISTS idx_session_notes_patient_session_date
  ON public.session_notes (patient_id, created_at DESC)
  WHERE deleted_at IS NULL;
