-- Foto de perfil do profissional/admin (faltou no dump inicial do Cloud SQL).
-- Idempotente. Storage fica no GCS (bucket profissionais-avatars), não no storage.objects.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

ALTER TABLE public.clinic_admins
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN public.professionals.foto_url IS
  'Caminho no bucket profissionais-avatars (ex.: {clinic_id}/{user_id}/avatar.jpg). NULL = iniciais.';

COMMENT ON COLUMN public.clinic_admins.foto_url IS
  'Caminho no bucket profissionais-avatars (ex.: {clinic_id}/{user_id}/avatar.jpg). NULL = iniciais.';

NOTIFY pgrst, 'reload schema';
