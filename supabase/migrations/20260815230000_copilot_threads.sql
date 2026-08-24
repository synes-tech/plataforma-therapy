-- ============================================================
-- Copiloto ao Terapeuta — thread persistente isolada por paciente
-- Um thread ativo por (profissional, paciente). Soft delete obrigatório.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.copilot_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_copilot_threads_active_unique
  ON public.copilot_threads (professional_id, patient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_threads_patient
  ON public.copilot_threads (patient_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_threads_professional
  ON public.copilot_threads (professional_id, updated_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_copilot_threads_updated ON public.copilot_threads;
CREATE TRIGGER trg_copilot_threads_updated
  BEFORE UPDATE ON public.copilot_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.copilot_threads(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  input_source TEXT NOT NULL DEFAULT 'text' CHECK (input_source IN ('text', 'audio')),
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  guardrail_triggered BOOLEAN NOT NULL DEFAULT false,
  answer_incomplete BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_thread
  ON public.copilot_messages (thread_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_messages_patient
  ON public.copilot_messages (patient_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.copilot_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copilot_threads_master" ON public.copilot_threads;
CREATE POLICY "copilot_threads_master"
  ON public.copilot_threads FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master');

DROP POLICY IF EXISTS "copilot_threads_professional_own" ON public.copilot_threads;
CREATE POLICY "copilot_threads_professional_own"
  ON public.copilot_threads FOR ALL
  USING (
    deleted_at IS NULL
    AND professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
    AND patient_id IN (
      SELECT pat.id FROM public.patients pat
      JOIN public.professionals prof ON pat.professional_id = prof.id
      WHERE prof.user_id = auth.uid()
        AND prof.deleted_at IS NULL
        AND pat.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "copilot_messages_master" ON public.copilot_messages;
CREATE POLICY "copilot_messages_master"
  ON public.copilot_messages FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master');

DROP POLICY IF EXISTS "copilot_messages_professional_own" ON public.copilot_messages;
CREATE POLICY "copilot_messages_professional_own"
  ON public.copilot_messages FOR ALL
  USING (
    deleted_at IS NULL
    AND patient_id IN (
      SELECT pat.id FROM public.patients pat
      JOIN public.professionals prof ON pat.professional_id = prof.id
      WHERE prof.user_id = auth.uid()
        AND prof.deleted_at IS NULL
        AND pat.deleted_at IS NULL
    )
  );
