-- Sessão Dual — workspace clínico multimodal (áudio, texto ou ambos)
-- Aditivo: não altera constraints existentes de áudio.

ALTER TABLE public.session_notes
  ADD COLUMN IF NOT EXISTS anotacoes_texto TEXT,
  ADD COLUMN IF NOT EXISTS input_mode TEXT;

ALTER TABLE public.session_notes
  DROP CONSTRAINT IF EXISTS session_notes_input_mode_check;

ALTER TABLE public.session_notes
  ADD CONSTRAINT session_notes_input_mode_check
  CHECK (
    input_mode IS NULL
    OR input_mode IN ('audio', 'text', 'dual')
  );

COMMENT ON COLUMN public.session_notes.anotacoes_texto IS
  'Anotações textuais digitadas pelo terapeuta durante ou em substituição ao áudio.';

COMMENT ON COLUMN public.session_notes.input_mode IS
  'Modalidade de entrada: audio | text | dual. NULL = legado (áudio).';

ALTER TABLE public.audio_recordings
  ADD COLUMN IF NOT EXISTS anotacoes_texto TEXT;

COMMENT ON COLUMN public.audio_recordings.anotacoes_texto IS
  'Rascunho de anotações ao vivo durante gravação (mesclado no processamento).';

CREATE INDEX IF NOT EXISTS idx_session_notes_schedule_input
  ON public.session_notes (schedule_id, input_mode, created_at DESC)
  WHERE deleted_at IS NULL AND schedule_id IS NOT NULL;

-- View legível atualizada (security_invoker)
-- DROP necessário: CREATE OR REPLACE não permite renomear/reordenar colunas.
DROP VIEW IF EXISTS public.sessoes;

CREATE VIEW public.sessoes
WITH (security_invoker = true) AS
SELECT
  sn.id,
  sn.patient_id                    AS paciente_id,
  sn.professional_id               AS terapeuta_id,
  sn.clinic_id                     AS clinica_id,
  sn.schedule_id                   AS agendamento_id,
  sn.input_mode                    AS modalidade_entrada,
  sn.anotacoes_texto               AS anotacoes_texto,
  ar.storage_path                  AS audio_url,
  ar.mime_type                     AS audio_mime_type,
  ar.duration_seconds              AS audio_duracao_segundos,
  at.raw_text                      AS transcricao_completa,
  sn.content                       AS resumo_ia,
  sn.status                        AS status_nota,
  sn.visivel_familia               AS visivel_familia,
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
  'Histórico de sessões multimodal: nota SOAP, áudio, transcrição e anotações textuais.';

-- Estender fila de jobs para sessão somente texto
ALTER TABLE public.ai_jobs
  DROP CONSTRAINT IF EXISTS ai_jobs_job_type_check;

ALTER TABLE public.ai_jobs
  ADD CONSTRAINT ai_jobs_job_type_check
  CHECK (job_type IN ('transcribe', 'structure_soap', 'generate_embeddings', 'copilot_query', 'session_text'));
