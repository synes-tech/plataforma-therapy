-- Ciclo de vida da sessão agendada: início → áudio → relatório → aprovação → concluída

ALTER TABLE public.therapist_schedule
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_note_id UUID REFERENCES public.session_notes(id);

ALTER TABLE public.session_notes
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.therapist_schedule(id);

ALTER TABLE public.audio_recordings
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.therapist_schedule(id);

ALTER TABLE public.therapist_schedule
  DROP CONSTRAINT IF EXISTS therapist_schedule_status_check;

ALTER TABLE public.therapist_schedule
  ADD CONSTRAINT therapist_schedule_status_check
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'not_completed', 'cancelled', 'no_show'));

CREATE INDEX IF NOT EXISTS idx_schedule_status
  ON public.therapist_schedule (professional_id, status, scheduled_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_notes_schedule
  ON public.session_notes (schedule_id)
  WHERE deleted_at IS NULL AND schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audio_recordings_schedule
  ON public.audio_recordings (schedule_id)
  WHERE deleted_at IS NULL AND schedule_id IS NOT NULL;
