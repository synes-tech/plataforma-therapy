-- ============================================================
-- UNITHERY — Anexos do paciente (Storage + metadados + RAG)
-- Migration: 20260716200000_patient_attachments_rag.sql
-- ============================================================

-- Extensão pgvector (idempotente — já usada pelo copiloto)
CREATE EXTENSION IF NOT EXISTS vector;

-- Novo tipo de documento no RAG do copiloto
ALTER TABLE public.patient_embeddings
  DROP CONSTRAINT IF EXISTS patient_embeddings_document_type_check;

ALTER TABLE public.patient_embeddings
  ADD CONSTRAINT patient_embeddings_document_type_check
  CHECK (document_type IN (
    'session_note',
    'transcription',
    'diary_entry',
    'onboarding',
    'patient_attachment'
  ));

-- Fila de jobs IA — pipeline de anexos
ALTER TABLE public.ai_jobs
  DROP CONSTRAINT IF EXISTS ai_jobs_job_type_check;

ALTER TABLE public.ai_jobs
  ADD CONSTRAINT ai_jobs_job_type_check
  CHECK (job_type IN (
    'transcribe',
    'structure_soap',
    'generate_embeddings',
    'copilot_query',
    'session_text',
    'process_attachment'
  ));

-- ============================================================
-- TABLE: patient_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patient_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  processing_error TEXT,
  extracted_char_count INT,
  embeddings_count INT NOT NULL DEFAULT 0 CHECK (embeddings_count >= 0),
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT patient_attachments_storage_path_unique UNIQUE (storage_path)
);

COMMENT ON TABLE public.patient_attachments IS
  'Documentos externos do paciente (PDF, Word, TXT) — vetorizados para o copiloto IA.';

CREATE INDEX IF NOT EXISTS idx_patient_attachments_patient_created
  ON public.patient_attachments (patient_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_attachments_status
  ON public.patient_attachments (patient_id, status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_patient_attachments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_attachments_updated_at ON public.patient_attachments;
CREATE TRIGGER trg_patient_attachments_updated_at
  BEFORE UPDATE ON public.patient_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_patient_attachments_updated_at();

ALTER TABLE public.patient_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_attachments_professional_scope" ON public.patient_attachments;
CREATE POLICY "patient_attachments_professional_scope"
  ON public.patient_attachments
  FOR ALL
  USING (
    patient_id IN (
      SELECT p.id
      FROM public.patients p
      JOIN public.professionals prof ON p.professional_id = prof.id
      WHERE prof.user_id = auth.uid()
        AND prof.deleted_at IS NULL
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT p.id
      FROM public.patients p
      JOIN public.professionals prof ON p.professional_id = prof.id
      WHERE prof.user_id = auth.uid()
        AND prof.deleted_at IS NULL
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "patient_attachments_master_access" ON public.patient_attachments;
CREATE POLICY "patient_attachments_master_access"
  ON public.patient_attachments
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'master');

DROP POLICY IF EXISTS "patient_attachments_clinic_admin_read" ON public.patient_attachments;
CREATE POLICY "patient_attachments_clinic_admin_read"
  ON public.patient_attachments
  FOR SELECT
  USING (
    clinic_id = public.auth_clinic_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
    AND deleted_at IS NULL
  );

-- ============================================================
-- Storage bucket: pacientes-anexos (privado)
-- Path: {clinic_id}/{patient_id}/{attachment_id}/{file_name}
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pacientes-anexos',
  'pacientes-anexos',
  false,
  15728640, -- 15 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "patient_attachments_storage_professional_select" ON storage.objects;
CREATE POLICY "patient_attachments_storage_professional_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pacientes-anexos'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_attachments_storage_professional_insert" ON storage.objects;
CREATE POLICY "patient_attachments_storage_professional_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pacientes-anexos'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_attachments_storage_professional_update" ON storage.objects;
CREATE POLICY "patient_attachments_storage_professional_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pacientes-anexos'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_attachments_storage_professional_delete" ON storage.objects;
CREATE POLICY "patient_attachments_storage_professional_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pacientes-anexos'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_attachments_storage_clinic_admin_select" ON storage.objects;
CREATE POLICY "patient_attachments_storage_clinic_admin_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pacientes-anexos'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    WHERE p.clinic_id = public.auth_clinic_id()
      AND p.deleted_at IS NULL
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
);
