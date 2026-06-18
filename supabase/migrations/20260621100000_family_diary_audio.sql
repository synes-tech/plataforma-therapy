-- ============================================================
-- Family Diary Audio — transcricao + bucket dedicado (LGPD)
-- Agentes: DBA + Segurança
-- ============================================================

-- Coluna de transcrição limpa (audio_note_url já existe na tabela)
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS transcricao TEXT;

COMMENT ON COLUMN diary_entries.audio_note_url IS 'Path no bucket family-diary-audio (ou legado)';
COMMENT ON COLUMN diary_entries.transcricao IS 'Texto transcrito e limpo do relato em áudio da família';

-- Bucket privado para áudios do diário familiar
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-diary-audio',
  'family-diary-audio',
  false,
  15728640, -- 15 MB (~3 min webm/opus)
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path: {clinic_id}/{patient_id}/family/{timestamp}.{ext}
-- storage.foldername(name) => {clinic_id, patient_id, family, ...}

-- Família: upload apenas no paciente vinculado
DROP POLICY IF EXISTS "family_diary_audio_family_insert" ON storage.objects;
CREATE POLICY "family_diary_audio_family_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'family-diary-audio'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT pfl.patient_id
    FROM public.patient_family_links pfl
    WHERE pfl.user_id = auth.uid()
  )
  AND (storage.foldername(name))[3] = 'family'
);

-- Família: leitura dos próprios arquivos
DROP POLICY IF EXISTS "family_diary_audio_family_select" ON storage.objects;
CREATE POLICY "family_diary_audio_family_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'family-diary-audio'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT pfl.patient_id
    FROM public.patient_family_links pfl
    WHERE pfl.user_id = auth.uid()
  )
);

-- Terapeuta responsável: leitura dos áudios dos seus pacientes
DROP POLICY IF EXISTS "family_diary_audio_professional_select" ON storage.objects;
CREATE POLICY "family_diary_audio_professional_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'family-diary-audio'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT p.id
    FROM public.patients p
    JOIN public.professionals prof ON p.professional_id = prof.id
    WHERE prof.user_id = auth.uid()
      AND prof.deleted_at IS NULL
      AND p.deleted_at IS NULL
  )
);
