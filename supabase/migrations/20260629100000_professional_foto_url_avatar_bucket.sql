-- ============================================================
-- UNITHERY — Foto de perfil do profissional/admin (foto_url + Storage)
-- Migration: 20260629100000_professional_foto_url_avatar_bucket.sql
-- ============================================================

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

ALTER TABLE public.clinic_admins
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN public.professionals.foto_url IS
  'Caminho no bucket profissionais-avatars (ex.: {clinic_id}/{user_id}/avatar.jpg). NULL = iniciais.';

COMMENT ON COLUMN public.clinic_admins.foto_url IS
  'Caminho no bucket profissionais-avatars (ex.: {clinic_id}/{user_id}/avatar.jpg). NULL = iniciais.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profissionais-avatars',
  'profissionais-avatars',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path: {clinic_id}/{user_id}/avatar.{ext}

DROP POLICY IF EXISTS "professional_avatars_owner_select" ON storage.objects;
CREATE POLICY "professional_avatars_owner_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profissionais-avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "professional_avatars_owner_insert" ON storage.objects;
CREATE POLICY "professional_avatars_owner_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profissionais-avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "professional_avatars_owner_update" ON storage.objects;
CREATE POLICY "professional_avatars_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profissionais-avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "professional_avatars_owner_delete" ON storage.objects;
CREATE POLICY "professional_avatars_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profissionais-avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
