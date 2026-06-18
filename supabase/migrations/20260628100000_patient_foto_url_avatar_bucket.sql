-- ============================================================
-- UNITHERY — Foto de perfil do paciente (foto_url + Storage)
-- Migration: 20260628100000_patient_foto_url_avatar_bucket.sql
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN public.patients.foto_url IS
  'Caminho no bucket pacientes-avatars (ex.: {clinic_id}/{patient_id}/avatar.jpg). NULL = iniciais.';

-- Bucket privado — leitura via signed URL + RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pacientes-avatars',
  'pacientes-avatars',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path: {clinic_id}/{patient_id}/avatar.{ext}
-- foldername(name)[2] = patient_id

DROP POLICY IF EXISTS "patient_avatars_professional_select" ON storage.objects;
CREATE POLICY "patient_avatars_professional_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pacientes-avatars'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_avatars_professional_insert" ON storage.objects;
CREATE POLICY "patient_avatars_professional_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pacientes-avatars'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_avatars_professional_update" ON storage.objects;
CREATE POLICY "patient_avatars_professional_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pacientes-avatars'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "patient_avatars_professional_delete" ON storage.objects;
CREATE POLICY "patient_avatars_professional_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pacientes-avatars'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);

-- clinic_admin: leitura dos avatares da clínica
DROP POLICY IF EXISTS "patient_avatars_clinic_admin_select" ON storage.objects;
CREATE POLICY "patient_avatars_clinic_admin_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pacientes-avatars'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    WHERE p.clinic_id = public.auth_clinic_id()
      AND p.deleted_at IS NULL
  )
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic_admin'
);
